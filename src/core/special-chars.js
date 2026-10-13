// Characters for the special-character picker: typographic marks, symbols and each script's own letters.

const C = (group, list) => list.map(([ch, name, show]) => ({ group, ch, name, ...(show ? { show } : {}) }));

export const SPECIAL_CHARS = [
  ...C('Dashes & spaces', [
    ['—', 'em dash'], ['–', 'en dash'], ['‑', 'non-breaking hyphen'], ['­', 'soft hyphen (optional break)', '-?'], ['−', 'minus sign'],
    [' ', 'non-breaking space', '⍽'], [' ', 'narrow non-breaking space', '·⍽·'], [' ', 'thin space', '|·|'], [' ', 'hair space', '|ˑ|'],
    [' ', 'em space', '[  ]'], ['​', 'zero-width space (line-break opportunity)', '⁞'],
  ]),
  ...C('Quotes & primes', [
    ['“', 'left double quote'], ['”', 'right double quote'], ['‘', 'left single quote'], ['’', 'right single quote / apostrophe'],
    ['«', 'left guillemet'], ['»', 'right guillemet'], ['‹', 'single left guillemet'], ['›', 'single right guillemet'], ['„', 'low double quote'], ['‚', 'low single quote'],
    ['′', 'prime (feet, minutes)'], ['″', 'double prime (inches, seconds)'], ['‴', 'triple prime'],
  ]),
  ...C('Punctuation & marks', [
    ['…', 'ellipsis'], ['•', 'bullet'], ['·', 'middle dot'], ['§', 'section sign'], ['¶', 'pilcrow (paragraph sign)'], ['†', 'dagger'], ['‡', 'double dagger'],
    ['※', 'reference mark'], ['⁂', 'asterism'], ['❧', 'hedera (floral heart)'], ['¡', 'inverted exclamation mark'], ['¿', 'inverted question mark'], ['‽', 'interrobang'],
    ['©', 'copyright'], ['®', 'registered'], ['™', 'trademark'], ['℗', 'sound recording copyright'], ['°', 'degree'], ['№', 'numero sign'], ['℅', 'care of'],
  ]),
  ...C('Fractions & numbers', [
    ['½', 'one half'], ['⅓', 'one third'], ['⅔', 'two thirds'], ['¼', 'one quarter'], ['¾', 'three quarters'], ['⅕', 'one fifth'], ['⅛', 'one eighth'], ['⅜', 'three eighths'],
    ['⁄', 'fraction slash'], ['×', 'multiplication sign'], ['÷', 'division sign'], ['±', 'plus-minus'], ['≈', 'almost equal'], ['≠', 'not equal'], ['≤', 'less than or equal'], ['≥', 'greater than or equal'],
    ['‰', 'per mille'], ['∞', 'infinity'], ['¹', 'superscript one'], ['²', 'superscript two'], ['³', 'superscript three'],
  ]),
  ...C('Arrows', [['→', 'right arrow'], ['←', 'left arrow'], ['↑', 'up arrow'], ['↓', 'down arrow'], ['↔', 'left-right arrow'], ['⇒', 'double right arrow'], ['↩', 'return arrow'], ['➝', 'drafting arrow']]),
  ...C('Currency', [['₹', 'Indian rupee'], ['$', 'dollar'], ['£', 'pound'], ['€', 'euro'], ['¥', 'yen / yuan'], ['₩', 'won'], ['₦', 'naira'], ['₱', 'peso'], ['₨', 'rupee sign (old)'], ['৳', 'taka'], ['₽', 'rouble'], ['¢', 'cent'], ['₿', 'bitcoin']]),
  ...C('Accented letters', [['é', 'e acute'], ['è', 'e grave'], ['ê', 'e circumflex'], ['ë', 'e diaeresis'], ['à', 'a grave'], ['á', 'a acute'], ['â', 'a circumflex'], ['ä', 'a diaeresis'], ['ç', 'c cedilla'], ['ñ', 'n tilde'], ['ö', 'o diaeresis'], ['ø', 'o slash'], ['ü', 'u diaeresis'], ['ß', 'sharp s'], ['æ', 'ae ligature'], ['œ', 'oe ligature'], ['ā', 'a macron'], ['ī', 'i macron'], ['ū', 'u macron'], ['ṇ', 'n dot below'], ['ṣ', 's dot below'], ['ś', 's acute']]),
];

// Unicode blocks of each script (letters, signs and digits); unassigned code points are skipped by the regex test.
const RANGES = {
  devanagari: [0x0900, 0x097f], bengali: [0x0980, 0x09ff], gurmukhi: [0x0a00, 0x0a7f], gujarati: [0x0a80, 0x0aff], oriya: [0x0b00, 0x0b7f],
  tamil: [0x0b80, 0x0bff], telugu: [0x0c00, 0x0c7f], kannada: [0x0c80, 0x0cff], malayalam: [0x0d00, 0x0d7f], sinhala: [0x0d80, 0x0dff], arabic: [0x0600, 0x06ff],
};
const UNICODE_NAME = { devanagari: 'Devanagari', bengali: 'Bengali', gurmukhi: 'Gurmukhi', gujarati: 'Gujarati', oriya: 'Oriya', tamil: 'Tamil', telugu: 'Telugu', kannada: 'Kannada', malayalam: 'Malayalam', sinhala: 'Sinhala', arabic: 'Arabic' };

/** The book's script's own characters (letters, signs, digits, punctuation). Combining signs are shown on a dotted circle. */
export function scriptChars(script) {
  const r = RANGES[script];
  if (!r) return [];
  const re = new RegExp(`\\p{Script_Extensions=${UNICODE_NAME[script]}}`, 'u');
  const extra = script === 'tamil' || script === 'devanagari' || script === 'bengali' ? [0x0964, 0x0965] : []; // dandas live in the Devanagari block
  const out = [];
  for (const cp of [...Array.from({ length: r[1] - r[0] + 1 }, (_, i) => r[0] + i), ...extra.filter((c) => c < r[0] || c > r[1])]) {
    const ch = String.fromCodePoint(cp);
    if (!re.test(ch)) continue;
    if (!/[\p{L}\p{M}\p{N}\p{P}\p{S}]/u.test(ch)) continue;
    const mark = /\p{M}/u.test(ch);
    out.push({ group: 'script', ch, name: `${script} U+${cp.toString(16).toUpperCase().padStart(4, '0')}${mark ? ' (sign)' : ''}`, ...(mark ? { show: `◌${ch}` } : {}) });
  }
  return out;
}
