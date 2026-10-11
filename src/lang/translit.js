// Phonetic typing for Indian scripts: type Latin letters, get native script.
// Indian scripts share the same layout inside their Unicode blocks (ISCII heritage),
// so one table of offsets serves Devanagari, Bengali, Gurmukhi, Gujarati, Odia,
// Tamil, Telugu, Kannada and Malayalam.
//   vanakkam → வணக்கம் (ta)   namaste → नमस्ते (hi)   malayalam → മലയാളം (ml, with "L")

const BASE = { devanagari: 0x0900, bengali: 0x0980, gurmukhi: 0x0a00, gujarati: 0x0a80, oriya: 0x0b00, tamil: 0x0b80, telugu: 0x0c00, kannada: 0x0c80, malayalam: 0x0d00 };
const DRAVIDIAN = new Set(['tamil', 'telugu', 'kannada', 'malayalam']);

// Independent vowels: [latin, offset]; vowel signs (matras) use SIGN below.
const VOWELS = [
  ['aa', 0x06], ['A', 0x06], ['ai', 0x10], ['au', 0x14], ['ee', 0x08], ['ii', 0x08], ['I', 0x08], ['oo', 0x0a], ['uu', 0x0a], ['U', 0x0a],
  ['Ru', 0x0b], ['a', 0x05], ['i', 0x07], ['u', 0x09], ['e', 'e'], ['E', 0x0f], ['o', 'o'], ['O', 0x13],
];
const SIGN = { 0x06: 0x3e, 0x07: 0x3f, 0x08: 0x40, 0x09: 0x41, 0x0a: 0x42, 0x0b: 0x43, 0x0e: 0x46, 0x0f: 0x47, 0x10: 0x48, 0x12: 0x4a, 0x13: 0x4b, 0x14: 0x4c };

// Consonants (longest first when matching).
const CONS = [
  ['chh', 0x1b], ['ksh', 'ksh'], ['ng', 0x19], ['ny', 0x1e], ['kh', 0x16], ['gh', 0x18], ['ch', 0x1a], ['jh', 0x1d], ['Th', 0x20], ['Dh', 0x22],
  ['th', 0x25], ['dh', 0x27], ['ph', 0x2b], ['bh', 0x2d], ['sh', 0x36], ['Sh', 0x37], ['zh', 0x34],
  ['k', 0x15], ['g', 0x17], ['c', 0x1a], ['j', 0x1c], ['T', 0x1f], ['D', 0x21], ['N', 0x23], ['t', 0x24], ['d', 0x26], ['n', 0x28],
  ['p', 0x2a], ['f', 0x2b], ['b', 0x2c], ['m', 0x2e], ['y', 0x2f], ['r', 0x30], ['R', 0x31], ['l', 0x32], ['L', 0x33],
  ['v', 0x35], ['w', 0x35], ['s', 0x38], ['S', 0x36], ['h', 0x39], ['z', 0x1c], ['x', 'ksh'], ['q', 0x15],
];

// Tamil has no separate aspirated / voiced letters: fold them onto the base letter.
const TAMIL_FOLD = { 0x16: 0x15, 0x17: 0x15, 0x18: 0x15, 0x1b: 0x1a, 0x1d: 0x1c, 0x20: 0x1f, 0x21: 0x1f, 0x22: 0x1f, 0x25: 0x24, 0x26: 0x24, 0x27: 0x24, 0x2b: 0x2a, 0x2c: 0x2a, 0x2d: 0x2a, 0x37: 0x37 };

export const PHONETIC_SCRIPTS = Object.keys(BASE);

