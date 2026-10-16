// Command palette (Ctrl/⌘ K): type to find any action, chapter or setting, and press Enter.
import { h, icon, clear, modal } from './dom.js';
import { state, setMode, selectElement } from '../core/store.js';
import { orderedElements, displayTitle } from '../core/model.js';
import { matchScore } from '../core/writing.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (sel, tries = 30) => { for (let i = 0; i < tries; i++) { const el = document.querySelector(sel); if (el) return el; await wait(80); } return null; };

/** Switch mode, then click a button found by its title (the toolbar's own action). */
const clickIn = (mode, sel) => async () => {
  if (state.mode !== mode) { setMode(mode); await wait(150); }
  (await until(sel))?.click();
};
const reviewTab = (name) => async () => {
  if (state.mode !== 'review') { setMode('review'); await wait(200); }
  [...document.querySelectorAll('.plan-head .segmented button')].find((b) => b.textContent.trim() === name)?.click();
};
const formatSection = (name) => async () => {
  if (state.mode !== 'format') { setMode('format'); await wait(300); }
  const head = [...document.querySelectorAll('.settings-pane .acc-head')].find((b) => b.textContent.includes(name));
  if (head && !head.parentElement.classList.contains('open')) head.click();
  head?.scrollIntoView({ block: 'start', behavior: 'smooth' });
};
const coverSection = (name) => async () => {
  if (state.mode !== 'cover') { setMode('cover'); await wait(300); }
  const head = [...document.querySelectorAll('.settings-pane .acc-head')].find((b) => b.textContent.includes(name));
  if (head && !head.parentElement.classList.contains('open')) head.click();
};
const settings = (tab) => () => import('./settings.js').then((m) => m.openSettings(tab));

function actions(book) {
  const write = (title, sel, ic, keys = '') => ({ group: 'Write', title, icon: ic, keys, run: clickIn('write', sel) });
  return [
    ...[['write', 'Write', 'pen-line'], ['plan', 'Plan', 'layout-grid'], ['review', 'Review', 'spell-check'], ['feedback', 'Feedback', 'messages-square'], ['format', 'Format', 'swatch-book'], ['cover', 'Cover', 'image'], ['publish', 'Publish', 'package']]
      .map(([m, t, ic]) => ({ group: 'Go to', title: t, icon: ic, run: () => setMode(m) })),
    write('Writing assistant — paraphrase, grammar, summarize', '.icon-btn[title^="Writing assistant"]', 'wand-sparkles', 'Ctrl Alt R'),
    write('Find & replace', '.icon-btn[title^="Find & replace"]', 'search', 'Ctrl F'),
    write('Track changes on/off', '.icon-btn[title^="Track changes"]', 'file-diff', 'Ctrl Shift E'),
    write('Read aloud from the cursor', '.icon-btn[title^="Read aloud"]', 'audio-lines', 'Ctrl Alt A'),
    write('Voice typing', '.mic-btn', 'mic', 'Ctrl Alt V'),
    write('Insert footnote / endnote', '.icon-btn[title^="Insert footnote"]', 'sticky-note'),
    write('Insert image', '.icon-btn[title^="Insert image"]', 'image-plus'),
    write('Scene break', '.icon-btn[title^="Scene break"]', 'asterisk', 'Ctrl Alt 8'),
    write('Page break', '.icon-btn[title^="Page break"]', 'separator-horizontal', 'Ctrl Enter'),
    write('Special characters', '.icon-btn[title^="Special characters"]', 'omega'),
    write('Note to self', '.icon-btn[title^="Note to self"]', 'message-square-dashed'),
    write('Focus mode', '.icon-btn[title^="Focus mode"]', 'focus', 'Ctrl Shift F'),
    write('Show another chapter side by side', '.icon-btn[title^="Show another chapter"]', 'columns-2'),
    { group: 'Write', title: 'Add a new chapter', icon: 'file-plus', run: async () => { const { addElement } = await import('../core/actions.js'); addElement('chapter'); setMode('write'); } },
    { group: 'Write', title: 'Notes to self & placeholders', icon: 'message-square-dashed', run: () => import('./writing-tools.js').then((m) => m.openMarkersPanel(book)) },
    { group: 'Write', title: 'Tracked changes — accept or reject', icon: 'file-diff', run: () => import('./track-ui.js').then((m) => m.openChangesPanel(book)) },
    ...['Proofread', 'Punctuation', 'Consistency', 'Typography', 'Hand formatting', 'Style sheet', 'Readability', 'Repetition', 'Originality'].map((t) => ({ group: 'Review', title: `${t}${t === 'Proofread' ? ' the whole book' : ''}`, icon: 'spell-check', run: reviewTab(t) })),
    ...['Design templates', 'Mix templates', 'My templates', 'Trim size & margins', 'Body text', 'Chapter headings', 'Running heads', 'Page numbers', 'Table of contents', 'Ebook options'].map((t) => ({ group: 'Format', title: t, icon: 'swatch-book', run: formatSection(t) })),
    { group: 'Format', title: 'Import fonts…', icon: 'plus', run: () => import('./font-import.js').then((m) => m.importFontsFlow()) },
    { group: 'Cover', title: 'Use a finished cover (import)', icon: 'upload', run: coverSection('Use a finished cover') },
    { group: 'Cover', title: 'Cover templates', icon: 'layout-template', run: coverSection('Templates') },
    { group: 'Export', title: 'Export print-ready PDF', icon: 'file-down', run: () => import('./pdf-dialog.js').then((m) => m.exportPdfDialog(book)) },
    { group: 'Export', title: 'Download EPUB', icon: 'download', run: clickIn('publish', 'button[title="Download EPUB"]') },
    { group: 'Export', title: 'Download Word document (DOCX)', icon: 'download', run: clickIn('publish', 'button[title^="Download DOCX"], button[title="DOCX"]') },
    { group: 'Export', title: 'Publish to Amazon KDP, Apple Books, IngramSpark…', icon: 'package', run: () => setMode('publish') },
    { group: 'Export', title: 'Download backup (.booky)', icon: 'file-archive', run: () => import('./library.js').then((m) => m.downloadBackup(book)) },
    { group: 'Book', title: 'Book details — title, author, ISBN', icon: 'book-open-text', run: () => import('./details.js').then((m) => m.openDetails()) },
    { group: 'Book', title: 'Marketing — blurb, keywords, categories', icon: 'book-open-text', run: () => import('./details.js').then((m) => m.openDetails('marketing')) },
    ...[['general', 'General'], ['backups', 'Backups'], ['proofing', 'Proofing & grammar engine'], ['fonts', 'Fonts'], ['translate', 'Voice, speech models & translation'], ['keys', 'Keyboard shortcuts']].map(([t, n]) => ({ group: 'Settings', title: `Settings: ${n}`, icon: 'settings', run: settings(t) })),
    { group: 'Settings', title: 'Switch theme (light / sepia / dark)', icon: 'moon', run: () => document.querySelector('.icon-btn[title^="Switch theme"]')?.click() },
  ];
}

