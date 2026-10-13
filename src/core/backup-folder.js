// Automatic folder backups.
//   Desktop app: plain files through the app (any folder).
//   Chrome / Edge: the File System Access API; the folder handle is kept in IndexedDB and permission is
//   asked for again after a restart (browsers require a click for that).
//   Firefox / Safari: no folder access — the "not backed up" reminder is the fallback.
import { db } from './db.js';
import { state, on, emit, setApp, save } from './store.js';
import { backupFileName, backupPrefix, backupPayload, backupDue, backupsToPrune, KEEP_BACKUPS } from './backup.js';

const desktop = () => (window.bookyDesktop?.writeBackup ? window.bookyDesktop : null);

/** 'desktop' | 'fsa' | 'none' */
export const folderMode = () => (desktop() ? 'desktop' : typeof window.showDirectoryPicker === 'function' ? 'fsa' : 'none');

export const lastBackupAt = (bookId) => state.app.backupLog?.[bookId] || 0;
export const keepCount = () => Math.max(1, Math.min(100, +state.app.backupKeep || KEEP_BACKUPS));

export function recordBackup(bookId, file = '') {
  const ts = Date.now();
  setApp({ backupLog: { ...(state.app.backupLog || {}), [bookId]: ts } });
  emit('backup', { bookId, ts, file });
}

let handle = null;
async function dirHandle() {
  if (!handle) handle = await db.get('backupDir').catch(() => null);
  return handle;
}

/** { mode, configured, ready, needsPermission, name } */
export async function folderInfo() {
  const mode = folderMode();
  if (mode === 'desktop') {
    const dir = state.app.backupDir || '';
    const ready = !!dir && await desktop().checkBackupFolder(dir).catch(() => false);
    return { mode, configured: !!dir, ready, needsPermission: false, missing: !!dir && !ready, name: dir };
  }
  if (mode === 'fsa') {
    const h = await dirHandle();
    if (!h) return { mode, configured: false, ready: false, needsPermission: false, name: '' };
    const perm = await h.queryPermission({ mode: 'readwrite' }).catch(() => 'denied');
    return { mode, configured: true, ready: perm === 'granted', needsPermission: perm === 'prompt', name: h.name };
  }
  return { mode, configured: false, ready: false, needsPermission: false, name: '' };
}

/** Ask for a folder (needs a click). Returns its name, or null if cancelled. */
export async function chooseFolder() {
  if (folderMode() === 'desktop') {
    const dir = await desktop().chooseBackupFolder();
    if (!dir) return null;
    setApp({ backupDir: dir });
    return dir;
  }
  try {
    const h = await window.showDirectoryPicker({ id: 'booky-backups', mode: 'readwrite', startIn: 'documents' });
    handle = h;
    await db.set('backupDir', h);
    emit('backup-folder');
    return h.name;
  } catch (e) {
    if (e?.name === 'AbortError') return null;
    throw e;
  }
}

/** Re-grant access after a restart (needs a click). */
export async function allowFolder() {
  const h = await dirHandle();
  const ok = h && (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
  emit('backup-folder');
  return ok;
}

export async function forgetFolder() {
  handle = null;
  if (folderMode() === 'desktop') setApp({ backupDir: '' });
  else await db.set('backupDir', null);
  emit('backup-folder');
}

/** Write a backup of `book` to the folder and remove its oldest ones beyond the limit. */
export async function backupToFolder(book) {
  const milestones = await db.milestones(book.id).catch(() => []);
  const data = backupPayload(book, milestones);
  const name = backupFileName(book);
  const prefix = backupPrefix(book);
  if (folderMode() === 'desktop') {
    const r = await desktop().writeBackup({ dir: state.app.backupDir, name, data, prefix, keep: keepCount() });
    recordBackup(book.id, r.file);
    return r.file;
  }
  const dir = await dirHandle();
  if (!dir) throw new Error('No backup folder chosen');
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
  const names = [];
  for await (const n of dir.keys()) names.push(n);
  for (const old of backupsToPrune(names, prefix, keepCount())) await dir.removeEntry(old).catch(() => {});
  recordBackup(book.id, name);
  return name;
}

/** The milestones to include in a downloaded .booky file. */
export const milestonesFor = (bookId) => db.milestones(bookId).catch(() => []);

let busy = false;
async function backupIfChanged(book, { force = false } = {}) {
  if (!book || busy) return false;
  if (!force && !backupDue({ updatedAt: book.updatedAt, lastBackupAt: lastBackupAt(book.id) })) return false;
  const info = await folderInfo();
  if (!info.ready) return false;
  busy = true;
  try { await backupToFolder(book); return true; } catch (e) { console.warn('Backup failed', e); emit('backup-error', e); return false; } finally { busy = false; }
}

/** Start once: a backup every 30 minutes of editing, and when a book is closed or the app is hidden or closed. */
export function startBackups() {
  const changedSinceBackup = (b) => b && b.updatedAt > lastBackupAt(b.id);
  setInterval(() => backupIfChanged(state.book), 60 * 1000);
  // closing a book: back up what was open
  let open = null;
  on('book', () => {
    if (open && open !== state.book && changedSinceBackup(open)) backupIfChanged(open, { force: true });
    open = state.book;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && changedSinceBackup(state.book)) save().then(() => backupIfChanged(state.book, { force: true }));
  });
  desktop()?.onBeforeClose?.(async () => {
    try {
      await save();
      if (changedSinceBackup(state.book)) await backupIfChanged(state.book, { force: true });
    } finally { desktop().readyToClose(); }
  });
}
