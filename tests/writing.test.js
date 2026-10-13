import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleFromHtml, mergeHtml, appendHtml, findPlaceholders, splitSentences, pickVoice, parsePageQuery, matchScore, jumpCandidates, searchJump } from '../src/core/writing.js';

test('split: a leading heading becomes the new chapter title', () => {
  assert.deepEqual(titleFromHtml('<h2>The Storm</h2><p>Rain.</p>'), { title: 'The Storm', html: '<p>Rain.</p>' });
  assert.deepEqual(titleFromHtml('<p>No heading.</p>'), { title: '', html: '<p>No heading.</p>' });
  assert.equal(titleFromHtml('<h1>Only</h1>').html, '<p></p>');
});

test('merge keeps the second title as a subheading', () => {
  assert.equal(mergeHtml('<p>a</p>', '<p>b</p>', 'Two & more'), '<p>a</p><h2>Two &amp; more</h2><p>b</p>');
  assert.equal(mergeHtml('<p></p>', '<p>b</p>'), '<p>b</p>');
  assert.equal(appendHtml('<p></p>', '<p>x</p>'), '<p>x</p>');
});

test('placeholders and notes to self', () => {
  const els = [
    { id: 'e1', content: '<p>Born in TK, she <span data-type="authornote" data-text="check the date"></span>left in XX.</p><p>Ask [[Mum]] about it???</p>' },
    { id: 'e2', content: '<p>TKO and TEXT and XXL are words, not placeholders.</p>' },
    { id: 'e3', content: '<p>அவள் TK வந்தாள்.</p>' },
  ];
  const f = findPlaceholders(els);
  assert.deepEqual(f.map((x) => `${x.elId}:${x.kind}:${x.text}`), ['e1:note:check the date', 'e1:placeholder:TK', 'e1:placeholder:XX', 'e1:placeholder:[[Mum]]', 'e1:placeholder:???', 'e3:placeholder:TK']);
  assert.match(f[1].context, /Born in TK, she left/);
});

test('sentences in English, Tamil and Urdu', () => {
  assert.deepEqual(splitSentences('One. Two? Three!', 'en').map((s) => s.text), ['One.', 'Two?', 'Three!']);
  const ta = splitSentences('அவள் வந்தாள். அவன் போனான்.', 'ta');
  assert.equal(ta.length, 2);
  const ur = splitSentences('وہ آئی۔ وہ گیا۔', 'ur');
  assert.equal(ur.length, 2);
  const s = splitSentences('  Hello there. Next', 'en');
  assert.equal('  Hello there. Next'.slice(s[0].start, s[0].end), 'Hello there.');
});

test('voice choice prefers the exact locale and offline voices', () => {
  const voices = [{ name: 'A', lang: 'en-US', localService: false }, { name: 'B', lang: 'en-GB', localService: true }, { name: 'T', lang: 'ta-IN', localService: true }];
  assert.equal(pickVoice(voices, 'en-GB').name, 'B');
  assert.equal(pickVoice(voices, 'en').name, 'B');
  assert.equal(pickVoice(voices, 'ta').name, 'T');
  assert.equal(pickVoice(voices, 'ur'), null);
  assert.equal(pickVoice(voices, 'en', 'A').name, 'A');
});

test('quick jump', () => {
  assert.equal(parsePageQuery('p 142'), 142);
  assert.equal(parsePageQuery('page 7'), 7);
  assert.equal(parsePageQuery('p.12'), 12);
  assert.equal(parsePageQuery('pepper'), 0);
  assert.ok(matchScore('The Lamp Room', 'lamp') > matchScore('Clamping', 'lamp'));
  assert.equal(matchScore('Lighthouse', 'xyz'), 0);
  assert.equal(matchScore('Half Title', 'second half'), 0);
  assert.ok(matchScore('The Second Half', 'half second') > 0);
  assert.ok(matchScore('Lighthouse', 'lghths') > 0);
  const book = { elements: [{ id: 'c1', title: 'Arrival', content: '<h2>The lamp room</h2><p>x</p>' }, { id: 'c2', title: 'Storm', content: '' }], bible: [{ id: 'b1', name: 'Meenakshi', kind: 'character' }] };
  const c = jumpCandidates(book, (e) => e.title, ['c2']);
  assert.equal(searchJump(c, 'lamp')[0].kind, 'heading');
  assert.equal(searchJump(c, 'meen')[0].bibleId, 'b1');
  assert.equal(searchJump(c, '')[0].kind, 'recent');
});

test('special characters: typographic set and script letters', async () => {
  const { SPECIAL_CHARS, scriptChars } = await import('../src/core/special-chars.js');
  for (const ch of ['—', '–', '…', ' ', ' ', '′', '″', '½', '©', '™', '§', '→', '₹']) assert.ok(SPECIAL_CHARS.some((c) => c.ch === ch), ch);
  const ta = scriptChars('tamil');
  assert.ok(ta.some((c) => c.ch === 'க'));
  assert.ok(ta.some((c) => c.ch === '்' && c.show === '◌்'));
  assert.ok(ta.some((c) => c.ch === '௹'));
  assert.ok(scriptChars('devanagari').some((c) => c.ch === '।'));
  assert.ok(scriptChars('arabic').some((c) => c.ch === '۔'));
  assert.deepEqual(scriptChars('latin'), []);
});
