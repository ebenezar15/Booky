// Extra behaviour when Booky runs as the installed desktop app (see desktop/preload.cjs).
import { db } from './core/db.js';
import { normalizeBook, uid } from './core/model.js';
import { importReviewFile } from './core/feedback.js';
import { toast } from './ui/dom.js';

export const desktop = globalThis.bookyDesktop || null;

export function initDesktop() {
  if (!desktop) return;
  document.documentElement.classList.add('desktop', `desktop-${desktop.platform}`);
  desktop.onMenu(async (cmd) => {
    if (cmd === 'library') location.hash = '';
    if (cmd === 'settings' || cmd === 'shortcuts') (await import('./ui/settings.js')).openSettings(cmd === 'shortcuts' ? 'keys' : 'general');
  });
  desktop.onOpenFile((f) => openFile(f).catch((e) => toast(`${f.name}: ${e.message}`, 'error', 6000)));
}

// Double-clicked .booky backups open as books; .bookyreview comment files go into their book.
async function openFile({ name, text }) {
  const data = JSON.parse(text);
  if (data.type === 'booky-review') {
    const book = await db.getBook(data.bookId);
    if (!book) throw new Error(`The book “${data.bookTitle || ''}” isn’t in your library on this computer.`);
    const b = normalizeBook(book);
    const res = importReviewFile(b, data);
    await db.putBook(b);
    toast(`${res.reviewer.name}: ${res.added} new comment(s)`, 'success', 5000);
    location.hash = `#/book/${b.id}`;
    return;
  }
  const raw = data.book || data;
  if (!raw.elements) throw new Error('This is not a Booky file.');
  const book = normalizeBook(raw);
  const existing = await db.getBook(book.id);
  if (existing) { book.id = uid('bk_'); book.meta.title += existing.meta.title === book.meta.title ? ' (restored)' : ''; }
  await db.putBook(book);
  toast(`Opened “${book.meta.title}”`, 'success');
  location.hash = `#/book/${book.id}`;
}
