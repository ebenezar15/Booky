// Print page numbers for the ebook (EPUB page-list): typeset the print edition with Paged.js,
// then record where each page starts as { label, anchor, block } — `block` is the data-b index
// of the first block on the page inside section `anchor` (null = the section's start).
// A page that begins in the middle of a paragraph is marked just before that paragraph
// (the nearest preceding safe point), so the marker never splits text.

/** Pure part: from per-page descriptions to page-list entries (tested). */
export function pageListFrom(pages) {
  const out = [];
  const seen = new Set();
  for (const p of pages) {
    if (!p.label || !p.anchor) continue; // blank pages have no content to point at
    let id = `pg-${String(p.label).replace(/[^\w-]/g, '')}`;
    while (seen.has(id)) id += '-b';
    seen.add(id);
    out.push({ label: String(p.label), id, anchor: p.anchor, block: p.block });
  }
  return out;
}

/** Read the paginated print document (browser). Paged.js keeps data-el on every fragment of a
 * section and marks continued fragments (and continued paragraphs) with data-split-from. */
export function readPages(doc) {
  return [...doc.querySelectorAll('.pagedjs_page')].map((page) => {
    const label = page.getAttribute('data-folio') || '';
    const sec = page.querySelector('section.bk-sec[data-el]');
    if (!sec) return { label, anchor: null, block: null };
    const anchor = `s-${sec.getAttribute('data-el')}`;
    if (!sec.hasAttribute('data-split-from')) return { label, anchor, block: null }; // the section starts on this page
    const first = sec.querySelector('.bk-content > [data-b]');
    // A continued paragraph is marked at its own start (the nearest preceding safe point).
    return first ? { label, anchor, block: +first.getAttribute('data-b') } : { label, anchor: null, block: null };
  });
}

/** Typeset the book off-screen and return its page list. */
export async function computePageList(book) {
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '-10000px', top: '0', width: '1200px', height: '900px', overflow: 'hidden' });
  document.body.appendChild(host);
  try {
    const { PrintPreview } = await import('../render/preview.js');
    const pv = new PrintPreview(host);
    pv.spread = false;
    await pv.render(book);
    return pageListFrom(readPages(pv.doc));
  } finally {
    host.remove();
  }
}

/** A print edition exists when the book has a print ISBN or has been typeset for print. */
export const hasPrintEdition = (book) => !!(String(book.meta.isbnPrint || '').trim() || book.cover?.lastPageCount > 0);

/** Page list for the EPUB when the option is on and a print edition exists; null otherwise. */
export async function pageListIfWanted(book) {
  if (book.format.ebook?.pageList === false || !hasPrintEdition(book)) return null;
  try { return await computePageList(book); } catch (e) { console.warn('Page list skipped:', e); return null; }
}
