import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, cleanHtml, indicFindings, applyIndicFix, paragraphDiff, restoreParagraph } from '../src/core/typography.js';
import { consistencyFindings, applyFix, editDistance, numberToWords, replaceInHtmlText, normalizeStyleSheet, styleSheetHtml } from '../src/core/consistency.js';

const NB = ' ';

test('typographic clean-up', () => {
  assert.equal(cleanText(`"Hello," she said. 'It's the '90s, isn't it?'`), '“Hello,” she said. ‘It’s the ’90s, isn’t it?’');
  assert.equal(cleanText('Wait... what?  Yes .'), 'Wait… what? Yes.');
  assert.equal(cleanText('It weighs 5 kg and Dr. Rao read Chapter 12 on page 4.'), `It weighs 5${NB}kg and Dr.${NB}Rao read Chapter${NB}12 on page${NB}4.`);
  assert.equal(cleanText('Oui ! Vraiment ?', '', { lang: 'fr' }), 'Oui ! Vraiment ?');
  assert.equal(cleanText('James\' book'), 'James’ book');
  // quotes continue across inline tags in the same paragraph
  const r = cleanHtml('<p>"Hi <em>there</em>," he said.</p><p>"Two"</p>');
  assert.equal(r.html, '<p>“Hi <em>there</em>,” he said.</p><p>“Two”</p>');
  assert.ok(r.changes.length >= 2);
  assert.equal(cleanHtml('<p>Tom &amp; Jerry</p>').html, '<p>Tom &amp; Jerry</p>');
});

test('style-sheet consistency: spelling variety, forms, names', () => {
  const texts = [{ elId: 'a', text: 'Her favourite colour was grey. She sent an e-mail.' }, { elId: 'b', text: 'The color of the email. Meenatchi waved. Meenakshi smiled.' }];
  const f = consistencyFindings(texts, { variety: 'uk' }, { names: ['Meenakshi'] });
  const ids = f.map((x) => x.id);
  assert.ok(ids.includes('sp:color'), ids.join());
  assert.ok(!ids.includes('sp:colour'));
  const form = f.find((x) => x.id === 'form:email');
  assert.equal(form.preferred, 'e-mail'); // the first use wins when the word list is silent
  assert.deepEqual(form.variants, ['email']);
  const name = f.find((x) => x.kind === 'name');
  assert.deepEqual(name.variants, ['Meenatchi']);
  // the word list wins over the first use
  const g = consistencyFindings(texts, { variety: 'uk', words: [{ word: 'email' }] });
  assert.equal(g.find((x) => x.id === 'form:email').preferred, 'email');
  // US book flags UK spellings
  assert.ok(consistencyFindings(texts, { variety: 'us' }).some((x) => x.id === 'sp:colour'));
});

test('consistency: numbers, dashes, ellipses, serial comma, quotes', () => {
  const texts = [{ elId: 'a', text: 'She had 3 cats, 12 dogs and 250 hens - all fed... at 5 km away, 20% happy. "Hi." She loved cats, dogs and hens.' }];
  const f = consistencyFindings(texts, { numbers: 'words-100', dash: 'em-closed', ellipsis: 'char', serialComma: true, percent: 'percent' });
  const by = Object.fromEntries(f.map((x) => [x.id, x]));
  assert.deepEqual(by.numbers.variants, ['3', '12']);
  assert.ok(by.dash && by.ellipsis && by.serial && by.percent && by['straight-quotes']);
  assert.equal(applyFix('She had 3 cats and 42 dogs, 250 hens.', by.numbers.fix), 'She had three cats and forty-two dogs, 250 hens.');
  assert.equal(applyFix('fed... then', by.ellipsis.fix), 'fed… then');
  assert.equal(applyFix('cats, dogs and hens', by.serial.fix), 'cats, dogs, and hens');
  assert.equal(applyFix('word - word', by.dash.fix), 'word—word');
  assert.equal(applyFix('The Color', { from: '(?<![\\p{L}\\p{N}-])color(?![\\p{L}\\p{N}-])', flags: 'giu', to: 'colour' }), 'The Colour');
});

test('helpers', () => {
  assert.equal(editDistance('Meenakshi', 'Meenatchi'), 2);
  assert.equal(numberToWords(42), 'forty-two');
  assert.equal(numberToWords(100), 'one hundred');
  assert.equal(replaceInHtmlText('<a href="color">color</a>', (t) => t.replace('color', 'colour')), '<a href="color">colour</a>');
  assert.equal(normalizeStyleSheet(undefined).variety, 'us');
  assert.match(styleSheetHtml({ meta: { title: 'T' } }, { words: [{ word: 'Mum', note: 'capitalised as a name' }] }), /Mum<\/b> <small>— capitalised as a name/);
});

test('Indian-language checks', () => {
  const decomposed = 'கொ'.normalize('NFD'); // ொ decomposes into ெ + ா
  const texts = [{ elId: 'a', text: `அவள் ${decomposed}டு வந்தாள். கடol ‌அலை நாா ` }];
  const f = indicFindings(texts, 'ta');
  const kinds = f.map((x) => x.kind);
  assert.ok(kinds.includes('nfc'), kinds.join());
  assert.ok(kinds.includes('mixed'));
  assert.ok(kinds.includes('zw'));
  assert.ok(kinds.includes('doubled'));
  assert.equal(applyIndicFix(decomposed, { fix: 'nfc' }), 'கொ');
  assert.equal(applyIndicFix('a‌ b', { fix: 'zw' }), 'a b');
  // another Indian script inside a Tamil word
  assert.ok(indicFindings([{ elId: 'a', text: 'கடலം' + 'ക' }], 'ta').some((x) => x.kind === 'other-script'));
  // Urdu look-alikes
  const u = indicFindings([{ elId: 'a', text: 'كتاب يہ' }], 'ur');
  assert.ok(u.some((x) => x.from === 'ك') && u.some((x) => x.from === 'ي'));
  assert.equal(applyIndicFix('كتاب', u.find((x) => x.from === 'ك')), 'کتاب');
  assert.deepEqual(indicFindings(texts, 'en'), []);
});

test('paragraph compare and restore', () => {
  const old = '<p>One.</p><p>Two.</p><p>Three.</p>';
  const now = '<p>One.</p><p>Two, changed.</p><p>New.</p>';
  const d = paragraphDiff(old, now);
  assert.deepEqual(d.map((x) => x.op), ['=', '~', '~']);
  assert.equal(restoreParagraph(now, d[1]), '<p>One.</p><p>Two.</p><p>New.</p>');
  const d2 = paragraphDiff('<p>A</p><p>B</p>', '<p>A</p>');
  assert.equal(d2[1].op, '-');
  assert.equal(restoreParagraph('<p>A</p>', d2[1]), '<p>A</p><p>B</p>');
});

test('old books and backups get a default style sheet', async () => {
  const { normalizeBook } = await import('../src/core/model.js');
  const old = normalizeBook({ id: 'old', meta: { title: 'Old' }, elements: [] });
  assert.equal(old.styleSheet.variety, 'us');
  assert.deepEqual(old.styleSheet.words, []);
  const kept = normalizeBook({ id: 'b', meta: {}, elements: [], styleSheet: { variety: 'in', words: [{ word: 'Mum' }] } });
  assert.equal(kept.styleSheet.variety, 'in');
  assert.equal(kept.styleSheet.serialComma, true);
  assert.equal(kept.styleSheet.words[0].word, 'Mum');
});
