// Upload requirements for the main self-publishing platforms (checked against the book
// before exporting a ready-to-upload package). Values reflect each platform's published
// specs; always double-check the platform's own guide before ordering proofs.

export const PLATFORMS = [
  // ---------- ebooks ----------
  {
    id: 'kindle', name: 'Amazon Kindle (KDP eBook)', kind: 'ebook', color: 'linear-gradient(135deg,#232f3e,#ff9900)', icon: 'tablet',
    files: ['EPUB 3 manuscript', 'Cover JPG 1600 × 2560 px'], cover: { w: 1600, h: 2560 },
    notes: ['KDP converts your EPUB to Kindle format automatically (EPUB is Amazon’s recommended upload format).', 'ISBN is not required for Kindle eBooks.', 'Use “Kindle Previewer” to check the book before publishing.'],
  },
  {
    id: 'apple', name: 'Apple Books', kind: 'ebook', color: 'linear-gradient(135deg,#ff5f6d,#ffc371)', icon: 'book-open',
    files: ['EPUB 3 manuscript', 'Cover JPG 1600 × 2400 px'], cover: { w: 1600, h: 2400 }, needsIsbn: false,
    notes: ['Upload through Apple Books for Authors or an aggregator (e.g. Draft2Digital).', 'Cover must be at least 1400 px wide.'],
  },
  {
    id: 'kobo', name: 'Kobo Writing Life', kind: 'ebook', color: 'linear-gradient(135deg,#bf0000,#ff4b4b)', icon: 'tablet',
    files: ['EPUB 3 manuscript', 'Cover JPG 1600 × 2400 px'], cover: { w: 1600, h: 2400 },
    notes: ['Kobo accepts EPUB directly; DRM is optional.'],
  },
  {
    id: 'google', name: 'Google Play Books', kind: 'ebook', color: 'linear-gradient(135deg,#01875f,#34a853)', icon: 'tablet',
    files: ['EPUB 3 manuscript', 'Cover JPG 1600 × 2560 px', 'Interior PDF (optional, for page-faithful preview)'], cover: { w: 1600, h: 2560 },
    notes: ['Google recommends uploading both an EPUB and a PDF.'],
  },
  {
    id: 'bn', name: 'Barnes & Noble Press (eBook)', kind: 'ebook', color: 'linear-gradient(135deg,#2a5934,#4d8c57)', icon: 'tablet',
    files: ['EPUB 3 manuscript', 'Cover JPG 1600 × 2400 px'], cover: { w: 1600, h: 2400 },
    notes: ['Cover minimum 1400 × 1400 px; 2:3 ratio recommended.'],
  },
  {
    id: 'd2d', name: 'Draft2Digital / Smashwords', kind: 'ebook', color: 'linear-gradient(135deg,#1c3f94,#3e7bfa)', icon: 'globe',
    files: ['EPUB 3 manuscript', 'DOCX manuscript', 'Cover JPG 1600 × 2400 px'], cover: { w: 1600, h: 2400 }, docx: true,
    notes: ['One upload distributes to Apple, Kobo, B&N, libraries and more.'],
  },
  // ---------- print ----------
  {
    id: 'kdp-paper', name: 'Amazon KDP Paperback', kind: 'print', color: 'linear-gradient(135deg,#232f3e,#ff9900)', icon: 'book',
    files: ['Interior PDF (300 DPI)', 'Full cover PDF with spine', 'Metadata sheet'], minPages: 24, maxPages: 828,
    trims: ['5x8', '5.06x7.81', '5.25x8', '5.5x8.5', '6x9', '6.14x9.21', '6.69x9.61', '7x10', '7.5x9.25', '8x10', '8.25x6', '8.5x8.5', '8.5x11', '4.25x6.87', 'A5', 'A4'],
    paper: { white: 0.002252, cream: 0.0025, color: 0.002347 }, bleed: 0.125, minSpineText: 79,
    notes: ['Interior bleed is only needed if images touch the page edge.', 'Spine text is allowed from 79 pages.', 'Leave 0.375 in (plus gutter) between text and edges.'],
  },
  {
    id: 'kdp-hard', name: 'Amazon KDP Hardcover', kind: 'print', color: 'linear-gradient(135deg,#131a22,#c47f00)', icon: 'book',
    files: ['Interior PDF (300 DPI)', 'Case-laminate cover PDF', 'Metadata sheet'], minPages: 75, maxPages: 550,
    trims: ['5.5x8.5', '6x9', '6.14x9.21', '7x10', '8.25x11'], paper: { white: 0.002252, cream: 0.0025 }, bleed: 0.125, wrap: 0.51,
    notes: ['Hardcover covers include a 0.51 in wrap; verify the final size with KDP’s cover calculator.'],
  },
  {
    id: 'ingram', name: 'IngramSpark (paperback & hardcover)', kind: 'print', color: 'linear-gradient(135deg,#003a5d,#00a3e0)', icon: 'package',
    files: ['Interior PDF (300 DPI)', 'Full cover PDF with spine', 'Metadata sheet'], minPages: 18, maxPages: 1200, needsIsbn: true,
    trims: ['5x8', '5.25x8', '5.5x8.5', '6x9', '6.14x9.21', '6.69x9.61', '7x10', '7.5x9.25', '8x10', '8.5x8.5', '8.5x11', '4.25x6.87', 'A5', 'A4', '5.06x7.81'],
    paper: { white: 0.0025, cream: 0.0025, color: 0.0025 }, bleed: 0.125,
    notes: ['An ISBN you own is required.', 'Ingram recommends PDF/X-1a; their checker also accepts standard PDFs.', 'Cover bleed must be 0.125 in.'],
  },
  {
    id: 'lulu', name: 'Lulu', kind: 'print', color: 'linear-gradient(135deg,#1f5f8b,#4fb3bf)', icon: 'package',
    files: ['Interior PDF (300 DPI)', 'Full cover PDF with spine', 'Metadata sheet'], minPages: 32, maxPages: 800,
    trims: ['5.5x8.5', '6x9', '6.14x9.21', '6.69x9.61', '7.5x9.25', '8.5x8.5', '8.5x11', 'A5', 'A4', '4.25x6.87'],
    paper: { white: 0.002252, cream: 0.0025, color: 0.002347 }, bleed: 0.125,
    notes: ['Lulu calculates spine width from page count; Booky uses the same paper thickness.'],
  },
  {
    id: 'bn-print', name: 'Barnes & Noble Press (print)', kind: 'print', color: 'linear-gradient(135deg,#2a5934,#4d8c57)', icon: 'book',
    files: ['Interior PDF (300 DPI)', 'Full cover PDF with spine', 'Metadata sheet'], minPages: 24, maxPages: 800,
    trims: ['5x8', '5.25x8', '5.5x8.5', '6x9', '6.14x9.21', '7x10', '8.5x11'], paper: { white: 0.002252, cream: 0.0025 }, bleed: 0.125,
    notes: ['B&N Press offers paperback and hardcover in these trims.'],
  },
];

