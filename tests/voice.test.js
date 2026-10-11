import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeTranscript, localesFor } from '../src/lang/voice.js';

test('spoken punctuation becomes symbols', () => {
  assert.equal(shapeTranscript('she opened the door comma then stopped full stop'), 'She opened the door, then stopped.');
  assert.equal(shapeTranscript('where are you question mark', 'Hello.'), ' Where are you?');
  assert.equal(shapeTranscript('open quote run close quote she said', ''), '“Run” she said');
  assert.equal(shapeTranscript('the end new paragraph it began', 'x.'), ' The end\n\nIt began');
});

test('spacing and capitals follow the text before the cursor', () => {
  assert.equal(shapeTranscript('and then', 'She waited'), ' and then');
  assert.equal(shapeTranscript('and then', 'She waited '), 'and then');
  assert.equal(shapeTranscript('it was 3.5 miles', ''), 'It was 3.5 miles');
});

test('other languages are inserted as spoken', () => {
  assert.equal(shapeTranscript('வணக்கம் நண்பர்களே', 'அவள்', { english: false }), ' வணக்கம் நண்பர்களே');
  assert.equal(localesFor('ta')[0][0], 'ta-IN');
  assert.equal(localesFor('xx')[0][0], 'en-US');
});
