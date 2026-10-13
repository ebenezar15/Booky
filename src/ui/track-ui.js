// Track changes and the Word round-trip: the Tracked changes panel (accept / reject one or all, across the book),
// and importing a Word file returned by an editor (its comments and tracked changes come back into Booky).
import { h, icon, btn, clear, add, modal, toast, confirmDialog, pickFile, readAsArrayBuffer, timeAgo } from './dom.js';
import { state, touch, emit } from '../core/store.js';
import { orderedElements, displayTitle, uid } from '../core/model.js';
import { takeSnapshot } from '../core/actions.js';
import { acceptHtml, rejectHtml, listChanges, applyParagraphChanges, readWordParagraphs, readWordComments, placeParagraphs, countChanges } from '../core/track.js';
import { xrefsToText } from '../core/index-gen.js';
import { ensureReviews, addReviewer, locateQuote } from '../core/feedback.js';
import { getEditor } from './editor-view.js';
import { withEditor } from './feedback-actions.js';
import { changeRanges } from '../editor/extensions.js';

export const trackAuthor = (book) => state.app.authorName || book.meta.author || 'Author';

const syncEditor = (book) => { const ed = getEditor(); const el = book.elements.find((e) => e.id === state.currentId); if (ed && !ed.isDestroyed && el) el.content = ed.getHTML(); };
const refreshEditor = (book) => { const ed = getEditor(); const el = book.elements.find((e) => e.id === state.currentId); if (ed && !ed.isDestroyed && el && ed.getHTML() !== el.content) ed.commands.setContent(el.content); };

/** Accept or reject one change (id) or all changes, in any chapter. */
function resolve(book, accept, elId = null, id = null) {
  syncEditor(book);
  const ed = getEditor();
  const targets = elId ? book.elements.filter((e) => e.id === elId) : book.elements;
  let n = 0;
  for (const el of targets) {
    if (!String(el.content || '').includes('tc-')) continue;
    if (!id) takeSnapshot(el, accept ? 'Before accepting all changes' : 'Before rejecting all changes');
    if (el.id === state.currentId && ed && !ed.isDestroyed) {
      if (id) (accept ? ed.commands.acceptChange(id) : ed.commands.rejectChange(id));
      else (accept ? ed.commands.acceptAllChanges() : ed.commands.rejectAllChanges());
      el.content = ed.getHTML();
    } else el.content = accept ? acceptHtml(el.content, id) : rejectHtml(el.content, id);
    n++;
  }
  touch('elements');
  refreshEditor(book);
  return n;
}

