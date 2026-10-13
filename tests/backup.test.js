import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupFileName, backupPrefix, backupsToPrune, backupDue, backupAge, storageReport, backupPayload, BACKUP_EVERY_MS } from '../src/core/backup.js';
import { diffWords, diffStats } from '../src/core/diff.js';

const book = { id: 'bk_k3j9x1a2', meta: { title: 'The Lighthouse: A Novel' } };

test('backup file names are per book and sort by date', () => {
  const n = backupFileName(book, new Date(2026, 9, 13, 9, 5));
  assert.equal(n, 'the-lighthouse-a-novel-j9x1a2-2026-10-13_0905.booky');
  assert.ok(n.startsWith(backupPrefix(book)));
  assert.equal(backupFileName({ id: 'x', meta: { title: 'Café — Été' } }, new Date(2026, 0, 2, 3, 4)), 'cafe-ete-x-2026-01-02_0304.booky');
});

test('keep the newest 10 backups of each book', () => {
  const p = backupPrefix(book);
  const names = Array.from({ length: 13 }, (_, i) => `${p}2026-10-${String(i + 1).padStart(2, '0')}_1200.booky`);
  const other = 'another-book-abcdef-2026-01-01_0000.booky';
  const gone = backupsToPrune([...names.reverse(), other, `${p}notes.txt`], p, 10);
  assert.deepEqual(gone, [`${p}2026-10-01_1200.booky`, `${p}2026-10-02_1200.booky`, `${p}2026-10-03_1200.booky`]);
  assert.deepEqual(backupsToPrune(names.slice(0, 4), p, 10), []);
});

test('a backup is due after 30 minutes, only when something changed', () => {
  const t = 1_000_000_000_000;
  assert.equal(backupDue({ updatedAt: t, lastBackupAt: 0 }, t), true); // never backed up
  assert.equal(backupDue({ updatedAt: t - 10, lastBackupAt: t - 5 }, t + BACKUP_EVERY_MS), false); // no changes since
  assert.equal(backupDue({ updatedAt: t, lastBackupAt: t - 60_000 }, t), false); // too soon
  assert.equal(backupDue({ updatedAt: t, lastBackupAt: t - BACKUP_EVERY_MS }, t), true);
});

test('backup age and the 7-day reminder', () => {
  const now = Date.UTC(2026, 9, 13);
  assert.equal(backupAge(0, now).stale, true);
  assert.equal(backupAge(0, now, { since: now - 2 * 86400e3 }).stale, false); // a new book isn't nagged
  assert.equal(backupAge(0, now, { since: now - 8 * 86400e3 }).stale, true);
  assert.equal(backupAge(0, now, { hasContent: false }).stale, false);
  assert.equal(backupAge(now - 30_000, now).label, 'Backed up just now');
  assert.equal(backupAge(now - 3 * 3600e3, now).label, 'Backed up 3 h ago');
  assert.equal(backupAge(now - 6 * 86400e3, now).stale, false);
  const a = backupAge(now - 8 * 86400e3, now);
  assert.equal(a.label, 'Backed up 8 days ago');
  assert.equal(a.stale, true);
});

test('storage report levels', () => {
  assert.equal(storageReport({ usage: 50e6, quota: 10e9, persisted: true }).level, 'ok');
  assert.equal(storageReport({ usage: 50e6, quota: 10e9, persisted: false }).level, 'warn');
  assert.equal(storageReport({ usage: 7.5e9, quota: 10e9, persisted: true }).level, 'warn');
  const bad = storageReport({ usage: 990e6, quota: 1e9, persisted: true });
  assert.equal(bad.level, 'bad');
  assert.match(bad.message, /Almost out of space \(10 MB left\)/);
  assert.equal(storageReport({}).level, 'warn');
});

test('backup payload carries milestones only when there are some', () => {
  assert.equal(JSON.parse(backupPayload(book)).milestones, undefined);
  assert.equal(JSON.parse(backupPayload(book, [{ id: 'm1' }])).milestones.length, 1);
});

test('word diff', () => {
  const d = diffWords('The cat sat on the mat.', 'The black cat sat on a mat.');
  assert.deepEqual(d.map((p) => p.op + p.text), ['=The ', '+black ', '=cat sat on ', '-the', '+a', '= mat.']);
  assert.deepEqual(diffStats(d), { added: 2, removed: 1 });
  assert.deepEqual(diffWords('same text', 'same text').map((p) => p.op), ['=']);
  assert.deepEqual(diffWords('', 'new words').map((p) => p.op), ['+']);
  // a long chapter with one change in the middle stays fast and exact
  const words = Array.from({ length: 20000 }, (_, i) => `w${i}`).join(' ');
  const t0 = Date.now();
  const big = diffWords(words, words.replace('w10000', 'changed'));
  assert.ok(Date.now() - t0 < 500);
  assert.deepEqual(diffStats(big), { added: 1, removed: 1 });
});