export function gutterFor(pages) {
  if (pages <= 150) return 0.375;
  if (pages <= 300) return 0.5;
  if (pages <= 500) return 0.625;
  if (pages <= 700) return 0.75;
  return 0.875;
}

/** Check a book against a platform. Returns [{ ok: true|false|'warn', text, fix? }] */
export function checkPlatform(p, book, pages) {
  const m = book.meta, f = book.format;
  const out = [];
  const c = (ok, text, fix) => out.push({ ok, text, fix });
  c(!!(m.title && m.title !== 'Untitled Book'), 'Book title set');
  c(!!m.author, 'Author name set');
  c(m.description ? true : 'warn', m.description ? 'Description ready for the store page' : 'Add a description (needed on the store page)');
  if (p.needsIsbn) c(!!(p.kind === 'print' ? m.isbnPrint : m.isbnEbook), 'ISBN entered in Book details');
  if (p.kind === 'ebook') {
    c(book.elements.some((e) => e.type === 'toc' && e.include.ebook), 'Table of contents included', 'toc');
  } else {
    c(p.trims.includes(f.trim), `Trim size ${f.trim === 'custom' ? 'custom' : f.trim} ${p.trims.includes(f.trim) ? 'is supported' : 'is NOT offered — choose another in Format'}`);
    c(pages >= p.minPages && pages <= p.maxPages, `${pages} pages (allowed ${p.minPages}–${p.maxPages})`);
    const need = gutterFor(pages);
    c(f.margins.inside >= need + 0.125 ? true : f.margins.inside >= need ? 'warn' : false, `Inside margin ${f.margins.inside} in (minimum ${need} in for ${pages} pages)`, 'gutter');
    c(Math.min(f.margins.outside, f.margins.top, f.margins.bottom) >= 0.25, 'Outside, top and bottom margins at least 0.25 in', 'margins');
  }
  return out;
}
