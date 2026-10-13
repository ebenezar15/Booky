// Backups in the interface: the top-bar status, the reminder banner, Settings → Backups, and whole-book milestones.
import { h, icon, btn, iconBtn, clear, add, menu, toast, modal, confirmDialog, promptDialog, input, timeAgo } from './dom.js';
import { state, on, emit, touch, save, saveAppSettings } from '../core/store.js';
import { db, storageStatus, requestPersistence } from '../core/db.js';
import { backupAge, storageReport, REMIND_AFTER_DAYS } from '../core/backup.js';
import { folderMode, folderInfo, chooseFolder, allowFolder, forgetFolder, backupToFolder, lastBackupAt, keepCount } from '../core/backup-folder.js';
import { bookWords, uid, htmlToText, displayTitle, createElement } from '../core/model.js';
import { diffWords, diffStats } from '../core/diff.js';
import { takeSnapshot } from '../core/actions.js';
import { downloadBackup } from './library.js';

/** Back up the open book: to the folder when one is set up, otherwise as a download. */
export async function backupNow(book) {
  await save();
  const info = await folderInfo();
  if (info.needsPermission && !(await allowFolder())) { toast('Booky wasn’t allowed to use the backup folder — downloading instead', 'warn'); }
  if ((await folderInfo()).ready) {
    try {
      const name = await backupToFolder(book);
      toast(`Backed up to ${info.name || 'your folder'}`, 'success');
      return name;
    } catch (e) { toast(`Backup failed: ${e.message} — downloading instead`, 'error'); }
  }
  await downloadBackup(book);
  toast('Backup downloaded', 'success');
}

// ---------- top bar ----------
export function backupChip(book) {
  const el = h('button.backup-chip', { type: 'button' });
  const draw = () => {
    const age = backupAge(lastBackupAt(book.id), Date.now(), { hasContent: bookWords(book) > 0, since: book.createdAt });
    el.className = `backup-chip${age.stale ? ' stale' : ''}`;
    clear(el);
    add(el, icon(age.stale ? 'triangle-alert' : 'shield-check', 12), h('span', age.label));
    el.title = age.stale ? `No backup for ${REMIND_AFTER_DAYS}+ days — click to back up` : 'Backups';
  };
  el.addEventListener('click', () => menu(el, [
    { label: 'Back up now', icon: 'save', onClick: () => backupNow(book) },
    { label: 'Download backup (.booky)', icon: 'download', onClick: () => downloadBackup(book) },
    { label: 'Save a milestone of the whole book…', icon: 'milestone', onClick: () => saveMilestone(book) },
    { label: 'Backups & storage settings…', icon: 'settings', onClick: () => import('./settings.js').then((m) => m.openSettings('backups')) },
  ]));
  draw();
  const offs = [on('backup', draw)];
  const t = setInterval(draw, 60 * 1000);
  return { el, destroy: () => { offs.forEach((f) => f()); clearInterval(t); } };
}

// ---------- banner under the top bar ----------
export function backupBanner(book) {
  const el = h('div.backup-banner.hidden', { role: 'status' });
  const draw = async () => {
    clear(el);
    el.classList.add('hidden');
    const info = await folderInfo();
    const st = await storageStatus();
    const store = storageReport(st);
    let msg = null, actions = [];
    if (st.supported && store.level === 'bad') {
      msg = store.message;
      actions = [btn('Download backup', { cls: 'btn-sm', onClick: () => downloadBackup(book) }), btn('Storage settings', { cls: 'btn-sm', kind: 'ghost', onClick: () => import('./settings.js').then((m) => m.openSettings('backups')) })];
    } else if (info.needsPermission) {
      msg = `Booky needs your OK to keep backing up to the folder “${info.name}” (browsers ask again after a restart).`;
      actions = [btn('Allow', { cls: 'btn-sm', kind: 'primary', onClick: async () => { if (await allowFolder()) toast('Folder backups are back on', 'success'); draw(); } })];
    } else if (info.missing) {
      msg = `The backup folder “${info.name}” can’t be reached (unplugged drive?). Choose another folder.`;
      actions = [btn('Choose folder', { cls: 'btn-sm', kind: 'primary', onClick: async () => { await chooseFolder(); draw(); } })];
    } else {
      const age = backupAge(lastBackupAt(book.id), Date.now(), { hasContent: bookWords(book) > 0, since: book.createdAt });
      const snoozed = (state.app.backupSnooze?.[book.id] || 0) > Date.now();
      if (age.stale && !snoozed && !info.ready) {
        msg = lastBackupAt(book.id) ? `“${book.meta.title}” hasn’t been backed up for ${age.days} days. Your books live only in this browser — keep a copy somewhere safe.` : `“${book.meta.title}” has never been backed up. Your books live only in this browser — keep a copy somewhere safe.`;
        actions = [
          btn('Download backup', { cls: 'btn-sm', kind: 'primary', onClick: async () => { await downloadBackup(book); draw(); } }),
          folderMode() !== 'none' ? btn('Back up automatically…', { cls: 'btn-sm', onClick: async () => { if (await chooseFolder()) { await backupNow(book); } draw(); } }) : null,
          btn('Remind me tomorrow', { cls: 'btn-sm', kind: 'ghost', onClick: () => { state.app.backupSnooze = { ...(state.app.backupSnooze || {}), [book.id]: Date.now() + 864e5 }; saveAppSettings(); draw(); } }),
        ];
      }
    }
    if (!msg) return;
    add(el, icon('triangle-alert', 16), h('span', msg), h('span.grow'), ...actions.filter(Boolean));
    el.classList.remove('hidden');
  };
  draw();
  const offs = [on('backup', draw), on('backup-folder', draw)];
  return { el, destroy: () => offs.forEach((f) => f()) };
}

