// Layout check UI, shared by Format (uses the open preview) and Publish (lays the book out off-screen).
import { h, icon, btn, clear, add } from './dom.js';
import { setMode, selectElement } from '../core/store.js';
import { orderedElements, displayTitle } from '../core/model.js';
import { layoutFindings, findingCounts } from '../core/layout-check.js';
import { readLayout } from '../render/layout-read.js';
import { PrintPreview } from '../render/preview.js';

const LABELS = {
  widow: 'widow', orphan: 'orphan', 'heading-bottom': 'heading at page foot', 'scene-bottom': 'scene break at page foot',
  'short-last': 'short last page', hyphens: 'hyphen stack', loose: 'loose lines', blank: 'unexpected blank page', inserted: 'blank pages added',
};

export function checkLayout(book, doc) {
  const titles = new Map(orderedElements(book).map((e) => [e.id, displayTitle(book, e)]));
  return layoutFindings(readLayout(doc), { hyphenLimit: book.format.body.hyphenate ? +book.format.body.hyphenLimit || 0 : 0, titles });
}

const editAt = (elId) => { selectElement(elId); setMode('write'); };

/** Render findings into `out`. onPage(n) shows the page in a preview (Format); without it, only "Edit" is offered. */
export function drawLayoutReport(out, findings, { onPage } = {}) {
  clear(out);
  const counts = findingCounts(findings);
  const problems = findings.filter((f) => f.level !== 'info').length;
  add(out,
    h('p.small', { style: { margin: '6px 0' } }, problems
      ? `${problems} thing${problems === 1 ? '' : 's'} to look at: ${Object.entries(counts).filter(([k]) => k !== 'inserted' && k !== 'loose').map(([k, n]) => `${n} ${LABELS[k] || k}${n === 1 ? '' : 's'}`).join(', ')}.`
      : 'No widows, orphans, stranded headings or short pages found.'),
    h('div.checklist', findings.map((f) => h(`div.check-item.${f.level === 'bad' ? 'bad' : f.level === 'warn' ? 'warn' : 'ok'}`,
      icon(f.level === 'info' ? 'info' : 'triangle-alert', 16),
      h('div', { style: { flex: 1 } }, h('span', f.text),
        h('div.row', { style: { gap: '6px', marginTop: '4px' } },
          f.page && onPage ? btn(`Page ${f.folio}`, { cls: 'btn-sm', kind: 'ghost', onClick: () => onPage(f.page) }) : null,
          f.elId ? btn('Edit', { cls: 'btn-sm', kind: 'ghost', icon: 'pen-line', onClick: () => editAt(f.elId) }) : null))))),
  );
}

/** Lay the whole book out off-screen and check it (Publish pre-flight). */
export async function checkLayoutOffscreen(book) {
  const host = h('div', { style: { position: 'fixed', left: '-12000px', top: 0, width: '900px', height: '700px', overflow: 'hidden' }, 'aria-hidden': 'true' });
  document.body.appendChild(host);
  try {
    const pv = new PrintPreview(host);
    pv.spread = false;
    await pv.render(book, {});
    return { findings: checkLayout(book, pv.doc), pages: pv.pages };
  } finally { host.remove(); }
}