function tokenize(word, script) {
  const out = [];
  for (let i = 0; i < word.length;) {
    let hit = null;
    for (const [lat, code] of VOWELS) if (!(lat === 'Ru' && script === 'tamil') && word.startsWith(lat, i) && (!hit || lat.length > hit.lat.length)) hit = { lat, code, kind: 'v' };
    for (const [lat, code] of CONS) if (word.startsWith(lat, i) && (!hit || lat.length > hit.lat.length)) hit = { lat, code, kind: 'c' };
    if (!hit && word[i] === 'M') hit = { lat: 'M', code: 0x02, kind: 'mod' };
    if (!hit && word[i] === 'H') hit = { lat: 'H', code: 0x03, kind: 'mod' };
    if (!hit) hit = { lat: word[i], code: word[i], kind: 'raw' };
    out.push(hit);
    i += hit.lat.length;
  }
  return out;
}

// Common Tamil spellings: nandri → நன்றி, kaatru → காற்று, vandi → வண்டி, manjal → மஞ்சள், sangam → சங்கம்.
function tamilClusters(w) {
  return w
    .replace(/ndr/g, 'nR')
    .replace(/tr/g, 'RR')
    .replace(/nd/g, 'ND')
    .replace(/nj/g, 'nyc')
    .replace(/ng(?=[aeiouAEIOU])/g, 'ngg');
}

/** Convert one Latin word to the given script. */
export function transliterateWord(word, script) {
  const base = BASE[script];
  if (!base || !word) return word;
  const dravid = DRAVIDIAN.has(script);
  const ch = (off) => String.fromCodePoint(base + off);
  const virama = ch(0x4d);
  const vowelCode = (c) => (c === 'e' ? (dravid ? 0x0e : 0x0f) : c === 'o' ? (dravid ? 0x12 : 0x13) : c);
  if (script === 'tamil') word = tamilClusters(word);
  let toks = tokenize(word, script);
  let out = '';
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind === 'raw') { out += t.code; continue; }
    if (t.kind === 'mod') { out += ch(t.code); continue; }
    if (t.kind === 'v') { out += ch(vowelCode(t.code)); continue; }
    // consonant
    let codes = t.code === 'ksh' ? [0x15, 0x37] : [t.code];
    if (script === 'tamil') {
      codes = codes.map((c) => TAMIL_FOLD[c] ?? c);
      // Tamil: "n" at the start of a word or before t/th is ந; elsewhere ன. "s" is ச, "S"/"sh" is ஷ.
      if (t.lat === 'n') codes = [i === 0 || /^t/.test(toks[i + 1]?.lat || '') ? 0x28 : 0x29];
      if (t.lat === 's') codes = [0x1a];
      if (t.lat === 'S' || t.lat === 'sh' || t.lat === 'Sh') codes = [0x37];
      if (t.lat === 'h') codes = [0x39];
      if (t.lat === 'j') codes = [0x1c];
    }
    out += codes.map((c, k) => ch(c) + (k < codes.length - 1 ? virama : '')).join('');
    const next = toks[i + 1];
    if (next && next.kind === 'v') {
      const v = vowelCode(next.code);
      if (v !== 0x05) out += ch(SIGN[v]);
      i++;
    } else if (next && next.kind === 'c') {
      out += virama;
    } else if (dravid) {
      out += virama; // Tamil/Malayalam/Telugu/Kannada show the dead consonant at word end
    } else if (next && next.kind === 'mod') {
      // inherent 'a' before anusvara/visarga
    }
    // Hindi & other Indo-Aryan scripts: a final consonant keeps its silent inherent vowel (राम, not राम्).
  }
  return out;
}

/** Convert every run of Latin letters in a string. */
export function transliterate(text, script) {
  return text.replace(/[A-Za-z~]+/g, (w) => transliterateWord(w, script));
}

export const PHONETIC_HELP = [
  ['a  aa  i  ee/ii  u  oo/uu', 'vowels'],
  ['e  E  ai  o  O  au', 'short/long e and o (Tamil, Malayalam, Telugu, Kannada)'],
  ['k kh g gh ng · ch j ny · T D N · t th d n · p b m · y r l v · s sh h', 'consonants'],
  ['L  zh  R', 'ள  ழ  ற  (Tamil) · ळ (Marathi)'],
  ['M  H', 'anusvara ं  ·  visarga ः'],
];