// ---------- Settings → Backups ----------
export function backupSettingsPanel() {
  const body = h('div');
  const draw = async () => {
    clear(body);
    const info = await folderInfo();
    const st = await storageStatus();
    const store = storageReport(st);
    const mode = folderMode();
    const folderBox = h('div.card', { style: { padding: '14px', marginBottom: '16px' } });
    if (mode === 'none') {
      add(folderBox, h('b', 'Automatic folder backups'),
        h('p.muted.small', 'This browser can’t write to a folder (Firefox and Safari don’t allow it). Booky reminds you when a book hasn’t been backed up for a week. For automatic backups, use Chrome or Edge, or the Booky desktop app.'));
    } else {
      add(folderBox, h('b', 'Automatic folder backups'),
        h('p.muted.small', `Booky writes a .booky copy of each book you edit to this folder every 30 minutes of editing and when you close it, keeping the newest ${keepCount()} per book. Choose a folder that is itself backed up — Dropbox, OneDrive, iCloud Drive, Google Drive or a USB stick.`),
        info.configured
          ? h('div.row', { style: { gap: '8px', flexWrap: 'wrap' } }, icon(info.ready ? 'folder-sync' : 'triangle-alert', 16), h('b', info.name), h('span.muted.small', info.ready ? 'On' : info.needsPermission ? 'Needs your OK' : 'Can’t be reached'),
            h('span.grow'),
            info.needsPermission ? btn('Allow', { cls: 'btn-sm', kind: 'primary', onClick: async () => { await allowFolder(); draw(); } }) : null,
            btn('Change…', { cls: 'btn-sm', onClick: async () => { await chooseFolder(); draw(); } }),
            btn('Turn off', { cls: 'btn-sm', kind: 'ghost', onClick: async () => { await forgetFolder(); draw(); } }))
          : btn('Choose backup folder…', { icon: 'folder-open', kind: 'primary', onClick: async () => { if (await chooseFolder()) { toast('Folder backups are on', 'success'); if (state.book) await backupNow(state.book); } draw(); } }),
        h('div.row', { style: { gap: '8px', marginTop: '12px' } }, h('span.small', 'Backups to keep per book'),
          input(String(keepCount()), (v) => { if (+v >= 1) { state.app.backupKeep = Math.min(100, Math.round(+v)); saveAppSettings(); } }, { type: 'number', min: 1, max: 100, style: { width: '80px' } })),
        state.book ? btn('Back up this book now', { icon: 'save', cls: 'btn-sm', onClick: () => backupNow(state.book).then(draw) }) : null);
    }
    const bar = h('div.storage-bar', h('i', { style: { width: `${Math.min(100, Math.round((store.share || 0) * 100))}%` } }));
    const storeBox = h('div.card', { style: { padding: '14px' } },
      h('b', 'Storage in this browser'),
      st.supported ? h('div', { style: { margin: '8px 0' } }, bar, h('div.small.muted', `${store.used} used${store.free ? ` · ${store.free} free` : ''}`)) : null,
      h(`div.notice${store.level === 'ok' ? '' : '.warn'}`, { style: { marginBottom: '8px' } }, icon(store.level === 'ok' ? 'shield-check' : 'triangle-alert', 16), h('span', store.message)),
      st.persisted ? null : btn('Ask the browser to protect my books', { icon: 'lock', cls: 'btn-sm', onClick: async () => {
        const ok = await requestPersistence();
        toast(ok ? 'Storage is now protected' : 'The browser said no — it usually agrees once you use Booky often or install it as an app. Keep backups on.', ok ? 'success' : 'warn', 5000);
        draw();
      } }));
    add(body, folderBox, storeBox);
  };
  draw();
  return body;
}

/** Warn once per session when storage is nearly full (called at start-up and after a failed save). */
export async function storageWarning() {
  const st = await storageStatus();
  if (!st.supported) return;
  const r = storageReport(st);
  if (r.level === 'bad') toast(r.message, 'error', 8000);
}

// ---------- whole-book milestones ----------
export async function saveMilestone(book, name) {
  name = name ?? await promptDialog('Save a milestone', 'Name this version of the whole book', `Draft ${new Date().toLocaleDateString()}`, { okLabel: 'Save milestone', placeholder: 'e.g. Sent to editor' });
  if (!name) return null;
  await save();
  const m = {
    id: uid('ms_'), bookId: book.id, name: name.trim(), date: Date.now(), words: bookWords(book),
    elements: book.elements.map((e) => ({ id: e.id, type: e.type, title: e.title, content: e.content })),
  };
  await db.putMilestone(m);
  emit('milestones', book.id);
  toast(`Milestone “${m.name}” saved`, 'success');
  return m;
}

