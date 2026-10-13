import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixHeadingLevels, headingLevels, accessibilityMetadata } from '../src/export/a11y.js';
import { pageListFrom } from '../src/export/page-map.js';

test('headings never skip a level', () => {
  const html = '<h1 class="t">Chapter</h1><p>x</p><h3>Scene</h3><h3>Another</h3><h2>Part</h2><h4>Deep</h4>';
  const fixed = fixHeadingLevels(html);
  assert.deepEqual(headingLevels(fixed), [1, 2, 2, 2, 3]);
  assert.match(fixed, /<h1 class="t">Chapter<\/h1>/);
  assert.deepEqual(headingLevels(fixHeadingLevels('<h3>Only</h3>')), [1]);
});

test('accessibility metadata only claims conformance when the checks pass', () => {
  const ok = accessibilityMetadata({ images: 2, imagesWithAlt: 2, toc: true, pageList: true, lang: 'en' });
  assert.equal(ok.conforms, true);
  assert.match(ok.meta, /alternativeText/);
  assert.match(ok.meta, /printPageNumbers/);
  assert.match(ok.meta, /dcterms:conformsTo">EPUB Accessibility 1.1 - WCAG 2.1 Level AA/);
  assert.match(ok.meta, /accessModeSufficient">textual</);
  const missing = accessibilityMetadata({ images: 2, imagesWithAlt: 1, toc: true, lang: 'en' });
  assert.equal(missing.conforms, false);
  assert.doesNotMatch(missing.meta, /conformsTo|alternativeText/);
  assert.match(missing.meta, /accessModeSufficient">textual,visual</);
  const noImages = accessibilityMetadata({ images: 0, imagesWithAlt: 0, toc: true, lang: 'ta' });
  assert.doesNotMatch(noImages.meta, /accessMode">visual/);
  assert.equal(noImages.conforms, true);
});

test('page list: blank pages skipped, ids unique', () => {
  const list = pageListFrom([
    { label: 'i', anchor: 's-a', block: null }, { label: 'ii', anchor: null }, { label: '1', anchor: 's-b', block: null },
    { label: '2', anchor: 's-b', block: 4 }, { label: '2', anchor: 's-b', block: 9 },
  ]);
  assert.deepEqual(list.map((x) => x.id), ['pg-i', 'pg-1', 'pg-2', 'pg-2-b']);
  assert.equal(list[2].block, 4);
});
