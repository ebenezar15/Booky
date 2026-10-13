import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBook } from '../src/core/model.js';
import { keywordReport, contributorList } from '../src/core/metadata.js';

test('old books (before the new metadata fields) still open with defaults', () => {
  const old = { id: 'bk_old', meta: { title: 'Old', author: 'A', isbnPrint: '9780306406157' }, elements: [{ id: 'e1', type: 'chapter', title: 'One', content: '<p>x</p>' }], cover: { back: { showBarcodeBox: true } } };
  const b = normalizeBook(old);
  assert.equal(b.meta.isbnHardcover, '');
  assert.equal(b.meta.bisac, '');
  assert.equal(b.meta.ageMin, '');
  assert.equal(b.meta.contributors, '');
  assert.equal(b.cover.back.barcodeMode, 'barcode');
  assert.equal(b.cover.back.addon, true);
  assert.equal(b.meta.isbnPrint, '9780306406157');
});

test('keywords: KDP limit of 7 and 50 characters each', () => {
  const r = keywordReport('sea, storm; lighthouse\nfamily saga, coastal mystery, grief, island, ' + 'x'.repeat(55));
  assert.equal(r.list.length, 8);
  assert.equal(r.over, 1);
  assert.equal(r.long.length, 1);
});

test('contributors come with roles', () => {
  const c = contributorList({ author: 'Ann', editor: 'Bo', translator: 'Cy', contributors: 'Priya Raman — Foreword\nArun K - Photographs\nJust A Name' });
  assert.deepEqual(c, [['Author', 'Ann'], ['Editor', 'Bo'], ['Translator', 'Cy'], ['Foreword', 'Priya Raman'], ['Photographs', 'Arun K'], ['Contributor', 'Just A Name']]);
});
