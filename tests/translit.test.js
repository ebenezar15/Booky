import test from 'node:test';
import assert from 'node:assert/strict';
import { transliterateWord as t, transliterate } from '../src/lang/translit.js';

test('Tamil phonetic typing', () => {
  assert.equal(t('vaNakkam', 'tamil'), 'வணக்கம்');
  assert.equal(t('tamizh', 'tamil'), 'தமிழ்');
  assert.equal(t('nandri', 'tamil'), 'நன்றி');
  assert.equal(t('kaatru', 'tamil'), 'காற்று');
  assert.equal(t('vandi', 'tamil'), 'வண்டி');
  assert.equal(t('manjaL', 'tamil'), 'மஞ்சள்');
  assert.equal(t('sangam', 'tamil'), 'சங்கம்');
  assert.equal(t('vanthaan', 'tamil'), 'வந்தான்');
  assert.equal(t('amma', 'tamil'), 'அம்ம');
  assert.equal(t('veeDu', 'tamil'), 'வீடு');
  assert.equal(t('ooru', 'tamil'), 'ஊரு');
});

test('Hindi phonetic typing', () => {
  assert.equal(t('namaste', 'devanagari'), 'नमस्ते');
  assert.equal(t('raam', 'devanagari'), 'राम');
  assert.equal(t('kitaab', 'devanagari'), 'किताब');
  assert.equal(t('bhaarat', 'devanagari'), 'भारत');
  assert.equal(t('hindii', 'devanagari'), 'हिन्दी');
});

test('Other Indian scripts', () => {
  assert.equal(t('malayaaLaM', 'malayalam'), 'മലയാളം');
  assert.equal(t('telugu', 'telugu'), 'తెలుగు');
  assert.equal(t('kannaDa', 'kannada'), 'ಕನ್ನಡ');
  assert.equal(t('baaMlaa', 'bengali'), 'বাংলা');
  assert.equal(transliterate('raam 12, sitaa!', 'devanagari'), 'राम 12, सिता!');
});
