// Interior PDF checker: page size, page count, embedded fonts and image-only pages.
// `inspectPdf` reads a PDF (pdf-lib) into a plain summary; `checkInterior` turns a summary
// into ok / warn / bad findings (pure, unit-tested).
import { PT } from './pdf-post.js';

const TOL = 0.01; // inches

/** Expected interior page size in inches. Bleed: outside, top and bottom only. */
export function expectedPageSize({ trimW, trimH, bleed = 0 }) {
  return bleed > 0 ? { w: trimW + bleed, h: trimH + 2 * bleed } : { w: trimW, h: trimH };
}

const fmt = (n) => (Math.round(n * 1000) / 1000).toString();

/**
 * summary: { pages: [{ w, h (inches), fonts: [{ name, embedded }], text: bool, fullPageImage: bool }] }
 * spec: { trimW, trimH, bleed, minPages, maxPages }
 * @returns [{ ok: true | 'warn' | false, text }]
 */
export function checkInterior(summary, spec) {
  const out = [];
  const add = (ok, text) => out.push({ ok, text });
  const pages = summary.pages || [];
  const n = pages.length;
  if (!n) return [{ ok: false, text: 'The PDF has no pages.' }];

  // page size
  const want = expectedPageSize(spec);
  const wrong = pages.map((p, i) => ({ ...p, i })).filter((p) => Math.abs(p.w - want.w) > TOL || Math.abs(p.h - want.h) > TOL);
  if (!wrong.length) add(true, `Every page is ${fmt(want.w)} × ${fmt(want.h)} in (${spec.trimW} × ${spec.trimH} in trim${spec.bleed ? ` + ${spec.bleed} in bleed` : ', no bleed'})`);
  else {
    const p = wrong[0];
    const swapped = Math.abs(p.w - want.h) <= TOL && Math.abs(p.h - want.w) <= TOL;
    const bleedLike = !spec.bleed && Math.abs(p.w - (want.w + 0.125)) <= TOL;
    add(false, `${wrong.length === n ? 'All pages are' : `${wrong.length} page(s) are`} ${fmt(p.w)} × ${fmt(p.h)} in, expected ${fmt(want.w)} × ${fmt(want.h)} in${swapped ? ' (landscape — check the print orientation)' : bleedLike ? ' (looks like bleed is on in the PDF but off in Format)' : ''}. In the print dialog use Margins: Default and Scale: 100%.`);
  }

  // page count
  if (spec.minPages && n < spec.minPages) add(false, `${n} pages — the platform needs at least ${spec.minPages}`);
  else if (spec.maxPages && n > spec.maxPages) add(false, `${n} pages — the platform allows at most ${spec.maxPages}`);
  else add(n % 2 ? 'warn' : true, n % 2 ? `${n} pages — an odd count; Booky adds one blank page at the end` : `${n} pages${spec.minPages ? ` (allowed ${spec.minPages}–${spec.maxPages})` : ''}`);

  // fonts
  const fonts = new Map();
  pages.forEach((p) => (p.fonts || []).forEach((f) => { if (!fonts.has(f.name) || !f.embedded) fonts.set(f.name, f.embedded); }));
  const missing = [...fonts].filter(([, e]) => !e).map(([name]) => name);
  if (!fonts.size) add(pages.some((p) => p.text) ? 'warn' : true, pages.some((p) => p.text) ? 'Could not find the font list' : 'No fonts in the PDF (no live text)');
  else add(missing.length ? false : true, missing.length ? `Not embedded: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''} — printers reject PDFs with fonts that are not embedded` : `All ${fonts.size} font${fonts.size === 1 ? '' : 's'} embedded`);

  // image-only pages
  const raster = pages.filter((p) => p.fullPageImage && !p.text).length;
  if (raster === n) add('warn', 'Every page is a single full-page image — this is an image-based PDF. Text will be softer and larger files; fine for proofs, a vector PDF is better for printing.');
  else if (raster) add('warn', `${raster} page(s) are a single full-page image (no live text). That is fine for full-page pictures; otherwise check those pages.`);
  else add(true, 'Text is real, selectable text (vector)');
  return out;
}

