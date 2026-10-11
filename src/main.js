// Booky entry point.
import './styles/app.css';
import { installFonts } from './core/fonts.js';
import { state, loadAppSettings, on, openBook, closeBook } from './core/store.js';
import { requestPersistence } from './core/db.js';
import { renderLibrary } from './ui/library.js';
import { renderWorkspace } from './ui/workspace.js';
import { clear, toast } from './ui/dom.js';
import { initSpell } from './lang/spell.js';

const root = document.getElementById('app');

export function applyTheme() {
  document.documentElement.dataset.theme = state.app.theme || 'light';
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
  on('app', (p) => { if ('theme' in p) applyTheme(); });
  requestPersistence();
  window.addEventListener('hashchange', route);
  await route();
  // Warm up the dictionary in the background.
  setTimeout(() => initSpell(), 1200);
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !import.meta.env.DEV) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); toast(String(e.reason?.message || e.reason), 'error'); });
boot();
