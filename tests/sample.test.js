import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBook } from '../src/core/model.js';
import { sampleBook, sampleElements, ctaHtml } from '../src/core/sample.js';

const book = normalizeBook({
  id: 'bk1', meta: { title: 'The Lighthouse', isbnEbook: '9780306406157' },
  elements: [
    { id: 't', type: 'title' }, { id: 'c', type: 'copyright' }, { id: 'toc', type: 'toc' },
    { id: 'pr', type: 'prologue', title: 'Before' },
    { id: 'p1', type: 'part', title: 'One' },
    { id: 'c1', type: 'chapter', title: 'A', content: '<p>a</p>' }, { id: 'c2', type: 'chapter', title: 'B' },
    { id: 'p2', type: 'part', title: 'Two' },
    { id: 'c3', type: 'chapter', title: 'C' }, { id: 'c4', type: 'chapter', title: 'D' },
    { id: 'ep', type: 'epilogue' }, { id: 'ack', type: 'acknowledgments' }, { id: 'ab', type: 'about-author' }, { id: 'ix', type: 'index' },
  ],
});

test('the sample has the front matter, the first N chapters and the author bio', () => {
  assert.deepEqual(sampleElements(book, 2).map((e) => e.id), ['t', 'c', 'toc', 'pr', 'p1', 'c1', 'c2', 'ab']);
  assert.deepEqual(sampleElements(book, 3).map((e) => e.id), ['t', 'c', 'toc', 'pr', 'p1', 'c1', 'c2', 'p2', 'c3', 'ab']);
  assert.deepEqual(sampleElements(book, 1).map((e) => e.id), ['t', 'c', 'toc', 'pr', 'p1', 'c1', 'ab']);
});

test('sample edition: CTA page, no ISBNs, original untouched', () => {
  const s = sampleBook(book, { chapters: 2, buyUrl: 'https://example.com/buy', newsletterUrl: 'javascript:alert(1)', message: 'Thanks!\n\nMore soon.' });
  assert.equal(s.id, 'bk1-sample');
  assert.equal(s.meta.isbnEbook, '');
  assert.equal(book.meta.isbnEbook, '9780306406157');
  const cta = s.elements.find((e) => e.id === 'el_sample_cta');
  assert.equal(cta.type, 'newsletter');
  assert.match(cta.content, /href="https:\/\/example.com\/buy"/);
  assert.doesNotMatch(cta.content, /javascript/); // unsafe links are dropped
  assert.match(cta.content, /<p class="ps-centered">Thanks!<\/p><p class="ps-centered">More soon.<\/p>/);
  assert.equal(s.format.ebook.pageList, false);
  assert.equal(book.elements.length, 14);
});

test('default CTA text', () => {
  assert.match(ctaHtml(book, {}), /sample of The Lighthouse/);
});
