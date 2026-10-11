// Book workspace: top bar with modes (Write · Plan · Format · Cover · Publish).
import { h, icon, iconBtn, clear, toast, menu, add } from './dom.js';
import { state, on, setMode, save, touch, setApp } from '../core/store.js';
import { brand, themeButton, downloadBackup } from './library.js';
import { renderBinder } from './binder.js';
import { renderEditor } from './editor-view.js';
import { renderInspector } from './inspector.js';
import { renderPlan } from './plan.js';
import { renderFormat } from './format.js';
import { renderCover } from './cover.js';
import { renderPublish } from './publish.js';
import { openDetails } from './details.js';
import { openSettings } from './settings.js';
import { bookWords } from '../core/model.js';

const MODES = [
  { id: 'write', label: 'Write', icon: 'pen-line' },
  { id: 'plan', label: 'Plan', icon: 'layout-grid' },
  { id: 'format', label: 'Format', icon: 'swatch-book' },
  { id: 'cover', label: 'Cover', icon: 'image' },
  { id: 'publish', label: 'Publish', icon: 'package' },
];

let cleanup = [];

export function renderWorkspace(root) {
  cleanup.forEach((f) => f());
  cleanup = [];
  const book = state.book;

  const saveDot = h('span.save-dot');
  const saveText = h('span', 'Saved');
  const wordsText = h('span');
  const titleEl = h('b', { title: 'Edit book details', on: { click: () => openDetails() } });
  const refreshTitle = () => {
    titleEl.textContent = book.meta.title || 'Untitled';
    wordsText.textContent = `${bookWords(book).toLocaleString()} words`;
  };
  refreshTitle();

  const modeBtns = MODES.map((m) => h('button.mode-tab', {
    type: 'button', dataset: { mode: m.id }, title: m.label,
    on: { click: () => setMode(m.id) },
  }, icon(m.icon, 16), h('span', m.label)));

  const top = h('header.topbar',
    brand(() => { save(); location.hash = ''; }),
    h('div.topbar-title', titleEl, h('small', saveDot, saveText, '·', wordsText)),
    h('nav.modes', { role: 'tablist' }, modeBtns),
    h('div.topbar-actions',
      iconBtn('book-open-text', 'Book details (title, author, ISBN…)', () => openDetails()),
      themeButton(),
      iconBtn('ellipsis-vertical', 'More', (e) => menu(e.currentTarget, [
        { label: 'Book details…', icon: 'book-open-text', onClick: () => openDetails() },
        { label: 'Download backup (.booky)', icon: 'download', onClick: () => downloadBackup(book) },
        { label: 'Settings…', icon: 'settings', onClick: () => openSettings() },
        { label: 'Keyboard shortcuts', icon: 'keyboard', onClick: () => openSettings('keys') },
        { divider: true },
        { label: 'Back to library', icon: 'house', onClick: () => { save(); location.hash = ''; } },
      ], { align: 'right' })),
    ));

  const body = h('div.workspace');
  add(root, top, body);

  let viewCleanup = [];
  const renderMode = () => {
    viewCleanup.forEach((f) => f && f());
    viewCleanup = [];
    clear(body);
    modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.mode === state.mode));
    const m = state.mode;
    if (m === 'write') {
      if (state.app.showBinder !== false) viewCleanup.push(renderBinder(body));
      viewCleanup.push(renderEditor(body));
      if (state.app.showInspector !== false) viewCleanup.push(renderInspector(body));
    } else if (m === 'plan') {
      viewCleanup.push(renderBinder(body));
      viewCleanup.push(renderPlan(body));
    } else if (m === 'format') viewCleanup.push(renderFormat(body));
    else if (m === 'cover') viewCleanup.push(renderCover(body));
    else if (m === 'publish') viewCleanup.push(renderPublish(body));
  };
  renderMode();

  const setSave = (s) => {
    saveDot.className = `save-dot ${s}`;
    saveText.textContent = { saved: 'Saved', pending: 'Editing…', saving: 'Saving…', error: 'Save failed!' }[s] || s;
  };
  cleanup.push(
    on('mode', renderMode),
    on('saving', setSave),
    on('meta', refreshTitle),
    on('changed', () => { wordsText.textContent = `${bookWords(book).toLocaleString()} words`; }),
    on('layout', renderMode),
    () => viewCleanup.forEach((f) => f && f()),
  );

  const onKey = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save().then(() => toast('Saved', 'success', 1200)); }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); if (state.mode !== 'write') setMode('write'); setTimeout(() => document.dispatchEvent(new CustomEvent('booky:focus-mode')), 30); }
    if (mod && e.key === '\\') { e.preventDefault(); setApp({ showBinder: state.app.showBinder === false }); renderMode(); }
  };
  document.addEventListener('keydown', onKey);
  cleanup.push(() => document.removeEventListener('keydown', onKey));
}

export function toggleBinder() { setApp({ showBinder: state.app.showBinder === false }); touch('layout'); }
export function toggleInspector() { setApp({ showInspector: state.app.showInspector === false }); touch('layout'); }
