// Print-PDF finishing with pdf-lib: correct page boxes, bleed on the right edges,
// document info + XMP metadata, and an even page count. Used for every interior and
// cover PDF Booky builds or receives. Works in the browser and in Node (tests).
//
// Booky typesets bleed on all four sides (Paged.js `bleed`). Print-on-demand printers
// want interior bleed only on the outside, top and bottom edges (trim width + bleed,
// trim height + 2 × bleed), so the bleed on the spine side of each page is cropped here.

export const PT = 72; // PDF points per inch
const near = (a, b, tol = 0.75) => Math.abs(a - b) <= tol; // tolerance in points (~0.01 in)

const xmlEsc = (s) => String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

/** XMP packet for title, author, description, keywords, language and tool. */
export function buildXmp({ title = '', author = '', subject = '', keywords = [], language = '', date = new Date() } = {}) {
  const iso = date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const kw = keywords.filter(Boolean);
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <dc:format>application/pdf</dc:format>
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(title)}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>${xmlEsc(author)}</rdf:li></rdf:Seq></dc:creator>
   ${subject ? `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(subject)}</rdf:li></rdf:Alt></dc:description>` : ''}
   ${kw.length ? `<dc:subject><rdf:Bag>${kw.map((k) => `<rdf:li>${xmlEsc(k)}</rdf:li>`).join('')}</rdf:Bag></dc:subject>` : ''}
   ${language ? `<dc:language><rdf:Bag><rdf:li>${xmlEsc(language)}</rdf:li></rdf:Bag></dc:language>` : ''}
   <pdf:Producer>Booky</pdf:Producer>
   ${kw.length ? `<pdf:Keywords>${xmlEsc(kw.join(', '))}</pdf:Keywords>` : ''}
   <xmp:CreatorTool>Booky</xmp:CreatorTool>
   <xmp:CreateDate>${iso}</xmp:CreateDate>
   <xmp:ModifyDate>${iso}</xmp:ModifyDate>
   <xmp:MetadataDate>${iso}</xmp:MetadataDate>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Page boxes for one interior page (all values in points).
 * @param media {x, y, width, height} of the page as typeset
 * @param spec { trimW, trimH, bleed } in inches; bleed 0 when the book has no bleed
 * @param insideEdge 'left' | 'right' — the spine side of this page
 * @returns { media, trim, bleed, fits } — fits=false when the page is not trim (+ bleed) sized
 */
export function interiorBoxes(media, { trimW, trimH, bleed = 0 }, insideEdge) {
  const tw = trimW * PT, th = trimH * PT, b = bleed * PT;
  if (b > 0 && near(media.width, tw + 2 * b) && near(media.height, th + 2 * b)) {
    // Typeset with bleed on all sides: crop the spine-side bleed.
    const x0 = insideEdge === 'left' ? media.x + b : media.x;
    const m = { x: x0, y: media.y, width: tw + b, height: th + 2 * b };
    const trim = { x: media.x + b, y: media.y + b, width: tw, height: th };
    return { media: m, trim, bleed: m, fits: true };
  }
  if (b > 0 && near(media.width, tw + b) && near(media.height, th + 2 * b)) {
    // Already outside-edge bleed only.
    const tx = insideEdge === 'left' ? media.x : media.x + b;
    return { media, trim: { x: tx, y: media.y + b, width: tw, height: th }, bleed: media, fits: true };
  }
  const fits = near(media.width, tw) && near(media.height, th);
  return { media, trim: media, bleed: media, fits };
}

/** Which edge of page `n` (1-based) is the spine side. Page 1 is a right-hand page in left-to-right books. */
export const insideEdgeOf = (n, rtl = false) => ((n % 2 === 1) !== rtl ? 'left' : 'right');

async function pdfLib() { return import('pdf-lib'); }

const setBox = (page, name, b) => page[`set${name}Box`](b.x, b.y, b.width, b.height);

