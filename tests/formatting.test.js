import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charStylesCss, paraStylesCss, noteMarker, figureLabel, linkForPrint, printableUrl, verseNumbers, validateCss, listOverrides, newStyleId, FORMAT_DEFAULTS } from '../src/core/formatting.js';

test('character and paragraph style CSS', () => {
  const css = charStylesCss([{ id: 'foreign', italic: true }, { id: 'textmsg', font: 'Inter', size: 0.9 }], (f) => `"${f}", sans-serif`);
  assert.match(css, /\.cs-foreign \{ font-style: italic; \}/);
  assert.match(css, /\.cs-textmsg \{ font-family: "Inter", sans-serif; font-size: 0.9em; \}/);
  const p = paraStylesCss({ verse: { above: 1, align: 'center' } }, [{ id: 'poem-title', basedOn: 'display', size: 1.4 }]);
  assert.match(p, /\.bk-content \.ps-verse \{ margin-top: 1em !important; text-align: center !important; \}/);
  assert.match(p, /\.ps-poem-title \{ font-size: 1.4em; \}/);
  assert.equal(newStyleId('Poem title', ['poem-title']), 'poem-title-2');
});

test('note markers, figure labels', () => {
  assert.deepEqual([1, 2, 6, 7, 8].map((n) => noteMarker(n, 'symbol')), ['*', '†', '¶', '**', '††']);
  assert.equal(noteMarker(3), '3');
  assert.equal(figureLabel({ numbering: 'chapter' }, 3, 2, 9), 'Figure 3.2');
  assert.equal(figureLabel({ numbering: 'book', label: 'Plate' }, 3, 2, 9), 'Plate 9');
  assert.equal(figureLabel({ numbering: 'none' }, 3, 2, 9), '');
});

test('links in print', () => {
  assert.equal(printableUrl('https://example.com/buy/'), 'example.com/buy');
  assert.deepEqual(linkForPrint('https://example.com/buy', 'the shop', 'footnote'), { html: 'the shop', note: 'example.com/buy' });
  assert.equal(linkForPrint('https://example.com', 'the shop', 'brackets').html, 'the shop <span class="bk-url">(example.com)</span>');
  assert.equal(linkForPrint('https://example.com', 'the shop', 'text').html, 'the shop');
  assert.equal(linkForPrint('https://example.com', 'example.com', 'brackets').html, 'example.com'); // the URL is already the text
  assert.match(linkForPrint('https://example.com', 'shop', 'qr', () => '<svg/>').html, /bk-qr.*<svg\/>/);
  assert.match(linkForPrint('https://example.com', 'shop', 'qr', null).html, /\(example.com\)/); // no encoder: brackets
  assert.equal(linkForPrint('#s-e4', 'chapter 4', 'brackets').html, 'chapter 4'); // internal links stay
});

test('verse numbers and CSS validation', () => {
  assert.deepEqual(verseNumbers(12, 5), [5, 10]);
  assert.deepEqual(verseNumbers(12, 0), []);
  assert.equal(validateCss('p { color: red; }').ok, true);
  assert.match(validateCss('p { color: red;').error, /never closed/);
  assert.match(validateCss('p { color: red; }}').error, /extra/);
  assert.match(validateCss('/* oops\np{}').error, /comment/);
  assert.match(validateCss('p:after { content: "x; }').error, /string/);
  assert.equal(validateCss('</style><script>').ok, false);
  assert.equal(validateCss('@import url(x.css); p{}').css.trim(), 'p{}');
});

test('override list', () => {
  const els = [{ id: 'a', tracking: -5, content: '<p data-keep-next="true">x</p><p data-tracking="-8" data-keep-lines="true">y</p><p data-only="print">z</p>' }];
  assert.deepEqual(listOverrides(els).map((o) => `${o.kind}@${o.index}`), ['chapter-tracking@-1', 'keep-next@0', 'keep-lines@1', 'tracking@1', 'only@2']);
});

test('old books get the new formatting defaults', async () => {
  const { normalizeBook } = await import('../src/core/model.js');
  const b = normalizeBook({ id: 'x', meta: {}, elements: [], format: { body: { font: 'Lora' } } });
  assert.equal(b.format.printLinks, 'footnote');
  assert.equal(b.format.notes.placement, 'chapter');
  assert.equal(b.format.charStyles.length, FORMAT_DEFAULTS.charStyles.length);
  assert.deepEqual(b.format.customCss, { print: '', ebook: '' });
});