function goToChange(elId, id) {
  withEditor(elId, (ed) => {
    const r = changeRanges(ed.state.doc, id)[0];
    if (!r) return;
    ed.chain().focus().setTextSelection(r.from).run();
    ed.view.domAtPos(r.from)?.node?.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

export function openChangesPanel(book) {
  const list = h('div.tc-list');
  const draw = () => {
    syncEditor(book);
    clear(list);
    const groups = orderedElements(book).map((el) => ({ el, changes: listChanges(el.content || '') })).filter((g) => g.changes.length);
    const total = groups.reduce((n, g) => n + g.changes.length, 0);
    if (!total) { list.appendChild(h('div.empty-state', icon('circle-check', 28), h('h3', 'No tracked changes'), h('p', 'Turn on Track changes in the editor toolbar to suggest edits, or bring back a Word file from your editor (Feedback → Import Word file).'))); return; }
    add(list, h('div.row', { style: { gap: '8px', marginBottom: '12px' } }, h('b', `${total} change${total === 1 ? '' : 's'} in ${groups.length} chapter${groups.length === 1 ? '' : 's'}`), h('span.grow'),
      btn('Accept all', { kind: 'primary', icon: 'check', onClick: async () => { if (await confirmDialog('Accept all changes?', 'Every suggested insertion stays and every suggested deletion goes, in the whole book. A snapshot of each chapter is taken first.', { okLabel: 'Accept all' })) { resolve(book, true); toast('All changes accepted', 'success'); draw(); } } }),
      btn('Reject all', { icon: 'x', onClick: async () => { if (await confirmDialog('Reject all changes?', 'Every suggestion is undone in the whole book. A snapshot of each chapter is taken first.', { okLabel: 'Reject all', danger: true })) { resolve(book, false); toast('All changes rejected', 'success'); draw(); } } })));
    for (const g of groups) {
      add(list, h('div.tc-chapter', h('b', displayTitle(book, g.el)), h('span.grow'),
        btn('Accept chapter', { cls: 'btn-sm', kind: 'ghost', onClick: () => { resolve(book, true, g.el.id); draw(); } }),
        btn('Reject chapter', { cls: 'btn-sm', kind: 'ghost', onClick: () => { resolve(book, false, g.el.id); draw(); } })));
      // pair a deletion and an insertion with the same id as one replacement
      const ids = [...new Set(g.changes.map((c) => c.id))];
      for (const id of ids) {
        const del = g.changes.find((c) => c.id === id && c.kind === 'del'), ins = g.changes.find((c) => c.id === id && c.kind === 'ins');
        const who = (del || ins);
        add(list, h('div.tc-item',
          h('div.tc-text', del ? h('del', del.text.slice(0, 160)) : null, del && ins ? icon('arrow-right', 12) : null, ins ? h('ins', ins.text.slice(0, 160)) : null),
          h('div.row', { style: { gap: '6px', marginTop: '4px' } }, h('span.small.muted', `${who.author || 'Someone'}${who.at ? ` · ${timeAgo(who.at)}` : ''}`), h('span.grow'),
            btn('Show', { cls: 'btn-sm', kind: 'ghost', onClick: () => { m.close(); goToChange(g.el.id, id); } }),
            btn('Accept', { cls: 'btn-sm', onClick: () => { resolve(book, true, g.el.id, id); draw(); } }),
            btn('Reject', { cls: 'btn-sm', onClick: () => { resolve(book, false, g.el.id, id); draw(); } }))));
      }
    }
  };
  const m = modal({ title: 'Tracked changes', width: 680, body: [list] });
  draw();
}

// ---------- Word round-trip: import ----------
const plain = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; };

/** Top-level blocks of each chapter with the text Word sees (tracked insertions left out, deletions kept). */
function chapterBlocks(book) {
  return orderedElements(book).map((el) => {
    const tpl = document.createElement('template');
    tpl.innerHTML = el.content || '';
    const blocks = [...tpl.content.children].map((n) => n.outerHTML);
    return { elId: el.id, title: el.title || '', el, html: blocks, blocks: blocks.map((b) => plain(xrefsToText(rejectHtml(b)).replace(/<span\b[^>]*data-type="(footnote|index|authornote)"[^>]*>(<\/span>)?/g, ''))) };
  });
}

export async function importWordReview(book) {
  const f = await pickFile('.docx');
  if (!f) return;
  return importWordFile(book, f);
}

/** Bring a Word file's comments and tracked changes into the book. */
export async function importWordFile(book, f) {
  const JSZip = (await import('jszip')).default;
  let zip;
  try { zip = await JSZip.loadAsync(await readAsArrayBuffer(f)); } catch { toast('This doesn’t look like a Word (.docx) file.', 'error'); return; }
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) { toast('This Word file has no document part.', 'error'); return; }
  const comments = readWordComments(await zip.file('word/comments.xml')?.async('string') || '');
  const paras = readWordParagraphs(docXml);
  syncEditor(book);
  const chapters = chapterBlocks(book);
  const { placed, unplaced } = placeParagraphs(paras, chapters);
  const R = ensureReviews(book);
  const reviewerFor = (name) => R.reviewers.find((r) => r.name.toLowerCase() === String(name || 'Word reviewer').toLowerCase()) || addReviewer(book, { name: name || 'Word reviewer', email: '', note: 'From a Word file' });
  const roundId = uid('rd_');
  R.rounds.push({ id: roundId, reviewerId: '', at: Date.now(), source: f.name });
  let nChanges = 0, nComments = 0, dupes = 0;
  const changedEls = new Set();
  const addComment = (elId, text, start, end, c) => {
    if (!c) return;
    const quote = text.slice(start, end).trim() || text.slice(start, start + 40);
    // Booky's own comments come back from Word as "Type: note" (+ "Author: reply" on the next line) — skip them
    const first = c.text.split('\n')[0].trim();
    if (R.comments.some((x) => x.elId === elId && x.note && (first === x.note || first.endsWith(`: ${x.note}`)))) { dupes++; return; }
    const rev = reviewerFor(c.author);
    R.comments.push({ id: uid('cm_'), reviewerId: rev.id, roundId, elId, sectionTitle: '', quote, prefix: text.slice(Math.max(0, start - 40), start), suffix: text.slice(end, end + 40), offset: start, type: 'comment', color: '', note: c.text, suggestion: null, createdAt: Date.parse(c.date) || Date.now(), status: 'open', reply: '' });
    nComments++;
  };
  // tracked changes and comments in paragraphs we found
  const byBlock = new Map();
  for (const p of placed) byBlock.set(`${p.elId}:${p.block}`, p);
  for (const ch of chapters) {
    let touched = false;
    const html = ch.html.map((b, i) => {
      const p = byBlock.get(`${ch.elId}:${i}`);
      if (!p) return b;
      for (const cm of p.para.comments) addComment(ch.elId, p.para.original, cm.start, cm.end, comments.get(cm.id));
      if (!p.para.changes.length) return b;
      touched = true;
      nChanges += p.para.changes.length;
      return applyParagraphChanges(rejectHtml(b), p.para.changes.map((c) => ({ ...c, id: `w${c.wid || ''}_${uid('')}`, at: Date.parse(c.date) || Date.now() })));
    });
    if (touched) { takeSnapshot(ch.el, `Before importing “${f.name}”`); ch.el.content = html.join(''); changedEls.add(ch.elId); }
  }
  // comments in paragraphs that changed by hand: find the quoted words anywhere in the book
  let lost = 0;
  for (const p of unplaced) {
    for (const cm of p.comments) {
      const c = comments.get(cm.id);
      const quote = p.original.slice(cm.start, cm.end).trim();
      const hit = quote && chapters.find((ch) => locateQuote(ch.blocks.join('\n'), { quote }));
      if (hit) addComment(hit.elId, p.original, cm.start, cm.end, c); else lost++;
    }
    lost += p.changes.length;
  }
  touch('elements'); touch('reviews');
  refreshEditor(book);
  emit('reviews');
  modal({
    title: 'Word file imported', width: 520,
    body: [
      h('p', `From “${f.name}”:`),
      h('ul',
        h('li', `${nChanges} tracked change${nChanges === 1 ? '' : 's'} in ${changedEls.size} chapter${changedEls.size === 1 ? '' : 's'} — accept or reject them in Tracked changes.`),
        h('li', `${nComments} comment${nComments === 1 ? '' : 's'} — they are in Feedback, under each reviewer’s name.${dupes ? ` (${dupes} you already had were skipped.)` : ''}`),
        lost ? h('li', `${lost} change${lost === 1 ? '' : 's'} or comment${lost === 1 ? '' : 's'} couldn’t be placed, because those paragraphs were also changed without tracking. Compare the Word file by hand for those.`) : null),
      h('p.hint', 'A snapshot of every chapter that changed was taken first (History tab).'),
    ],
    footer: [btn('Open Tracked changes', { kind: 'primary', onClick: () => { document.querySelector('.modal-overlay:last-child')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); openChangesPanel(book); } })],
  });
  return { nChanges, nComments, lost };
}

/** Pre-flight: how many suggestions are waiting. */
export const pendingChanges = (book) => countChanges(book.elements);
