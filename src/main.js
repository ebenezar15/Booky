// Booky entry point.
import './styles/app.css';
import { installFonts } from './core/fonts.js';
import { state, loadAppSettings, on, openBook, closeBook } from './core/store.js';
import { requestPersistence } from './core/db.js';
import { startBackups } from './core/backup-folder.js';
import { storageWarning } from './ui/backup-ui.js';
import { renderLibrary } from './ui/library.js';
import { renderWorkspace } from './ui/workspace.js';
import { clear, toast } from './ui/dom.js';
import { initSpell } from './lang/spell.js';
import { applyColors } from './core/colors.js';
import { initDesktop } from './desktop.js';

const root = document.getElementById('app');

export function applyTheme() {
  document.documentElement.dataset.theme = state.app.theme || 'light';
  document.documentElement.dataset.motion = state.app.animations === false ? 'off' : 'on';
  applyColors(state.app);
}

async function route() {
  const m = location.hash.match(/^#\/book\/(.+)$/);
  if (m) {
    if (state.book?.id !== m[1]) {
      try { await openBook(m[1]); } catch { location.hash = ''; return; }
    }
    clear(root);
    renderWorkspace(root);
  } else {
    if (state.book) closeBook();
    clear(root);
    renderLibrary(root);
  }
}

async function boot() {
  installFonts();
  await loadAppSettings();
  applyTheme();
  on('app', (p) => { if (['theme', 'colorScheme', 'customPrimary', 'customAccent', 'animations'].some((k) => k in p)) applyTheme(); if ('sidebar' in p) document.querySelectorAll('.binder').forEach((b) => b.classList.toggle('deep', p.sidebar !== 'light')); });
  requestPersistence();
  initDesktop();
  startBackups();
  setTimeout(() => storageWarning(), 3000);
  on('saving', (st) => { if (st === 'error') storageWarning(); });
  window.addEventListener('hashchange', route);
  await route();
  const splash = document.getElementById('splash');
  if (splash) setTimeout(() => { splash.classList.add('done'); setTimeout(() => splash.remove(), 500); }, 450);
  // Warm up the dictionary in the background.
  setTimeout(() => initSpell(), 1200);
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !import.meta.env.DEV) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); toast(String(e.reason?.message || e.reason), 'error'); });
boot();
