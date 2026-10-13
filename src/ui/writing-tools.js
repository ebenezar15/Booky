// Writing-flow tools: split / merge / move chapters, quick jump (Ctrl/⌘ P), notes to self and
// placeholders, read aloud, special characters, and a second chapter side by side.
import { getHTMLFromFragment, Editor } from '@tiptap/core';
import { h, icon, btn, iconBtn, clear, add, modal, toast, confirmDialog, promptDialog, select, slider, popover, closeMenu } from './dom.js';
import { state, on, emit, touch, selectElement, setMode, setApp } from '../core/store.js';
import { orderedElements, displayTitle, createElement, ELEMENT_TYPES } from '../core/model.js';
import { takeSnapshot } from '../core/actions.js';
import { titleFromHtml, mergeHtml, appendHtml, findPlaceholders, splitSentences, pickVoice, parsePageQuery, jumpCandidates, searchJump } from '../core/writing.js';
import { langInfo, isRtl } from '../core/languages.js';
import { fontStack } from '../core/fonts.js';
import { withEditor } from './feedback-actions.js';
import { baseExtensions } from '../editor/schema.js';
import { SPECIAL_CHARS, scriptChars } from '../core/special-chars.js';

const fragHtml = (editor, frag) => getHTMLFromFragment(frag, editor.schema);
const sync = (editor, el) => { if (editor && !editor.isDestroyed && el) el.content = editor.getHTML(); };

// ---------- split / merge / move ----------
export async function splitChapterHere(editor, book, el) {
  const doc = editor.state.doc;
  const $at = editor.state.selection.$from;
  // At the very start of a paragraph or heading, split before the whole block (no empty block left behind).
  const pos = $at.parentOffset === 0 && $at.depth > 0 ? $at.before() : $at.pos;
  if (pos <= 1 || pos >= doc.content.size - 1) { toast('Put the cursor where the new chapter should start (not at the very start or end).', 'warn'); return; }
  sync(editor, el);
  takeSnapshot(el, 'Before split');
  const before = fragHtml(editor, doc.cut(0, pos).content);
  const { title, html } = titleFromHtml(fragHtml(editor, doc.cut(pos).content));
  const i = book.elements.indexOf(el);
  const fresh = createElement(el.type === 'part' ? 'chapter' : el.type, { title, content: html });
  fresh.section = el.section;
  book.elements.splice(i + 1, 0, fresh);
  el.content = before;
  editor.commands.setContent(before);
  touch('elements');
  toast(`Split — “${title || 'the new chapter'}” starts after this one. Undo from History → “Before split”.`, 'success', 4500);
}

/** The next page in the same section (what "merge with next" joins). */
export const nextInSection = (book, el) => {
  const list = orderedElements(book);
  const n = list[list.indexOf(el) + 1];
  return n && n.section === el.section && n.type !== 'part' ? n : null;
};

export async function mergeWithNext(editor, book, el) {
  const next = nextInSection(book, el);
  if (!next) { toast('There is no next chapter in this part of the book to merge with.', 'warn'); return; }
  const name = displayTitle(book, next);
  if (!(await confirmDialog('Merge chapters?', `“${name}” is added to the end of this chapter and removed from the list. Both texts are kept as snapshots in this chapter’s History, so you can undo it.`, { okLabel: 'Merge' }))) return;
  if (state.currentId === el.id) sync(editor, el);
  if (state.currentId === next.id) sync(editor, next);
  takeSnapshot(el, 'Before merge');
  el.snapshots.unshift({ id: `sn_m${Date.now()}`, date: Date.now(), name: `Merged-in chapter: ${name}`, content: next.content, title: next.title });
  el.content = mergeHtml(el.content, next.content, next.title);
  book.elements.splice(book.elements.indexOf(next), 1);
  touch('elements');
  if (state.currentId === next.id) selectElement(el.id);
  else if (state.currentId === el.id && editor) editor.commands.setContent(el.content);
  toast('Chapters merged', 'success');
}

