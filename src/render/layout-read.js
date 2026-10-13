// Reads the Paged.js pages into the plain structure `layoutFindings` (src/core/layout-check.js) checks.
// Lines are found from word boxes: a word whose boxes sit on two lines was hyphenated there.

const BLOCK_SEL = 'p, h1, h2, h3, h4, li, figure, .bk-scene, .bk-scene-line, .bk-chap-head, .bk-part-head';

function kindOf(el) {
  if (el.matches('.bk-scene, .bk-scene-line')) return 'scene';
  if (el.matches('h2, h3, h4')) return 'heading';
  if (el.matches('.bk-chap-head, .bk-part-head, h1')) return 'chapter-head';
  if (el.matches('figure')) return 'figure';
  if (el.matches('p, li')) return 'p';
  return 'other';
}

const textNodesOf = (el) => {
  const out = [];
  const w = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) if (n.data.trim()) out.push(n);
  return out;
};

let canvas;
function spaceWidth(el) {
  const st = el.ownerDocument.defaultView.getComputedStyle(el);
  canvas ||= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
  return ctx.measureText(' ').width + (parseFloat(st.wordSpacing) || 0) + (parseFloat(st.letterSpacing) || 0);
}

/** Lines of one block: { lines, hyphens: [bool], loose: [ratio] } (rects are divided by the preview zoom). */
function measureBlock(el, zoom) {
  const doc = el.ownerDocument;
  const words = []; // { top, left, right, broken }
  for (const t of textNodesOf(el)) {
    const re = /\S+/g;
    let m;
    while ((m = re.exec(t.data))) {
      const r = doc.createRange();
      r.setStart(t, m.index);
      r.setEnd(t, m.index + m[0].length);
      const rects = [...r.getClientRects()].filter((x) => x.width > 0);
      if (!rects.length) continue;
      const tops = [...new Set(rects.map((x) => Math.round(x.top / zoom / 2)))];
      words.push({ top: Math.round(rects[0].top / zoom / 2), left: rects[0].left / zoom, right: rects[rects.length - 1].right / zoom, firstRight: rects[0].right / zoom, broken: tops.length > 1, lastTop: Math.round(rects[rects.length - 1].top / zoom / 2) });
    }
  }
  if (!words.length) return { lines: 0, hyphens: [], loose: [] };
  // group into lines by top (2px buckets)
  const lineTops = [];
  for (const w of words) { for (const t of [w.top, w.lastTop]) if (!lineTops.some((x) => Math.abs(x - t) <= 1)) lineTops.push(t); }
  lineTops.sort((a, b) => a - b);
  const lineOf = (t) => lineTops.findIndex((x) => Math.abs(x - t) <= 1);
  const hyphens = lineTops.map(() => false);
  const gaps = lineTops.map(() => []);
  let prev = null;
  for (const w of words) {
    if (w.broken) hyphens[lineOf(w.top)] = true;
    if (prev && !prev.broken && prev.top === w.top) gaps[lineOf(w.top)].push(w.left - prev.right);
    prev = w;
  }
  const st = doc.defaultView.getComputedStyle(el);
  let loose = [];
  if (st.textAlign === 'justify') {
    const space = spaceWidth(el);
    // the last line of a paragraph is not stretched (unless the paragraph continues on the next page)
    const lastJustified = el.hasAttribute('data-split-to') ? gaps.length : gaps.length - 1;
    loose = gaps.map((g, i) => (i < lastJustified && g.length >= 2 && space > 0 ? g.reduce((a, b) => a + b, 0) / g.length / space : 0));
  }
  return { lines: lineTops.length, hyphens, loose };
}

/** @returns pages for layoutFindings */
export function readLayout(doc) {
  const pages = [...doc.querySelectorAll('.pagedjs_page')];
  return pages.map((page, i) => {
    const zoom = page.getBoundingClientRect().width / (page.offsetWidth || 1) || 1;
    const area = page.querySelector('.pagedjs_page_content') || page;
    const inserted = page.classList.contains('pagedjs_blank_page');
    const blocks = [];
    for (const el of area.querySelectorAll(BLOCK_SEL)) {
      if (el.parentElement.closest(BLOCK_SEL)) continue; // nested (e.g. p inside li or figure)
      const kind = kindOf(el);
      const m = kind === 'figure' ? { lines: 0, hyphens: [], loose: [] } : measureBlock(el, zoom);
      blocks.push({
        kind: kind === 'chapter-head' ? 'other' : kind, elId: el.closest('[data-el]')?.getAttribute('data-el') || '',
        lines: m.lines, hyphens: m.hyphens, loose: m.loose,
        splitFrom: el.hasAttribute('data-split-from'), splitTo: el.hasAttribute('data-split-to'),
        text: kind === 'p' ? (el.hasAttribute('data-split-from') ? el.textContent.trim().split(/\s+/).slice(-8).join(' ') : el.textContent.trim().slice(0, 60)) : el.textContent.trim().slice(0, 60),
      });
    }
    const hasImg = !!area.querySelector('img');
    const empty = !inserted && !hasImg && !area.textContent.trim();
    const sec = area.querySelector('[data-el]');
    return { n: i + 1, folio: page.getAttribute('data-folio') || String(i + 1), inserted, empty, intendedBlank: !!(sec && sec.matches('.bk-blank')) || !!area.querySelector('.bk-blank'), blocks };
  });
}
