import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalLinter } from 'harper.js';
import { binary } from 'harper.js/binary';
import { harperIssues, mergeIssues, toIssue, useLinter } from '../src/lang/harper.js';

test('Harper finds real grammar mistakes, through Booky’s adapter', async () => {
  const l = new LocalLinter({ binary });
  await l.setup();
  useLinter(l);
  const text = 'She could of gone there, but their was no time. I has a apple. The the cat sat.';
  const issues = await harperIssues(text);
  const found = issues.map((i) => `${text.slice(i.start, i.end)}→${i.replacements[0]}`);
  for (const want of ['could of→could have', 'their→there', 'has→have', 'a→an', 'The the→The']) assert.ok(found.includes(want), `${want} in ${found.join(' | ')}`);
  assert.ok(issues.every((i) => i.rule.startsWith('harper-') && !/`/.test(i.message)));
  // spelling is left to Booky's dictionary; sentence-start "Who's" is not flagged
  assert.ok(!(await harperIssues('Who’s book is this? Recieve it.')).some((i) => i.rule === 'harper-spelling'));
  // emoji before the mistake: offsets still land on the right words
  const t2 = '🙂🙂 She could of come.';
  const i2 = (await harperIssues(t2)).find((i) => i.replacements[0] === 'could have');
  assert.equal(t2.slice(i2.start, i2.end), 'could of');
  useLinter(null);
});

test('merging keeps Booky’s style notes and prefers Harper for grammar', () => {
  const own = [{ start: 0, end: 3, kind: 'grammar', rule: 'a' }, { start: 10, end: 14, kind: 'style', rule: 'b' }, { start: 20, end: 25, kind: 'grammar', rule: 'c' }];
  const hh = [{ start: 1, end: 3, kind: 'grammar', rule: 'harper-x' }, { start: 11, end: 12, kind: 'grammar', rule: 'harper-y' }];
  assert.deepEqual(mergeIssues(own, hh).map((i) => i.rule), ['harper-x', 'b', 'harper-y', 'c']);
  assert.equal(mergeIssues(own, null), own);
});

test('lint conversion', () => {
  const l = { kind: 'WordChoice', start: 4, end: 6, title: 'Word choice', message: 'Use `to` here', suggestions: [{ kind: 0, text: 'to' }, { kind: 1, text: '' }] };
  const i = toIssue('Go too it.', l, null);
  assert.deepEqual([i.kind, i.message, i.replacements], ['grammar', 'Use “to” here', ['to', '']]);
  assert.equal(toIssue('x', { ...l, kind: 'Spelling' }, null), null);
  assert.equal(toIssue('Who is it.', { kind: 'Capitalization', start: 0, end: 3, suggestions: [{ kind: 0, text: 'who' }] }, null), null);
});
