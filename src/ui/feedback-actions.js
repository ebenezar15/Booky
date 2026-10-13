// Shared actions for reviewer comments: jump to the text, apply a suggested edit, resolve, next.
import { state, touch, emit, setMode, selectElement } from '../core/store.js';
import { ensureReviews, orderedComments } from '../core/feedback.js';
import { rangeForComment } from '../editor/annotations.js';
import { toast, celebrate } from './dom.js';

export const reviewerById = (id) => ensureReviews(state.book).reviewers.find((r) => r.id === id);

export function openComments() {
  return orderedComments(state.book, ensureReviews(state.book).comments.filter((c) => c.status === 'open'));
}

export function withEditor(elId, fn) {
  const needsSwitch = state.currentId !== elId || state.mode !== 'write';
  if (state.currentId !== elId) selectElement(elId);
  if (state.mode !== 'write') setMode('write');
  setTimeout(() => emit('editor-command', fn), needsSwitch ? 450 : 0);
}

export function goToComment(c, { quiet = false } = {}) {
  state.activeComment = c.id;
  withEditor(c.elId, (ed) => {
    emit('show-tab', 'comments');
    const r = rangeForComment(ed.state.doc, c);
    if (!r) { if (!quiet) toast('The commented text has changed — the note is shown in the Comments panel.', 'warn', 3500); return; }
    ed.chain().focus().setTextSelection(r).run();
    ed.view.domAtPos(r.from)?.node?.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

export function setStatus(c, status) {
  c.status = status;
  c.resolvedAt = status === 'open' ? 0 : Date.now();
  touch('reviews');
  const all = state.book.reviews?.comments || [];
  if (status !== 'open' && all.length && all.every((x) => x.status !== 'open')) { celebrate(); toast('Every comment dealt with — well done!', 'success', 4000); }
}

export function applySuggestion(c) {
  if (c.suggestion == null) return;
  withEditor(c.elId, (ed) => {
    const r = rangeForComment(ed.state.doc, c);
    if (!r || r.partial) { toast('Couldn’t find the exact text any more — please edit it by hand.', 'warn', 3500); emit('show-tab', 'comments'); return; }
    ed.chain().focus().insertContentAt(r, c.suggestion).run();
    setStatus(c, 'resolved');
    toast('Suggestion applied and marked as done — Ctrl Z to undo', 'success');
  });
}

/** The next open comment after `c` in reading order (wraps around). */
export function nextComment(c) {
  const list = openComments();
  if (!list.length) return null;
  if (!c) return list[0];
  const all = orderedComments(state.book, ensureReviews(state.book).comments);
  const pos = all.findIndex((x) => x.id === c.id);
  return all.slice(pos + 1).find((x) => x.status === 'open') || list.find((x) => x.id !== c.id) || null;
}

export function goNext(c) {
  const n = nextComment(c);
  if (!n) { toast('All comments are done 🎉', 'success'); return; }
  goToComment(n);
}

/** Open the editor at the n-th image of a page (and optionally ask for its alt text). */
export function goToImage(elId, index, { editAlt = false } = {}) {
  withEditor(elId, (ed) => {
    let n = -1, at = -1;
    ed.state.doc.descendants((node, pos) => { if (at < 0 && node.type.name === 'image' && ++n === index) at = pos; });
    if (at < 0) { toast('That image has moved — check the page.', 'warn'); return; }
    ed.chain().focus().setNodeSelection(at).run();
    ed.view.nodeDOM(at)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    if (editAlt) {
      import('./dom.js').then(({ promptDialog }) => promptDialog('Image description', 'Alt text — a short description read aloud by screen readers', ed.state.doc.nodeAt(at)?.attrs.alt || '', { placeholder: 'e.g. A lighthouse on a rocky shore at dusk' }))
        .then((alt) => { if (alt != null) { ed.chain().setNodeSelection(at).updateAttributes('image', { alt: alt.trim() }).run(); toast('Alt text saved', 'success', 1500); emit('images-changed'); } });
    }
  });
}
