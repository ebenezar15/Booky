import test from 'node:test';
import assert from 'node:assert/strict';
import { similarSentences, repeatedPhrases, sentenceOpeners, echoes, textMetrics, readabilityAdvice, originalityCheck, FAMOUS_PASSAGES } from '../src/lang/analysis.js';

const units = [
  { id: 'c1', title: 'One', text: 'The rain fell hard against the old lighthouse windows. She climbed the stairs slowly. She climbed the stairs again. She counted every step.' },
  { id: 'c2', title: 'Two', text: 'Later the rain fell hard against the old lighthouse window. He waited by the door. In the blink of an eye it was over. In the blink of an eye he was gone. In the blink of an eye the night returned.' },
];

test('finds near-duplicate sentences across chapters', () => {
  const r = similarSentences(units);
  assert.ok(r.length >= 1);
  assert.ok(r.some((p) => p.a.id !== p.b.id && p.score >= 60));
});

test('finds repeated phrases', () => {
  const r = repeatedPhrases(units);
  assert.ok(r.some((p) => p.phrase.includes('blink of an eye') && p.count === 3));
});

test('detects runs of sentences starting the same way', () => {
  const r = sentenceOpeners(units);
  assert.ok(r.runs.some((x) => x.word === 'she' && x.count >= 3));
});

test('echo words', () => {
  assert.ok(echoes(units).some((e) => e.word.startsWith('stair') || e.word.startsWith('climb')));
});

test('readability metrics and advice', () => {
  const m = textMetrics('The ball was thrown by the boy. It was very quickly caught. '.repeat(10));
  assert.ok(m.passivePct > 0);
  const a = readabilityAdvice(m);
  assert.ok(a.score >= 0 && a.score <= 100 && a.tips.length);
});

test('originality check spots borrowed famous lines', () => {
  const r = originalityCheck([{ id: 'x', title: 'X', text: 'My story opens. It was a bright cold day in April, and the clocks were striking thirteen. Then it rained.' }], FAMOUS_PASSAGES);
  assert.equal(r.matches[0].source, '1984 — Orwell');
  assert.ok(r.originality < 100);
});