// ---------- reading a PDF (pdf-lib) ----------
function str(x) { return x?.decodeText ? x.decodeText() : x?.asString ? x.asString() : String(x ?? ''); }

function fontInfo(lib, ctx, fontDict) {
  const name = str(fontDict.get(lib.PDFName.of('BaseFont'))).replace(/^\//, '').replace(/^[A-Z]{6}\+/, '') || 'unnamed font';
  const subtype = str(fontDict.get(lib.PDFName.of('Subtype'))).replace(/^\//, '');
  if (subtype === 'Type3') return { name, embedded: true };
  let desc = fontDict.lookup(lib.PDFName.of('FontDescriptor'));
  if (subtype === 'Type0') {
    const desc0 = fontDict.lookup(lib.PDFName.of('DescendantFonts'));
    const child = desc0 && ctx.lookup(desc0.get(0));
    desc = child?.lookup?.(lib.PDFName.of('FontDescriptor'));
  }
  const embedded = !!(desc && ['FontFile', 'FontFile2', 'FontFile3'].some((k) => desc.get(lib.PDFName.of(k))));
  return { name, embedded };
}

function walkResources(lib, ctx, res, acc, depth = 0) {
  if (!res || depth > 4) return;
  const fonts = res.lookup(lib.PDFName.of('Font'));
  if (fonts?.entries) for (const [, v] of fonts.entries()) { const f = ctx.lookup(v); if (f?.get) acc.fonts.push(fontInfo(lib, ctx, f)); }
  const xo = res.lookup(lib.PDFName.of('XObject'));
  if (xo?.entries) {
    for (const [, v] of xo.entries()) {
      const s = ctx.lookup(v);
      const d = s?.dict;
      if (!d) continue;
      const sub = str(d.get(lib.PDFName.of('Subtype'))).replace(/^\//, '');
      if (sub === 'Image') acc.images.push({ w: d.lookup(lib.PDFName.of('Width'))?.asNumber?.() || 0, h: d.lookup(lib.PDFName.of('Height'))?.asNumber?.() || 0 });
      if (sub === 'Form') { acc.forms.push(s); walkResources(lib, ctx, d.lookup(lib.PDFName.of('Resources')), acc, depth + 1); }
    }
  }
}

function contentText(lib, streams) {
  let out = '';
  for (const s of streams) {
    try { out += new TextDecoder('latin1').decode(s instanceof lib.PDFRawStream ? lib.decodePDFRawStream(s).decode() : s.getContents?.() || new Uint8Array()); } catch { /* unreadable stream */ }
  }
  return out;
}

/** Read a PDF into the summary used by checkInterior. */
export async function inspectPdf(bytes) {
  const lib = await import('pdf-lib');
  const doc = await lib.PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  const ctx = doc.context;
  const pages = doc.getPages().map((page) => {
    const box = page.getMediaBox();
    const acc = { fonts: [], images: [], forms: [] };
    walkResources(lib, ctx, page.node.Resources(), acc);
    const c = page.node.Contents();
    const streams = c instanceof lib.PDFArray ? c.asArray().map((r) => ctx.lookup(r)) : c ? [c] : [];
    const ops = contentText(lib, [...streams, ...acc.forms]);
    const text = /\bT[jJ]\b|'\s*$|"\s*$/m.test(ops) || (acc.fonts.length > 0 && /\bTf\b/.test(ops));
    const ratio = box.width / box.height;
    const fullPageImage = acc.images.some((im) => im.w && im.h && Math.abs(im.w / im.h - ratio) / ratio < 0.03);
    return { w: box.width / PT, h: box.height / PT, fonts: acc.fonts, text, fullPageImage };
  });
  return { pages };
}