export function openCommandPalette(book) {
  const items = [
    ...actions(book),
    ...orderedElements(book).filter((e) => e.type !== 'toc').map((e) => ({ group: 'Chapters', title: displayTitle(book, e) || 'Untitled', icon: 'file-text', run: () => { selectElement(e.id); setMode('write'); } })),
  ];
  const q = h('input.input.cp-input', { placeholder: 'Type a command or chapter…', 'aria-label': 'Command', autocomplete: 'off' });
  const list = h('div.cp-list', { role: 'listbox' });
  let shown = [], at = 0;
  const draw = () => {
    const s = q.value.trim();
    shown = items.map((it) => ({ it, score: Math.max(matchScore(it.title, s), s ? matchScore(`${it.group} ${it.title}`, s) - 5 : 0) })).filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score).slice(0, 40).map((x) => x.it);
    at = Math.min(at, Math.max(0, shown.length - 1));
    clear(list);
    let last = null;
    shown.forEach((it, i) => {
      if (!s && it.group !== last) { last = it.group; list.appendChild(h('div.cp-group', it.group)); }
      list.appendChild(h(`button.cp-item${i === at ? '.on' : ''}`, { type: 'button', role: 'option', 'aria-selected': String(i === at), on: { click: () => run(i), mousemove: () => { if (at !== i) { at = i; mark(); } } } },
        icon(it.icon || 'command', 16), h('span.grow', it.title), s ? h('small.muted', it.group) : null, it.keys ? h('span.kbd', it.keys) : null));
    });
    if (!shown.length) list.appendChild(h('div.cp-empty.muted', 'Nothing matches.'));
  };
  const mark = () => list.querySelectorAll('.cp-item').forEach((b, i) => { b.classList.toggle('on', i === at); b.setAttribute('aria-selected', String(i === at)); if (i === at) b.scrollIntoView({ block: 'nearest' }); });
  const run = (i) => { const it = shown[i]; if (!it) return; m.close(); setTimeout(() => it.run(), 60); };
  q.addEventListener('input', () => { at = 0; draw(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); at = Math.min(shown.length - 1, at + 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); at = Math.max(0, at - 1); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(at); }
  });
  const m = modal({ title: 'Command palette', width: 600, cls: 'cp-modal', body: [q, list, h('p.hint', { style: { margin: '8px 0 0' } }, '↑ ↓ to move · Enter to run · Esc to close · Ctrl/⌘ K opens this from anywhere')] });
  draw();
  setTimeout(() => q.focus(), 30);
}