function addXmp(lib, doc, meta) {
  const xml = buildXmp(meta);
  const bytes = new TextEncoder().encode(xml);
  const stream = doc.context.stream(bytes, { Type: 'Metadata', Subtype: 'XML', Length: bytes.length });
  doc.catalog.set(lib.PDFName.of('Metadata'), doc.context.register(stream));
}

function setInfo(doc, meta) {
  doc.setTitle(meta.title || '', { showInWindowTitleBar: true });
  doc.setAuthor(meta.author || '');
  if (meta.subject) doc.setSubject(meta.subject);
  if (meta.keywords?.length) doc.setKeywords(meta.keywords);
  doc.setCreator('Booky');
  doc.setProducer('Booky');
  if (meta.language) doc.setLanguage(meta.language);
  doc.setModificationDate(meta.date || new Date());
}

/**
 * Finish an interior PDF. Returns { bytes, notes } — notes describe anything changed.
 * opts: { trimW, trimH, bleed (in, 0 = none), rtl, meta, padEven }
 */
export async function finishInterior(input, { trimW, trimH, bleed = 0, rtl = false, meta = {}, padEven = true }) {
  const lib = await pdfLib();
  const doc = await lib.PDFDocument.load(input, { updateMetadata: false });
  const notes = [];
  let cropped = 0;
  doc.getPages().forEach((page, i) => {
    const boxes = interiorBoxes(page.getMediaBox(), { trimW, trimH, bleed }, insideEdgeOf(i + 1, rtl));
    if (boxes.media.width !== page.getMediaBox().width) cropped++;
    setBox(page, 'Media', boxes.media);
    setBox(page, 'Crop', boxes.media);
    setBox(page, 'Bleed', boxes.bleed);
    setBox(page, 'Trim', boxes.trim);
  });
  if (cropped) notes.push(`Bleed on the spine side of ${cropped} page(s) was removed, as printers require (outside, top and bottom bleed kept).`);
  if (padEven && doc.getPageCount() % 2 === 1) {
    const last = doc.getPage(doc.getPageCount() - 1).getMediaBox();
    const page = doc.addPage([last.width, last.height]);
    const full = { x: 0, y: 0, width: last.width, height: last.height };
    const tb = bleed * PT, fitsBleed = bleed > 0 && near(last.width, (trimW + bleed) * PT);
    // In a cropped bleed page the trim starts at the inside edge (no bleed there).
    const trim = fitsBleed ? { x: insideEdgeOf(doc.getPageCount(), rtl) === 'left' ? 0 : tb, y: tb, width: trimW * PT, height: trimH * PT } : full;
    setBox(page, 'Bleed', full);
    setBox(page, 'Trim', trim);
    notes.push('Added a blank page at the end so the page count is even.');
  }
  setInfo(doc, meta);
  addXmp(lib, doc, meta);
  return { bytes: await doc.save({ useObjectStreams: false }), notes };
}

/** Finish a cover PDF: bleed on all four sides (coverBleed in inches). */
export async function finishCover(input, { coverBleed = 0.125, meta = {} }) {
  const lib = await pdfLib();
  const doc = await lib.PDFDocument.load(input, { updateMetadata: false });
  const b = coverBleed * PT;
  for (const page of doc.getPages()) {
    const m = page.getMediaBox();
    setBox(page, 'Crop', m);
    setBox(page, 'Bleed', m);
    setBox(page, 'Trim', { x: m.x + b, y: m.y + b, width: m.width - 2 * b, height: m.height - 2 * b });
  }
  setInfo(doc, meta);
  addXmp(lib, doc, meta);
  return { bytes: await doc.save({ useObjectStreams: false }), notes: [] };
}

/** Metadata for the PDFs of a book. */
export function pdfMeta(book, suffix = '') {
  const m = book.meta;
  return {
    title: `${m.title || 'Untitled'}${suffix}`, author: m.author || '', subject: m.description || '',
    keywords: String(m.keywords || '').split(/[,;\n]/).map((k) => k.trim()).filter(Boolean), language: m.language || 'en',
  };
}