export const listMilestones = async (bookId) => (await db.milestones(bookId).catch(() => [])).sort((a, b) => b.date - a.date);

/** Restore one chapter from a milestone (takes a snapshot first, so it can be undone). */
export function restoreChapter(book, milestone, elId) {
  const old = milestone.elements.find((e) => e.id === elId);
  if (!old) return false;
  let el = book.elements.find((e) => e.id === elId);
  if (el) { takeSnapshot(el, `Before restoring “${milestone.name}”`); el.content = old.content; el.title = old.title; }
  else { el = { ...createElement(old.type), id: old.id, title: old.title, content: old.content }; book.elements.push(el); }
  touch('elements');
  emit('replace-content');
  return true;
}

/** Compare the current chapter with its version in a milestone. */
export function compareDialog(book, milestone, elId) {
  const old = milestone.elements.find((e) => e.id === elId);
  const cur = book.elements.find((e) => e.id === elId);
  // both exist: compare paragraph by paragraph, with "restore this paragraph"
  if (old && cur) {
    import('./editing-tools.js').then((m) => m.compareDialog(book, { title: milestone.name, oldHtml: old.content, el: cur, onRestoreAll: () => { restoreChapter(book, milestone, elId); toast('Page restored', 'success'); } }));
    return;
  }
  const a = htmlToText(old?.content || ''), b = htmlToText(cur?.content || '');
  const parts = diffWords(a, b);
  const stats = diffStats(parts);
  const view = h('div.diff-view', parts.map((p) => (p.op === '=' ? p.text : h(p.op === '+' ? 'ins' : 'del', p.text))));
  const title = cur ? displayTitle(book, cur) : old?.title || 'Page';
  const m = modal({
    title: `${title}: “${milestone.name}” → now`, width: 760,
    body: [
      h('p.small.muted', !old ? 'This page did not exist at the milestone.' : !cur ? 'This page has been deleted since the milestone.' : stats.added || stats.removed ? `${stats.added.toLocaleString()} words added and ${stats.removed.toLocaleString()} removed since ${new Date(milestone.date).toLocaleDateString()}.` : 'No changes since this milestone.'),
      view,
    ],
    footer: [
      btn('Close', { onClick: () => m.close() }),
      old ? btn(cur ? 'Restore this page' : 'Bring this page back', { kind: 'primary', icon: 'rotate-ccw', onClick: async () => {
        if (!(await confirmDialog('Restore from milestone?', cur ? `“${title}” goes back to how it was at “${milestone.name}”. A snapshot of the current text is taken first (History tab), so you can undo this.` : `“${old.title || 'This page'}” is added back to the book.`, { okLabel: 'Restore' }))) return;
        restoreChapter(book, milestone, elId);
        m.close();
        toast('Page restored', 'success');
      } }) : null,
    ],
  });
}

/** Milestones list for the inspector's History tab (current page: compare / restore). */
export function milestonesPanel(book, el) {
  const box = h('div');
  const draw = async () => {
    const list = await listMilestones(book.id);
    clear(box);
    add(box,
      h('div.section-title', { style: { marginTop: '18px' } }, icon('milestone', 14), 'Whole-book milestones'),
      h('p.muted.small', 'A milestone keeps a copy of every page. Compare this page with it, or restore it.'),
      btn('Save milestone…', { icon: 'milestone', cls: 'btn-block', onClick: async () => { if (await saveMilestone(book)) draw(); } }),
      h('div', { style: { height: '10px' } }),
      list.length ? null : h('p.muted', 'No milestones yet.'),
      ...list.map((m) => h('div.snap-item',
        icon('milestone', 15),
        h('div', h('b', m.name), h('small', `${timeAgo(m.date)} · ${(m.words || 0).toLocaleString()} words`)),
        el ? iconBtn('git-compare', 'Compare this page with the milestone', () => compareDialog(book, m, el.id)) : null,
        iconBtn('ellipsis-vertical', 'More', (e) => menu(e.currentTarget, [
          { header: 'Restore one page' },
          ...m.elements.filter((x) => x.content || x.title).slice(0, 40).map((x) => ({ label: x.title || 'Untitled page', icon: book.elements.some((b) => b.id === x.id) ? 'git-compare' : 'rotate-ccw', onClick: () => compareDialog(book, m, x.id) })),
          { divider: true },
          { label: 'Delete milestone', icon: 'trash', danger: true, onClick: async () => { if (await confirmDialog('Delete milestone?', `“${m.name}” will be removed. Your book is not changed.`, { okLabel: 'Delete', danger: true })) { await db.deleteMilestone(m.id); draw(); } } },
        ], { align: 'right' })),
      )));
  };
  draw();
  const off = on('milestones', draw);
  return { el: box, destroy: off };
}
