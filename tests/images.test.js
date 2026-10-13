import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBook } from '../src/core/model.js';
import { collectImages, imageFindings, effectivePpi, hasColour } from '../src/core/image-check.js';

const book = (content, format = {}) => normalizeBook({
  meta: { title: 'B' }, format: { trim: '6x9', margins: { top: 0.75, bottom: 0.75, inside: 0.875, outside: 0.625 }, ...format },
  cover: { paper: 'cream' }, elements: [{ id: 'e1', type: 'chapter', title: 'One', content }],
});

test('images are collected with width and alt', () => {
  const b = book('<p>x</p><img src="data:a" alt="A map" data-width="50"><img src="data:b" data-width="page">');
  const imgs = collectImages(b);
  assert.equal(imgs.length, 2);
  assert.equal(imgs[0].alt, 'A map');
  assert.equal(imgs[0].width, '50');
  assert.equal(imgs[1].width, 'page');
});

test('effective ppi uses the placed width', () => {
  const b = book('');
  // text block = 6 - 0.875 - 0.625 = 4.5 in; at 50 % that is 2.25 in
  assert.equal(Math.round(effectivePpi(b, { width: '50' }, { w: 675, h: 500 })), 300);
  assert.equal(Math.round(effectivePpi(b, { width: '100' }, { w: 675, h: 500 })), 150);
  // full page covers 6 × 9 in: limited by the smaller ratio
  assert.equal(Math.round(effectivePpi(b, { width: 'page' }, { w: 1800, h: 2700 })), 300);
});

test('findings: low ppi, colour on cream paper, full page without bleed, missing alt', () => {
  const b = book('<img src="s1" alt="" data-width="100"><img src="s2" alt="Ok" data-width="page">');
  const dims = new Map([['s1', { w: 500, h: 400, color: true }], ['s2', { w: 1800, h: 2700, color: false }]]);
  const f = imageFindings(b, collectImages(b), dims);
  assert.ok(f.some((x) => x.kind === 'ppi' && x.level === 'bad'), 'under 150 ppi is an error');
  assert.ok(f.some((x) => x.kind === 'color' && x.level === 'warn'));
  assert.ok(f.some((x) => x.kind === 'bleed'));
  assert.ok(f.some((x) => x.kind === 'alt' && x.level === 'bad' && x.index === 0));
  const withBleed = book('<img src="s2" alt="Ok" data-width="page">', { bleed: true, bleedSize: 0.125 });
  assert.ok(!imageFindings(withBleed, collectImages(withBleed), dims).some((x) => x.kind === 'bleed'));
});

test('colour detection', () => {
  const grey = new Uint8ClampedArray([10, 10, 10, 255, 200, 201, 199, 255]);
  const red = new Uint8ClampedArray([250, 10, 10, 255, 250, 10, 10, 255]);
  assert.equal(hasColour(grey), false);
  assert.equal(hasColour(red), true);
});
