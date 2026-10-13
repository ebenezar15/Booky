// Back-of-book index and cross-references: "Add to index…", "Insert cross-reference…" and the Index panel.
import { h, btn, modal, field, input, select, toast, confirmDialog, promptDialog, clear } from './dom.js';
import { state, touch } from '../core/store.js';
import { orderedElements, chapterLabel, computeNumbers, escapeHtml } from '../core/model.js';
import { collectIndexMarks, termCounts, collectXrefs, xrefResolves, markAllInHtml } from '../core/index-gen.js';

const newId = () => Math.random().toString(36).slice(2, 10);
const escAttr = (s) => escapeHtml(String(s)).replace(/"/g, '&quot;');
const plain = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();

/** Save the open chapter so book-wide edits see the latest text. */
function flush(editor) {
  const el = state.book.elements.find((e) => e.id === state.currentId);
  if (editor && !editor.isDestroyed && el) el.content = editor.getHTML();
}

/** Ask for the index entry for the selection and insert a mark at its start. */
export function addToIndexDialog(editor, book) {
  const sel = editor.state.selection;
  const selected = sel.empty ? '' : editor.state.doc.textBetween(sel.from, sel.to, ' ').trim().slice(0, 80);
  const terms = termCounts(collectIndexMarks(book.elements), book.meta.language).map((t) => t.term);
  const listId = `ix-terms-${newId()}`;
  const v = { term: selected, sub: '', see: '', seeAlso: '' };
  const termIn = input(v.term, (x) => { v.term = x; }, { list: listId, placeholder: 'e.g. Lighthouses' });
  const ok = () => {
    if (!v.term.trim()) { toast('Type the index term', 'warn'); return; }
    editor.chain().focus().setTextSelection(sel.from).insertIndexMark({ term: v.term.trim(), sub: v.sub.trim(), see: v.see.trim(), seeAlso: v.seeAlso.trim() }).run();
    m.close();
    toast(`Added “${v.term.trim()}” to the index`, 'success');
  };
  const m = modal({
    title: 'Add to index', width: 480,
    body: [
      h('datalist', { id: listId }, terms.map((t) => h('option', { value: t }))),
      field('Term', termIn, 'The word or phrase readers will look up. Reuse an existing term to add another page to it.'),
      field('Sub-entry (optional)', input('', (x) => { v.sub = x; }, { placeholder: 'e.g. history of' })),
      h('div.grid-2',
        field('See (optional)', input('', (x) => { v.see = x; }, { list: listId, placeholder: 'Send readers to another term' })),
        field('See also (optional)', input('', (x) => { v.seeAlso = x; }, { list: listId }))),
      h('p.hint', 'The printed Index page lists each term with its page numbers. Add an “Index” page from the left-hand panel if your book does not have one.'),
    ],
    footer: [btn('Cancel', { onClick: () => m.close() }), btn('Add to index', { kind: 'primary', onClick: ok })],
  });
  termIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
}

/** Everything a cross-reference can point at: chapters, headings and figures. */
export function xrefTargets(book) {
  const nums = computeNumbers(book);
  const out = [];
  for (const el of orderedElements(book)) {
    const name = [chapterLabel(book, el, nums), el.title].filter(Boolean).join(': ') || 'Untitled page';
    out.push({ target: `s:${el.id}`, group: name, label: name, text: el.title || name });
    (String(el.content || '').match(/<h[1-4]\b[^>]*>[\s\S]*?<\/h[1-4]>/gi) || []).forEach((hd) => {
      const t = plain(hd);
      if (t) out.push({ target: `h:${el.id}:${t}`, group: name, label: `\u2003${t}`, text: t });
    });
    let n = 0;
    (String(el.content || '').match(/<img\b[^>]*>/gi) || []).forEach((img) => {
      if (/bk-scene-img/.test(img)) return;
      const alt = (img.match(/\salt="([^"]*)"/i) || [])[1] || '';
      out.push({ target: `f:${el.id}:${n}`, group: name, label: `\u2003Figure ${n + 1}${alt ? ` — ${plain(alt)}` : ''}`, text: alt ? plain(alt) : `figure ${n + 1}` });
      n++;
    });
  }
  return out;
}

export function crossRefDialog(editor, book) {
  const targets = xrefTargets(book);
  if (!targets.length) { toast('Add some chapters first', 'warn'); return; }
  let pick = targets[0];
  let label = pick.text;
  const labelIn = input(label, (x) => { label = x; });
  const sel = select(targets.map((t, i) => [String(i), t.label]), '0', (i) => { pick = targets[+i]; label = pick.text; labelIn.value = label; }, { size: 10, style: { height: '240px', padding: '4px' } });
  const ok = () => {
    editor.chain().focus().insertCrossRef({ target: pick.target, label: label.trim() || pick.text }).run();
    m.close();
  };
  const m = modal({
    title: 'Insert cross-reference', width: 520,
    body: [
      field('Refer to', sel),
      field('Name in the ebook', labelIn, 'Print shows “see page 42”; the ebook shows this name as a link.'),
    ],
    footer: [btn('Cancel', { onClick: () => m.close() }), btn('Insert', { kind: 'primary', onClick: ok })],
  });
}

/** Cross-references whose target was deleted or renamed: [{ elId, title, label }]. */
export function brokenXrefs(book) {
  return collectXrefs(book.elements).filter((x) => !xrefResolves(book.elements, x.target))
    .map((x) => ({ ...x, title: book.elements.find((e) => e.id === x.elId)?.title || 'Untitled page' }));
}

// ---------- book-wide edits of index marks ----------
const markRe = /<span\b[^>]*data-type="index"[^>]*>(?:<\/span>)?/gi;
const termOf = (tag) => plain((tag.match(/\sdata-term="([^"]*)"/i) || [])[1] || '');

/** After a book-wide edit: show the open chapter's new text in the editor (its autosave would otherwise write the old text back). */
function refresh(book, editor) {
  touch('elements');
  const cur = book.elements.find((e) => e.id === state.currentId);
  if (editor && !editor.isDestroyed && cur && cur.content !== editor.getHTML()) editor.commands.setContent(cur.content);
}

function editMarks(book, fn, editor) {
  flush(editor);
  let changed = 0;
  for (const el of book.elements) {
    const next = String(el.content || '').replace(markRe, (tag) => { const r = fn(tag, termOf(tag)); if (r !== tag) changed++; return r; });
    if (next !== el.content) el.content = next;
  }
  if (changed) refresh(book, editor);
  return changed;
}

export const renameTerm = (book, from, to, editor) => editMarks(book, (tag, t) => (t === from ? tag.replace(/\sdata-term="[^"]*"/i, ` data-term="${escAttr(to)}"`) : tag), editor);
export const deleteTerm = (book, term, editor) => editMarks(book, (tag, t) => (t === term ? '' : tag), editor);

export function markAll(book, word, term = word, editor = null) {
  flush(editor);
  let added = 0;
  for (const el of book.elements) {
    if (['index', 'toc', 'copyright'].includes(el.type)) continue;
    const r = markAllInHtml(el.content || '', word, term);
    if (r.added) { el.content = r.html; added += r.added; }
  }
  if (added) refresh(book, editor);
  return added;
}

export function openIndexPanel(book, editor) {
  flush(editor);
  const list = h('div.ix-panel-list');
  const draw = () => {
    clear(list);
    const terms = termCounts(collectIndexMarks(book.elements), book.meta.language);
    if (!terms.length) { list.appendChild(h('p.muted', 'No index entries yet. Select a word in the text, right-click and choose “Add to index…”, or use “Mark all” below.')); return; }
    terms.forEach(({ term, count }) => list.appendChild(h('div.ix-row',
      h('span.ix-term', term), h('span.muted.small', `${count} ${count === 1 ? 'place' : 'places'}`),
      h('span.grow'),
      btn('Rename', { cls: 'btn-sm', kind: 'ghost', title: 'Rename, or type an existing term to merge', onClick: async () => {
        const to = await promptDialog('Rename term', 'New name (type another term to merge the two)', term, { okLabel: 'Rename' });
        if (to && to.trim() && to.trim() !== term) { renameTerm(book, term, to.trim(), editor); draw(); }
      } }),
      btn('Mark all', { cls: 'btn-sm', kind: 'ghost', title: 'Add this term wherever the word appears in the book', onClick: () => { const n = markAll(book, term, term, editor); toast(n ? `Marked ${n} more ${n === 1 ? 'place' : 'places'}` : 'No unmarked places found', n ? 'success' : 'info'); draw(); } }),
      btn('Delete', { cls: 'btn-sm', kind: 'ghost', onClick: async () => { if (await confirmDialog('Delete index term', `Remove “${term}” from all ${count} places?`, { okLabel: 'Delete', danger: true })) { deleteTerm(book, term, editor); draw(); } } }),
    )));
  };
  let word = '';
  const wordIn = input('', (x) => { word = x; }, { placeholder: 'Word or phrase' });
  const broken = brokenXrefs(book);
  modal({
    title: 'Index', width: 620,
    body: [
      list,
      h('div.section-title', { style: { marginTop: '16px' } }, 'Mark all occurrences'),
      h('div.row', { style: { gap: '8px' } }, wordIn, btn('Mark all', { kind: 'primary', onClick: () => {
        if (!word.trim()) return;
        const n = markAll(book, word.trim(), word.trim(), editor);
        toast(n ? `Marked ${n} ${n === 1 ? 'place' : 'places'}` : `“${word.trim()}” was not found`, n ? 'success' : 'warn');
        draw();
      } })),
      broken.length ? h('div', { style: { marginTop: '16px' } }, h('div.section-title', 'Broken cross-references'),
        broken.map((b) => h('p.small', `${b.title}: “${b.label || b.target}” points to a page, heading or figure that no longer exists.`))) : null,
      h('p.hint', { style: { marginTop: '12px' } }, 'Page numbers are filled in when the book is laid out — check them in the print preview.'),
    ],
  });
  draw();
}
