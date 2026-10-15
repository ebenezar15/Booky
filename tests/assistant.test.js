import test from 'node:test';
import assert from 'node:assert/strict';
import { paraphrase, summarize, fixGrammar, swapSynonyms, alternativesFor, MODES } from '../src/lang/assistant.js';

const T = 'In order to survive, she made a decision to leave the house. It was very cold. She did not want to go. The letter was written by her brother.';

test('every mode returns text and keeps the sentence count close', () => {
  for (const m of MODES) {
    const r = paraphrase(T, { mode: m.id, seed: 1 });
    assert.ok(r.text.length > 20, m.id);
    assert.ok(Math.abs(r.text.split(/[.!?]/).length - T.split(/[.!?]/).length) <= 2, m.id);
  }
});

test('modes do what they say', () => {
  assert.match(paraphrase(T, { mode: 'shorten' }).text, /^To survive, she decided to leave/);
  assert.match(paraphrase(T, { mode: 'casual' }).text, /didn't want/);
  assert.match(paraphrase("She didn't want to go. So we left.", { mode: 'formal' }).text, /did not want.*Therefore we left/);
  assert.match(paraphrase(T, { mode: 'creative', seed: 3 }).text, /Her brother wrote the letter/);
  assert.match(paraphrase('Prior to that, we utilised numerous tools.', { mode: 'simple' }).text, /Before that, we used many tools/);
});

test('"Try again" gives a different but repeatable result', () => {
  const a = paraphrase('The angry man walked into the quiet room and smiled at the nervous girl.', { seed: 1 }).text;
  assert.equal(a, paraphrase('The angry man walked into the quiet room and smiled at the nervous girl.', { seed: 1 }).text);
  const seen = new Set([1, 2, 3, 4, 5].map((seed) => paraphrase('The angry man walked into the quiet room and smiled at the nervous girl.', { seed }).text));
  assert.ok(seen.size > 1);
});

test('names and risky words are not swapped', () => {
  assert.equal(swapSynonyms('Happy Jones made it.', { max: 5, seed: 1 }).includes('Jones'), true);
  for (let seed = 0; seed < 10; seed++) assert.match(swapSynonyms('She made a cold old cake.', { max: 5, seed }), /made a cold old cake/);
  assert.ok(alternativesFor('Happy').every((w) => /^[A-Z]/.test(w)));
});

test('grammar and punctuation fixes in any language', () => {
  assert.equal(fixGrammar('She went home , and the the dog followed .'), 'She went home, and the dog followed.');
  assert.equal(fixGrammar('یہ کتاب ہے, کیا آپ نے پڑھی?', 'ur'), 'یہ کتاب ہے، کیا آپ نے پڑھی؟');
  assert.equal(fixGrammar('यह किताब है .', 'hi'), 'यह किताब है।');
  assert.equal(paraphrase('यह किताब है .', { lang: 'hi' }).text, 'यह किताब है।');
});

test('summary keeps the strongest sentences in order, in any script', () => {
  const s = summarize('The lighthouse stood on the cliff for two hundred years. Keepers came and went. The light never failed, even in the great storm. That storm sank eleven boats. Only the keeper saw the whole storm from the lamp room. Visitors read his log today.', { ratio: 0.5 });
  const parts = s.split(/(?<=\.)\s/);
  assert.equal(parts.length, 3);
  assert.equal(parts[0], 'The lighthouse stood on the cliff for two hundred years.');
  assert.equal(summarize('ஒன்று. இரண்டு. மூன்று. நான்கு.', { ratio: 0.5, lang: 'ta' }).split(' ').length, 2);
});
