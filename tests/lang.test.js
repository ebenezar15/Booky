import test from 'node:test';
import assert from 'node:assert/strict';
import { checkText, readability } from '../src/lang/grammar.js';
import { rephrase, toActive, split, simplify } from '../src/lang/rephrase.js';

const rules = (t) => checkText(t).map((i) => i.rule);

test('grammar: common errors are found', () => {
  assert.ok(rules('I could of gone there.').includes('confused'));
  assert.ok(rules('She saw a apple on the the table.').includes('article'));
  assert.ok(rules('She saw a apple on the the table.').includes('repeated-word'));
  assert.ok(rules('It was late. then she left.').includes('capitalization'));
  assert.ok(rules('He is taller then me.').includes('confused'));
  assert.ok(rules('Hello ,world').includes('space-before-punct'));
  assert.ok(rules('an hour ago she met a university friend.').every((r) => r !== 'article'));
});

test('style: wordy, passive, intensifiers', () => {
  const r = checkText('In order to win, the ball was thrown by the boy. He was very tired.');
  const wordy = r.find((i) => i.rule === 'wordy');
  assert.equal(wordy.replacements[0], 'To');
  assert.ok(r.some((i) => i.rule === 'passive'));
  assert.equal(r.find((i) => i.rule === 'intensifier').replacements[0], 'exhausted');
});

test('clean text has no grammar errors', () => {
  const r = checkText('The morning was bright and clear. Anna walked to the harbour, humming.').filter((i) => i.kind === 'grammar');
  assert.deepEqual(r, []);
});

test('rephrase produces alternatives', () => {
  assert.equal(toActive('The ball was thrown by the boy.'), 'The boy threw the ball.');
  assert.equal(simplify('In order to win, we really need a plan.'), 'To win, we need a plan.');
  assert.ok(split('She walked down the long road toward the old house on the hill, and she wondered whether anyone still lived there after all these years.').includes('. '));
  assert.ok(rephrase('Due to the fact that it was very cold, we did not go out.').length >= 3);
});

test('readability', () => {
  const r = readability('The cat sat on the mat. It was happy.');
  assert.ok(r.ease > 80);
});

test('rephrase restructures simple sentences', async () => {
  const { frontSimile, frontPhrase } = await import('../src/lang/rephrase.js');
  assert.equal(frontSimile('The wind came in off the sea like a living thing.'), 'Like a living thing, the wind came in off the sea.');
  assert.equal(frontPhrase('She waited by the door until dawn.'), 'Until dawn, she waited by the door.');
});