export function moveSelectionTo(editor, book, el) {
  const { from, to, empty } = editor.state.selection;
  if (empty) { toast('Select the text to move first.', 'warn'); return; }
  const targets = orderedElements(book).filter((e) => e.id !== el.id && !ELEMENT_TYPES[e.type]?.generated && e.type !== 'blank');
  let pick = targets[0]?.id;
  const m = modal({
    title: 'Move selection to…', width: 460,
    body: [
      h('p.muted.small', 'The selected text is added to the end of the chapter you pick and removed from here. Snapshots of both chapters are taken first.'),
      select(targets.map((t) => [t.id, displayTitle(book, t)]), pick, (v) => { pick = v; }, { size: 10, style: { height: '220px' } }),
    ],
    footer: [btn('Cancel', { onClick: () => m.close() }), btn('Move', { kind: 'primary', onClick: () => {
      const target = book.elements.find((e) => e.id === pick);
      if (!target) return;
      sync(editor, el);
      takeSnapshot(el, 'Before moving text out');
      takeSnapshot(target, `Before text moved in from “${displayTitle(book, el)}”`);
      target.content = appendHtml(target.content, fragHtml(editor, editor.state.doc.slice(from, to).content));
      editor.chain().focus().deleteRange({ from, to }).run();
      touch('elements');
      m.close();
      toast(`Moved to “${displayTitle(book, target)}”`, 'success');
    } })],
  });
}

