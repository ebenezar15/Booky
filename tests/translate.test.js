import { test } from 'node:test';
import assert from 'node:assert/strict';
import { protectPlaceholders, restorePlaceholders, batchBlocks, hasText, prepareTranslation, translationProgress, translateFragments } from '../src/lang/translate.js';

test('placeholders survive a round trip', () => {
  const html = '<p>© {{year}} {{author}}. All rights reserved.</p>';
  const p = protectPlaceholders(html);
  assert.match(p, /translate="no"/);
  assert.equal(restorePlaceholders(p), html);
  assert.equal(restorePlaceholders('<p>{{ year }}</p>'), '<p>{{year}}</p>');
});

test('batches respect the size limit and keep order', () => {
  const b = batchBlocks(['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40)], 90);
  assert.deepEqual(b, [[0, 1], [2]]);
});

test('hasText ignores markup-only and placeholder-only blocks', () => {
  assert.equal(hasText('<div data-type="scene-break"></div>'), false);
  assert.equal(hasText('<p>{{isbn}}</p>'), false);
  assert.equal(hasText('<p>வணக்கம்</p>'), true);
});

test('prepareTranslation keeps originals and makes a new project', () => {
  const book = { id: 'bk_1', meta: { title: 'Sea', language: 'en' }, elements: [{ id: 'e1', type: 'chapter', title: 'One', subtitle: '', content: '<p>Hi</p>', snapshots: [1] }], reviews: { comments: [1] } };
  const t = prepareTranslation(book, 'ta', 'claude');
  assert.notEqual(t.id, book.id);
  assert.equal(t.translation.target, 'ta');
  assert.equal(t.elements[0].source.content, '<p>Hi</p>');
  assert.equal(t.elements[0].trStatus, 'pending');
  assert.deepEqual(t.elements[0].snapshots, []);
  assert.equal(t.reviews.comments.length, 0);
  assert.equal(book.elements[0].source, undefined);
  assert.equal(translationProgress(t).pending, 1);
});

test('manual provider passes text through untouched', async () => {
  const out = await translateFragments(['<p>Hello {{author}}</p>', ''], { provider: 'manual', source: 'en', target: 'ta', keys: {} });
  assert.deepEqual(out, ['<p>Hello {{author}}</p>', '']);
});
