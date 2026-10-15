import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPunctuation, fixPunctuation, punctuationFindings, unbalanced } from '../src/lang/punctuation.js';

const rules = (text, lang) => checkPunctuation(text, lang).map((i) => `${i.rule}:${text.slice(i.start, i.end)}>${i.replacements[0] ?? ''}`);

test('shared spacing rules', () => {
  assert.deepEqual(rules('Hello , world .', 'en'), ['punct-space-before: ,>,', 'punct-space-before: .>.']);
  assert.deepEqual(rules('Wait,what is this?Nothing.', 'de'), ['punct-space-after:,>, ', 'punct-space-after:?>? ']);
  assert.deepEqual(rules('A list ( with space ) here.', 'en'), ['punct-bracket-space:( >(', 'punct-bracket-space: )>)']);
  assert.equal(fixPunctuation('Yes,, and no;; maybe.. Done....', 'doubled', 'en'), 'Yes, and no; maybe. Done....');
  assert.equal(fixPunctuation('Done....', 'many-stops', 'en'), 'Done…');
  // numbers, times, decimals and ellipses are left alone
  assert.deepEqual(rules('It cost 3,000 at 10:30 for 2.5 kg… then .5 more.', 'en'), []);
});

test('English leaves live duplicates to the grammar checker', () => {
  assert.equal(checkPunctuation('Hello , world', 'en', { skipEnglish: true }).length, 0);
  assert.equal(checkPunctuation('Hello , world', 'en').length, 1);
});

test('Urdu and Arabic marks', () => {
  const t = 'یہ کتاب ہے, کیا آپ نے پڑھی? ہاں.';
  assert.equal(fixPunctuation(fixPunctuation(fixPunctuation(t, 'arabic-comma', 'ur'), 'arabic-question', 'ur'), 'urdu-stop', 'ur'), 'یہ کتاب ہے، کیا آپ نے پڑھی؟ ہاں۔');
  // Arabic keeps the Latin full stop
  assert.equal(fixPunctuation('هذا كتاب.', 'urdu-stop', 'ar'), 'هذا كتاب.');
  assert.ok(rules('هذا كتاب, جميل', 'ar').includes('punct-arabic-comma:,>،'));
  // Latin words inside Urdu are not touched
  assert.equal(fixPunctuation('Hello, world.', 'arabic-comma', 'ur'), 'Hello, world.');
});

test('danda languages', () => {
  assert.equal(fixPunctuation('यह किताब है. वह घर है.', 'danda', 'hi'), 'यह किताब है। वह घर है।');
  assert.equal(fixPunctuation('यह किताब है | और ||', 'pipe-danda', 'hi'), 'यह किताब है । और ॥');
  assert.deepEqual(rules('यह किताब है ।', 'hi'), ['punct-space-before: ।>।']);
  // Marathi and Tamil use the full stop
  assert.equal(fixPunctuation('हे पुस्तक आहे.', 'danda', 'mr'), 'हे पुस्तक आहे.');
  assert.deepEqual(rules('இது புத்தகம்.', 'ta'), []);
  assert.deepEqual(rules('இது புத்தகம் .', 'ta'), ['punct-space-before: .>.']);
});

test('Spanish, French, Chinese', () => {
  assert.equal(fixPunctuation('Hola. Cómo estás? Bien.', 'es-question', 'es'), 'Hola. ¿Cómo estás? Bien.');
  assert.equal(fixPunctuation('¿Cómo estás? Bien.', 'es-question', 'es'), '¿Cómo estás? Bien.');
  assert.equal(fixPunctuation('Qué bonito!', 'es-exclaim', 'es'), '¡Qué bonito!');
  assert.equal(fixPunctuation('Vraiment? Oui: «non»', 'fr-space', 'fr'), 'Vraiment\u202F? Oui\u202F: «non»');
  assert.equal(fixPunctuation('«non»', 'fr-guillemets', 'fr'), '«\u00A0non\u00A0»');
  assert.equal(fixPunctuation('你好,世界.', 'cjk-fullwidth', 'zh'), '你好，世界。');
  assert.equal(fixPunctuation('mr. smith arrived. then he left.', 'capital-after-stop', 'de'), 'mr. smith arrived. Then he left.');
});

test('unbalanced brackets and quotes', () => {
  assert.deepEqual(unbalanced('She said (quietly.\n1) first item\nNo problem (here).').map((u) => u.match), ['(']);
  assert.deepEqual(unbalanced('An extra ) here and ”there').map((u) => u.match), [')', '”']);
  assert.deepEqual(unbalanced('“Speech that runs on'), []);
});

test('book-wide findings', () => {
  const f = punctuationFindings([{ elId: 'a', text: 'Hi , there.\nOne (two' }, { elId: 'b', text: 'More , text' }], 'en');
  const sp = f.find((x) => x.id === 'space-before');
  assert.equal(sp.hits.length, 2);
  assert.deepEqual(sp.hits.map((h) => h.elId), ['a', 'b']);
  assert.ok(f.find((x) => x.id === 'unbalanced' && !x.fix));
});