// ---------- quick jump ----------
const RECENT_KEY = 'booky-recent';
export function rememberPlace(id) {
  try {
    const r = JSON.parse(sessionStorage.getItem(RECENT_KEY) || '[]').filter((x) => x !== id);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify([id, ...r].slice(0, 6)));
  } catch { /* storage off */ }
}
const recentPlaces = () => { try { return JSON.parse(sessionStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };

let pageMap = null; // { stamp, pages: [{ page: n, elId, block }] }
async function pagesFor(book) {
  if (pageMap && pageMap.stamp === book.updatedAt) return pageMap.pages;
  const host = h('div', { style: { position: 'fixed', left: '-12000px', top: 0, width: '900px', height: '700px', overflow: 'hidden' }, 'aria-hidden': 'true' });
  document.body.appendChild(host);
  try {
    const { PrintPreview } = await import('../render/preview.js');
    const pv = new PrintPreview(host);
    pv.spread = false;
    await pv.render(book, {});
    const pages = [...pv.doc.querySelectorAll('.pagedjs_page')].map((p) => {
      const sec = p.querySelector('[data-el]');
      const first = p.querySelector('.bk-content > [data-b]');
      return { page: +p.getAttribute('data-page-n') || 0, label: p.getAttribute('data-page-n'), elId: sec?.getAttribute('data-el') || '', block: sec?.hasAttribute('data-split-from') && first ? +first.getAttribute('data-b') : null };
    });
    pageMap = { stamp: book.updatedAt, pages };
    return pages;
  } finally { host.remove(); }
}

function goToBlock(elId, block) {
  withEditor(elId, (ed) => {
    let pos = 0, i = 0;
    ed.state.doc.forEach((node, offset) => { if (i++ === block) pos = offset + 1; });
    ed.chain().focus().setTextSelection(pos || 1).run();
    ed.view.domAtPos(pos || 1)?.node?.parentElement?.scrollIntoView({ block: 'center' });
  });
}

function goToHeading(elId, index) {
  withEditor(elId, (ed) => {
    let n = -1, at = 0;
    ed.state.doc.descendants((node, pos) => { if (node.type.name === 'heading' && ++n === index) { at = pos + 1; return false; } return true; });
    ed.chain().focus().setTextSelection(at || 1).run();
    ed.view.domAtPos(at || 1)?.node?.parentElement?.scrollIntoView({ block: 'center' });
  });
}

export function openQuickJump(book) {
  const cands = jumpCandidates(book, (e) => displayTitle(book, e), recentPlaces());
  const list = h('div.qj-list', { role: 'listbox' });
  const inp = h('input.input.qj-input', { placeholder: 'Jump to a chapter, heading, story-bible entry, or “p 142”…', 'aria-label': 'Quick jump' });
  let items = [], sel = 0;
  const ICON = { chapter: 'file-pen', heading: 'heading-2', bible: 'users', recent: 'clock', page: 'book-open' };
  const go = async (c) => {
    m.close();
    if (!c) return;
    if (c.kind === 'page') {
      toast(`Finding page ${c.page}…`, 'info', 1500);
      const pages = await pagesFor(book);
      const p = pages.find((x) => x.label === String(c.page));
      if (!p || !p.elId) { toast(`The book has no page ${c.page} (the last page is ${pages.filter((x) => x.page).at(-1)?.label || '?'}).`, 'warn'); return; }
      rememberPlace(p.elId);
      if (p.block == null) { selectElement(p.elId); setMode('write'); } else goToBlock(p.elId, p.block);
      return;
    }
    if (c.kind === 'bible') { setApp({ planView: 'bible' }); setMode('plan'); setTimeout(() => emit('bible-focus', c.bibleId), 200); return; }
    rememberPlace(c.elId);
    if (c.kind === 'heading') goToHeading(c.elId, c.headingIndex);
    else { selectElement(c.elId); if (state.mode !== 'write') setMode('write'); }
  };
  const draw = () => {
    const q = inp.value;
    const pg = parsePageQuery(q);
    items = pg ? [{ kind: 'page', page: pg, label: `Page ${pg}`, sub: 'Print page — typesets the book if needed' }] : searchJump(cands, q);
    sel = Math.min(sel, Math.max(0, items.length - 1));
    clear(list);
    if (!items.length) list.appendChild(h('p.muted.small', { style: { padding: '8px 12px' } }, 'Nothing found.'));
    items.forEach((c, i) => list.appendChild(h(`button.qj-item${i === sel ? '.on' : ''}`, { type: 'button', role: 'option', on: { click: () => go(c), mousemove: () => { if (sel !== i) { sel = i; draw(); } } } },
      icon(ICON[c.kind] || 'file', 15), h('span.qj-label', c.label || 'Untitled'), c.sub ? h('span.qj-sub', c.sub) : null)));
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  inp.addEventListener('input', () => { sel = 0; draw(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    if (e.key === 'Enter') { e.preventDefault(); go(items[sel]); }
  });
  const m = modal({ title: 'Quick jump', width: 560, cls: 'quick-jump', body: [inp, list] });
  draw();
  inp.focus(); // at once, so fast typing doesn't land in the editor
  setTimeout(() => inp.focus(), 60);
}

// ---------- notes to self and placeholders ----------
export async function addAuthorNote(editor) {
  const text = await promptDialog('Note to self', 'Only you see this note. It is never printed or exported.', '', { multiline: true, okLabel: 'Add note' });
  if (text && text.trim()) editor.chain().focus().insertAuthorNote(text.trim()).run();
}

function goToMarker(book, f) {
  withEditor(f.elId, (ed) => {
    let at = -1, n = -1;
    if (f.kind === 'note') {
      ed.state.doc.descendants((node, pos) => { if (node.type.name === 'authorNote' && ++n === f.index) { at = pos; return false; } return true; });
      if (at >= 0) ed.chain().focus().setNodeSelection(at).run();
    } else {
      // the n-th placeholder occurrence in the chapter's text
      const re = /\b(TK(?:TK)*|XX+)\b|\[\[[^\]\n]{0,120}\]\]|\?{3,}/g;
      ed.state.doc.descendants((node, pos) => {
        if (at >= 0 || !node.isText) return at < 0;
        for (const m of node.text.matchAll(re)) { if (++n === f.index) { at = pos + m.index; ed.chain().focus().setTextSelection({ from: at, to: at + m[0].length }).run(); break; } }
        return false;
      });
    }
    if (at >= 0) ed.view.domAtPos(at)?.node?.parentElement?.scrollIntoView({ block: 'center' });
  });
}

export function openMarkersPanel(book) {
  const found = findPlaceholders(orderedElements(book));
  const title = (id) => displayTitle(book, book.elements.find((e) => e.id === id) || {});
  const m = modal({
    title: 'Notes to self & placeholders', width: 620,
    body: [
      h('p.muted.small', 'Placeholders — TK, XX, [[…]] and ??? — must be filled in before you export. Notes to self are never printed or exported.'),
      found.length ? h('div.checklist', found.map((f) => h(`div.check-item.${f.kind === 'note' ? 'ok' : 'warn'}`, { style: { cursor: 'pointer' }, on: { click: () => { m.close(); goToMarker(book, f); } } },
        icon(f.kind === 'note' ? 'sticky-note' : 'triangle-alert', 16),
        h('div', h('b', f.kind === 'note' ? `Note: ${f.text}` : f.text), h('span', `${title(f.elId)}${f.context ? ` — …${f.context}…` : ''}`))))) : h('p', 'Nothing to do — no placeholders or notes.'),
    ],
  });
}

/** Before an export: true to go ahead. Placeholders block unless the author chooses "Export anyway". */
export async function confirmNoPlaceholders(book) {
  const ph = findPlaceholders(orderedElements(book).filter((e) => e.include?.print !== false || e.include?.ebook !== false)).filter((f) => f.kind === 'placeholder');
  if (!ph.length) return true;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { done = true; m.close(); resolve(v); };
    const m = modal({
      title: 'Placeholders left in the book', width: 520,
      body: [h('p', `${ph.length} placeholder${ph.length === 1 ? '' : 's'} (${[...new Set(ph.map((p) => p.text))].slice(0, 4).join(', ')}) still need filling in. They would be printed as they are.`)],
      footer: [btn('Show them', { onClick: () => { finish(false); openMarkersPanel(book); } }), btn('Export anyway', { kind: 'danger', onClick: () => finish(true) })],
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

// ---------- read aloud ----------
let reader = null;
export const isReading = () => !!reader;

export function stopReading() {
  if (!reader) return;
  reader.stop();
}

export function readAloud(editor, book) {
  if (reader) { reader.stop(); return; }
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { toast('This browser can’t read aloud.', 'warn'); return; }
  const lang = book.meta.language || 'en';
  const start = () => {
    const voices = synth.getVoices();
    const voice = pickVoice(voices, lang, state.app.readVoice || '');
    if (!voice) {
      toast(`No ${langInfo(lang).name || lang} voice is installed on this computer, so Booky can’t read this book aloud. Add one in your system’s speech settings (Windows: Settings → Time & language → Speech; Mac: System Settings → Accessibility → Spoken Content).`, 'warn', 9000);
      return;
    }
    // sentences from the cursor onward, mapped to document positions
    const from = editor.state.selection.from;
    const queue = [];
    editor.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) return true;
      if (pos + node.nodeSize < from) return false;
      let text = '';
      const map = [];
      node.forEach((child, off) => { if (child.isText) { for (let i = 0; i < child.text.length; i++) map.push(pos + 1 + off + i); text += child.text; } else { text += ' '; map.push(pos + 1 + off); } });
      for (const s of splitSentences(text, lang)) {
        const a = map[s.start], b = map[s.end - 1] + 1;
        if (b > from) queue.push({ from: a, to: b, text: s.text });
      }
      return false;
    });
    if (!queue.length) { toast('Nothing to read after the cursor.', 'info'); return; }
    let i = 0, paused = false, stopped = false;
    const rate = () => +state.app.readRate || 1;
    const bar = h('div.read-bar', { role: 'toolbar', 'aria-label': 'Read aloud' });
    const pauseBtn = iconBtn('pause', 'Pause', () => {
      if (paused) { synth.resume(); paused = false; } else { synth.pause(); paused = true; }
      clear(pauseBtn).appendChild(icon(paused ? 'play' : 'pause', 16));
      pauseBtn.title = paused ? 'Resume' : 'Pause';
    });
    const voiceSel = select(voices.filter((v) => String(v.lang).toLowerCase().startsWith(lang.split('-')[0].toLowerCase())).map((v) => [v.name, `${v.name}${v.localService ? '' : ' (online)'}`]), voice.name, (v) => { setApp({ readVoice: v }); restart(); }, { style: { width: '180px' } });
    const speed = slider(rate(), 0.6, 2, 0.1, (v) => { setApp({ readRate: v }); }, (v) => `${(+v).toFixed(1)}×`);
    speed.addEventListener('change', () => restart());
    add(bar, icon('audio-lines', 16), h('b', 'Reading aloud'), pauseBtn, iconBtn('x', 'Stop (or just start typing)', () => stop()), h('span.small', 'Speed'), speed, voiceSel);
    document.body.appendChild(bar);
    const say = () => {
      if (stopped || i >= queue.length) { stop(); return; }
      const s = queue[i];
      editor.commands.setReadAloudRange({ from: s.from, to: s.to });
      editor.view.domAtPos(s.from)?.node?.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const u = new SpeechSynthesisUtterance(s.text);
      u.voice = synth.getVoices().find((v) => v.name === (state.app.readVoice || voice.name)) || voice;
      u.lang = u.voice.lang;
      u.rate = rate();
      u.onend = () => { if (!stopped && reader?.u === u) { i++; say(); } };
      u.onerror = () => { if (!stopped && reader?.u === u) { i++; say(); } };
      reader.u = u;
      synth.speak(u);
    };
    const restart = () => { if (stopped) return; synth.cancel(); paused = false; setTimeout(say, 50); };
    const onType = ({ transaction }) => { if (transaction.docChanged) stop(); };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      synth.cancel();
      bar.remove();
      if (!editor.isDestroyed) editor.commands.setReadAloudRange(null);
      editor.off('update', onType);
      reader = null;
    };
    editor.on('update', onType);
    reader = { stop, u: null };
    say();
  };
  // voices load asynchronously in some browsers
  if (synth.getVoices().length) start();
  else { let ran = false; const go = () => { if (!ran) { ran = true; start(); } }; synth.addEventListener?.('voiceschanged', go, { once: true }); setTimeout(go, 800); }
}

// ---------- special characters ----------
export function specialCharPicker(anchor, editor, book) {
  const recent = state.app.recentChars || [];
  const script = scriptChars(langInfo(book.meta.language).script);
  const q = h('input.input', { placeholder: 'Search: dash, rupee, fraction, arrow…', 'aria-label': 'Search characters' });
  const grid = h('div.sc-grid');
  const insert = (ch) => {
    editor.chain().focus().insertContent(ch).run();
    setApp({ recentChars: [ch, ...recent.filter((c) => c !== ch)].slice(0, 16) });
    closeMenu();
  };
  const cell = (c) => h('button.sc-cell', { type: 'button', title: `${c.name} (U+${c.ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`, on: { click: () => insert(c.ch) } }, c.show || c.ch);
  const draw = () => {
    clear(grid);
    const s = q.value.trim().toLowerCase();
    const groups = s
      ? [['Results', [...SPECIAL_CHARS, ...script].filter((c) => c.name.toLowerCase().includes(s) || c.ch === s)]]
      : [['Recent', recent.map((ch) => [...SPECIAL_CHARS, ...script].find((c) => c.ch === ch) || { ch, name: 'Recent' })], ...Object.entries(Object.groupBy ? Object.groupBy(SPECIAL_CHARS, (c) => c.group) : SPECIAL_CHARS.reduce((m, c) => ((m[c.group] ||= []).push(c), m), {})), script.length ? [langInfo(book.meta.language).name || 'Script', script] : null].filter(Boolean);
    for (const [g, list] of groups) if (list.length) add(grid, h('div.sc-group', g), h('div.sc-row', list.map(cell)));
    if (!grid.childElementCount) grid.appendChild(h('p.muted.small', 'No characters match.'));
  };
  q.addEventListener('input', draw);
  draw();
  popover(anchor.getBoundingClientRect(), h('div.sc-picker', q, grid), { cls: 'sc-pop' });
  setTimeout(() => q.focus(), 30);
}

// ---------- second chapter side by side ----------
export function sidePane(book, currentId, { onClose } = {}) {
  let otherId = state.app.sideChapter && state.app.sideChapter !== currentId && book.elements.some((e) => e.id === state.app.sideChapter)
    ? state.app.sideChapter : (orderedElements(book).find((e) => e.id !== currentId && e.type === 'chapter') || {}).id;
  let editable = !!state.app.sideEditable;
  let ed = null;
  const lang = book.meta.language || 'en';
  const body = h('div.op-body.side-body', { lang, dir: isRtl(lang) ? 'rtl' : 'ltr', style: { fontFamily: fontStack(book.format.body.font) } });
  const pane = h('aside.original-pane.side-pane');
  const draw = () => {
    ed?.destroy(); ed = null;
    clear(body);
    const el = book.elements.find((e) => e.id === otherId);
    if (!el) { body.appendChild(h('p.muted', 'Pick a chapter to show here.')); return; }
    if (editable) {
      const host = h('div.side-editor');
      body.appendChild(host);
      ed = new Editor({ element: host, extensions: baseExtensions(), content: el.content, editorProps: { attributes: { class: 'book-prose', lang, dir: isRtl(lang) ? 'rtl' : 'ltr' } },
        onUpdate: () => { el.content = ed.getHTML(); touch('content', el.id); } });
    } else {
      body.innerHTML = el.content || '<p></p>';
      body.querySelectorAll('[data-type="authornote"]').forEach((n) => { n.textContent = '✎'; n.title = n.getAttribute('data-text'); });
    }
  };
  const chooser = select(orderedElements(book).filter((e) => e.id !== currentId && !ELEMENT_TYPES[e.type]?.generated).map((e) => [e.id, displayTitle(book, e)]), otherId, (v) => { otherId = v; setApp({ sideChapter: v }); draw(); }, { style: { maxWidth: '220px' } });
  const head = h('div.op-head', icon('columns-2', 14), chooser, h('label.row.small', { style: { gap: '4px', marginLeft: 'auto' } },
    h('input', { type: 'checkbox', checked: editable, on: { change: (e) => { editable = e.target.checked; setApp({ sideEditable: editable }); draw(); } } }), 'Editable'),
  iconBtn('x', 'Close side-by-side', () => { onClose?.(); }));
  add(pane, head, body);
  draw();
  return { el: pane, destroy: () => ed?.destroy() };
}
