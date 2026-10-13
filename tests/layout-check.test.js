import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutFindings, findingCounts } from '../src/core/layout-check.js';

const p = (elId, lines, extra = {}) => ({ kind: 'p', elId, lines, hyphens: Array(lines).fill(false), loose: [], text: 'Some words here', ...extra });
const page = (n, blocks, extra = {}) => ({ n, folio: String(n), inserted: false, empty: false, intendedBlank: false, blocks, ...extra });

test('widows and orphans', () => {
  const f = layoutFindings([
    page(1, [p('a', 20), p('a', 1, { splitTo: true })]),
    page(2, [p('a', 1, { splitFrom: true }), p('a', 25)]),
  ]);
  assert.deepEqual(f.filter((x) => x.kind === 'orphan').map((x) => x.page), [1]);
  assert.deepEqual(f.filter((x) => x.kind === 'widow').map((x) => x.page), [2]);
});

test('two-line splits are fine', () => {
  const f = layoutFindings([page(1, [p('a', 20), p('a', 2, { splitTo: true })]), page(2, [p('a', 2, { splitFrom: true }), p('a', 25)])]);
  assert.equal(f.filter((x) => x.kind === 'orphan' || x.kind === 'widow').length, 0);
});

test('heading or scene break at the foot of a page', () => {
  const f = layoutFindings([
    page(1, [p('a', 20), { kind: 'heading', elId: 'a', lines: 1, text: 'The lamp room' }]),
    page(2, [p('a', 20), { kind: 'scene', elId: 'a', lines: 1, text: '* * *' }]),
    page(3, [p('a', 24)]),
  ]);
  assert.deepEqual(f.filter((x) => x.level === 'bad').map((x) => x.kind), ['heading-bottom', 'scene-bottom']);
});

test('a heading that ends a chapter is not flagged when the next page starts another one', () => {
  const f = layoutFindings([page(1, [p('a', 20), { kind: 'heading', elId: 'a', lines: 1, text: 'End' }]), page(2, [p('b', 20)])]);
  assert.equal(f.filter((x) => x.kind === 'heading-bottom').length, 0);
});

test('short last page of a chapter', () => {
  const titles = new Map([['a', 'Chapter 1']]);
  const f = layoutFindings([page(1, [p('a', 30)]), page(2, [p('a', 2)]), page(3, [p('b', 30)])], { titles });
  const s = f.find((x) => x.kind === 'short-last');
  assert.equal(s.page, 2);
  assert.match(s.text, /Chapter 1 ends with only 2 lines/);
  // one-page chapters are fine
  assert.equal(layoutFindings([page(1, [p('a', 2)])]).length, 0);
});

test('consecutive hyphens over the limit', () => {
  const hy = (arr) => p('a', arr.length, { hyphens: arr });
  const pages = [page(1, [hy([true, true, false]), hy([true, true, true, false])])];
  assert.equal(layoutFindings(pages, { hyphenLimit: 2 }).filter((x) => x.kind === 'hyphens').length, 1);
  assert.equal(layoutFindings(pages, { hyphenLimit: 3 }).filter((x) => x.kind === 'hyphens').length, 0);
  assert.equal(layoutFindings(pages, { hyphenLimit: 0 }).filter((x) => x.kind === 'hyphens').length, 0);
  // runs carry across paragraphs on a page
  assert.equal(layoutFindings([page(1, [hy([false, true, true]), hy([true, false])])], { hyphenLimit: 2 }).filter((x) => x.kind === 'hyphens').length, 1);
});

test('loose lines, blank pages and inserted blanks', () => {
  const f = layoutFindings([
    page(1, [p('a', 3, { loose: [1.2, 2.6, 0] })]),
    page(2, [], { inserted: true }),
    page(3, [], { empty: true }),
    page(4, [], { empty: true, intendedBlank: true }),
    page(5, [p('b', 10)]),
  ]);
  const c = findingCounts(f);
  assert.equal(c.loose, 1);
  assert.equal(c.blank, 1);
  assert.equal(c.inserted, 1);
  assert.match(f.find((x) => x.kind === 'inserted').text, /added 1 blank page\b/);
});

test('old books get the new typography options with safe defaults', async () => {
  const { normalizeBook } = await import('../src/core/model.js');
  const b = normalizeBook({ id: 'bk_old', meta: { title: 'Old' }, elements: [], format: { body: { font: 'Lora', size: 11, hyphenate: true } } });
  assert.equal(b.format.body.font, 'Lora');
  assert.equal(b.format.body.keepWithNext, true);
  assert.equal(b.format.body.hyphenLimit, 2);
  assert.equal(b.format.body.figures, 'auto');
  assert.equal(b.format.body.hangPunct, false);
});
