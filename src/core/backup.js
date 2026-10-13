// Backup rules (pure, unit-tested): file names, which old backups to remove, when a backup is due,
// how long since the last one, and how full the browser's storage is.

export const BACKUP_EVERY_MS = 30 * 60 * 1000; // every 30 minutes of editing
export const KEEP_BACKUPS = 10;
export const REMIND_AFTER_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

const slug = (s) => String(s || 'untitled').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'untitled';
const pad = (n) => String(n).padStart(2, '0');

/** Every backup of a book starts with this, so books with the same title don't mix. */
export const backupPrefix = (book) => `${slug(book.meta?.title)}-${String(book.id || '').replace(/[^\w]/g, '').slice(-6)}-`;

/** e.g. "the-lighthouse-a1b2c3-2026-10-13_0930.booky" (local time, sorts by date). */
export function backupFileName(book, date = new Date()) {
  const d = new Date(date);
  return `${backupPrefix(book)}${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.booky`;
}

/** Of the files in the folder, the backups of this book to delete so only `keep` remain (oldest go first). */
export function backupsToPrune(names, prefix, keep = KEEP_BACKUPS) {
  const mine = names.filter((n) => n.startsWith(prefix) && /\d{4}-\d\d-\d\d_\d{4}(-\d+)?\.booky$/.test(n)).sort();
  return mine.slice(0, Math.max(0, mine.length - keep));
}

/** The .booky file contents (milestones travel with the book). */
export function backupPayload(book, milestones = []) {
  return JSON.stringify({ booky: 1, exportedAt: new Date().toISOString(), book, ...(milestones.length ? { milestones } : {}) }, null, 1);
}

/** Should the scheduler write a backup now? */
export function backupDue({ updatedAt = 0, lastBackupAt = 0 }, now = Date.now(), every = BACKUP_EVERY_MS) {
  if (!updatedAt || updatedAt <= lastBackupAt) return false; // nothing new since the last backup
  return now - lastBackupAt >= every;
}

/** How long since the last backup, in words: { label, days, stale } — stale after 7 days (a book never backed up: 7 days after it was created). */
export function backupAge(lastBackupAt, now = Date.now(), { hasContent = true, since = 0 } = {}) {
  if (!lastBackupAt) {
    const days = since ? Math.floor(Math.max(0, now - since) / DAY) : Infinity;
    return { label: 'Never backed up', days, stale: hasContent && days >= REMIND_AFTER_DAYS };
  }
  const ms = Math.max(0, now - lastBackupAt);
  const days = Math.floor(ms / DAY);
  const mins = Math.round(ms / 60000);
  const label = mins < 2 ? 'Backed up just now'
    : mins < 60 ? `Backed up ${mins} min ago`
    : mins < 60 * 24 ? `Backed up ${Math.round(mins / 60)} h ago`
    : days === 1 ? 'Backed up yesterday'
    : `Backed up ${days} days ago`;
  return { label, days, stale: days >= REMIND_AFTER_DAYS };
}

const size = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${Math.round(b / 1e6)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

/**
 * Storage health from navigator.storage.estimate() and persisted().
 * @returns { used, free, share, level: 'ok'|'warn'|'bad', message }
 */
export function storageReport({ usage = 0, quota = 0, persisted = false } = {}) {
  if (!quota) return { used: size(usage), free: '', share: 0, level: persisted ? 'ok' : 'warn', message: persisted ? 'Storage is protected.' : 'This browser can’t say how much space is left. Keep folder backups on.' };
  const share = usage / quota;
  const free = quota - usage;
  const level = share > 0.9 || free < 50e6 ? 'bad' : share > 0.7 || free < 200e6 || !persisted ? 'warn' : 'ok';
  const message = level === 'bad'
    ? `Almost out of space (${size(free)} left). Download backups, then delete old projects or snapshots — new changes may not save.`
    : share > 0.7 || free < 200e6
      ? `Space is getting low (${size(free)} left). Back up and tidy old projects soon.`
      : persisted
        ? 'Storage is protected: the browser won’t clear your books to free up space.'
        : 'The browser may clear site data when the disk is full. Allow persistent storage, and keep backups.';
  return { used: size(usage), free: size(free), share, level, message };
}
