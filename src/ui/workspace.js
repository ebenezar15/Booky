// Book workspace: top bar with modes (Write · Plan · Format · Cover · Publish).
import { h, icon, iconBtn, btn, clear, toast, menu, add } from './dom.js';
import { state, on, setMode, save, touch, setApp } from '../core/store.js';
import { brand, themeButton, downloadBackup } from './library.js';
import { renderBinder } from './binder.js';
import { renderEditor } from './editor-view.js';
import { renderInspector } from './inspector.js';
import { renderPlan } from './plan.js';
import { renderReview } from './review.js';
import { renderFeedback } from './feedback.js';
import { renderFormat } from './format.js';
import { renderCover } from './cover.js';
import { renderPublish } from './publish.js';
import { openDetails } from './details.js';
import { openSettings } from './settings.js';
import { appearanceButton } from './appearance.js';
import { exportPdfDialog } from './pdf-dialog.js';
import { bookWords } from '../core/model.js';
import { openTranslateDialog } from './translate.js';
import { backupChip, backupBanner, saveMilestone } from './backup-ui.js';
import { openQuickJump, openMarkersPanel } from './writing-tools.js';

const MODES = [
  { id: 'write', label: 'Write', icon: 'pen-line' },
  { id: 'plan', label: 'Plan', icon: 'layout-grid' },
  { id: 'review', label: 'Review', icon: 'spell-check' },
  { id: 'feedback', label: 'Feedback', icon: 'messages-square' },
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

  const chip = backupChip(book);
  const banner = backupBanner(book);
  const top = h('header.topbar',
    brand(() => { save(); location.hash = ''; }),
    h('div.topbar-title', titleEl, h('small', saveDot, saveText, '·', wordsText, chip.el)),
    h('nav.modes.has-pill', { role: 'tablist' }, h('span.mode-pill', { 'aria-hidden': 'true' }), modeBtns),
    h('div.topbar-actions',
      btn('Export PDF', { icon: 'file-down', kind: 'primary', cls: 'btn-sm topbar-pdf', onClick: () => exportPdfDialog(book) }),
      iconBtn('book-open-text', 'Book details (title, author, ISBN…)', () => openDetails()),
      appearanceButton(),
      themeButton(),
      iconBtn('ellipsis-vertical', 'More', (e) => menu(e.currentTarget, [
        { label: 'Quick jump…', icon: 'command', hint: 'Ctrl P', onClick: () => openQuickJump(book) },
        { label: 'Notes to self & placeholders…', icon: 'message-square-dashed', onClick: () => openMarkersPanel(book) },
        { divider: true },
        { label: 'Book details…', icon: 'book-open-text', onClick: () => openDetails() },
        { label: 'Translate into another language…', icon: 'languages', onClick: () => { save(); openTranslateDialog(book); } },
        { label: 'Download backup (.booky)', icon: 'download', onClick: () => downloadBackup(book) },
        { label: 'Save a milestone of the whole book…', icon: 'milestone', onClick: () => saveMilestone(book) },
        { label: 'Backups & storage…', icon: 'folder-sync', onClick: () => openSettings('backups') },
        { label: 'Settings…', icon: 'settings', onClick: () => openSettings() },
        { label: 'Keyboard shortcuts', icon: 'keyboard', onClick: () => openSettings('keys') },
        { divider: true },
        { label: 'Back to library', icon: 'house', onClick: () => { save(); location.hash = ''; } },
      ], { align: 'right' })),
    ));

  const body = h('div.workspace');
  add(root, top, banner.el, body);
  cleanup.push(chip.destroy, banner.destroy);

  // the highlight glides to the chosen mode
  const movePill = () => requestAnimationFrame(() => {
    const nav = top.querySelector('.modes'), pill = nav?.querySelector('.mode-pill'), on = nav?.querySelector('.mode-tab.on');
    if (!pill || !on) return;
    pill.style.width = `${on.offsetWidth}px`;
    pill.style.transform = `translateX(${on.offsetLeft - 4}px)`;
    pill.classList.add('ready');
  });
  window.addEventListener('resize', movePill);
  cleanup.push(() => window.removeEventListener('resize', movePill));
  let viewCleanup = [];
  const renderMode = () => {
    viewCleanup.forEach((f) => f && f());
    viewCleanup = [];
    clear(body);
    modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.mode === state.mode));
    movePill();
    const m = state.mode;
    if (m === 'write') {
      viewCleanup.push(renderBinder(body));
      viewCleanup.push(renderEditor(body));
      viewCleanup.push(renderInspector(body));
      applyPanels();
    } else if (m === 'plan') {
      viewCleanup.push(renderBinder(body));
      viewCleanup.push(renderPlan(body));
    } else if (m === 'review') {
      viewCleanup.push(renderBinder(body));
      viewCleanup.push(renderReview(body));
    } else if (m === 'feedback') {
      viewCleanup.push(renderFeedback(body));
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
    () => viewCleanup.forEach((f) => f && f()),
  );

  // narrow screens: the side panels are drawers over the page; a tap outside closes them
  const narrow = matchMedia('(max-width: 900px)');
  const onOutside = (e) => {
    if (!narrow.matches || e.target.closest('.modal-overlay, .menu, .popover, .toast')) return;
    for (const [sel, key] of [['.binder', 'showBinder'], ['.inspector', 'showInspector']]) {
      const panel = root.querySelector(`${sel}.open`);
      if (panel && !panel.contains(e.target) && !e.target.closest('[title^="Toggle side panel"], [title^="Toggle manuscript panel"]')) togglePanel(sel, key);
    }
  };
  const onEsc = (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || !narrow.matches || document.querySelector('.modal-overlay:not(.closing), .menu')) return;
    for (const [sel, key] of [['.binder', 'showBinder'], ['.inspector', 'showInspector']]) if (root.querySelector(`${sel}.open`)) { togglePanel(sel, key); e.preventDefault(); }
  };
  document.addEventListener('mousedown', onOutside);
  document.addEventListener('keydown', onEsc);
  cleanup.push(() => { document.removeEventListener('mousedown', onOutside); document.removeEventListener('keydown', onEsc); });

  const onKey = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); openQuickJump(book); }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save().then(() => toast('Saved', 'success', 1200)); }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); if (state.mode !== 'write') setMode('write'); setTimeout(() => document.dispatchEvent(new CustomEvent('booky:focus-mode')), 30); }
    if (mod && e.key === '\\') { e.preventDefault(); toggleBinder(); }
  };
  document.addEventListener('keydown', onKey);
  cleanup.push(() => document.removeEventListener('keydown', onKey));
}

const narrow = () => window.innerWidth <= 900;

// Wide screens: panels are shown/hidden and the choice is remembered.
// Narrow screens: panels slide over the editor only when opened.
function applyPanels() {
  document.querySelector('.workspace .binder')?.classList.toggle('hidden', state.app.showBinder === false);
  document.querySelector('.workspace .inspector')?.classList.toggle('hidden', state.app.showInspector === false);
}

function togglePanel(sel, key) {
  const el = document.querySelector(`.workspace ${sel}`);
  if (!el) return;
  if (narrow()) {
    el.classList.remove('hidden');
    const open = !el.classList.contains('open');
    document.querySelectorAll('.workspace .open').forEach((n) => n.classList.remove('open'));
    el.classList.toggle('open', open);
    return;
  }
  setApp({ [key]: state.app[key] === false });
  applyPanels();
}

export function toggleBinder() { togglePanel('.binder', 'showBinder'); }
export function toggleInspector() { togglePanel('.inspector', 'showInspector'); }
