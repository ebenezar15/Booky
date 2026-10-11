// Spell-check worker: loads the bundled Hunspell en dictionary with nspell.
import nspell from 'nspell';
import aff from '@dict/index.aff?raw';
import dic from '@dict/index.dic?raw';

let spell = null;
function get() {
  if (!spell) spell = nspell({ aff, dic });
  return spell;
}

function correct(s, w) {
  if (s.correct(w)) return true;
  const plain = w.replace(/’/g, "'");
  if (plain !== w && s.correct(plain)) return true;
  // Possessives: "Eliza's", "boss'"
  const m = plain.match(/^(.+?)'s?$/);
  if (m && s.correct(m[1])) return true;
  // Hyphenated compounds: check each part
  if (plain.includes('-')) return plain.split('-').every((p) => !p || s.correct(p));
  return false;
}

// Frequent typing slips that edit-distance ranking gets wrong.
const COMMON = { teh: 'the', hte: 'the', adn: 'and', nad: 'and', taht: 'that', thier: 'their', recieve: 'receive', recieved: 'received', beleive: 'believe', wierd: 'weird', freind: 'friend', untill: 'until', occured: 'occurred', seperate: 'separate', definately: 'definitely', accomodate: 'accommodate', begining: 'beginning', beutiful: 'beautiful', beautifull: 'beautiful', tommorow: 'tomorrow', tomorow: 'tomorrow', wich: 'which', becuase: 'because', alot: 'a lot', goverment: 'government', enviroment: 'environment', truely: 'truly', publically: 'publicly', neccessary: 'necessary', occassion: 'occasion', existance: 'existence', arguement: 'argument', calender: 'calendar', concious: 'conscious', embarass: 'embarrass', foriegn: 'foreign', gaurd: 'guard', happend: 'happened', independant: 'independent', knowlege: 'knowledge', libary: 'library', noticable: 'noticeable', posession: 'possession', reccomend: 'recommend', rythm: 'rhythm', sieze: 'seize', suprise: 'surprise', threshhold: 'threshold', tounge: 'tongue', wether: 'whether', youre: "you're", dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't", im: "I'm", ive: "I've" };

function suggestions(s, word) {
  const w = word.replace(/’/g, "'");
  const lower = w.toLowerCase();
  const cap = w[0] !== lower[0];
  const fix = (x) => (cap ? x[0].toUpperCase() + x.slice(1) : x);
  const out = [];
  if (COMMON[lower]) out.push(fix(COMMON[lower]));
  // Swapped neighbouring letters ("teh" → "the") are the most common slip.
  for (let i = 0; i < lower.length - 1; i++) {
    const t = lower.slice(0, i) + lower[i + 1] + lower[i] + lower.slice(i + 2);
    if (t !== lower && s.correct(t)) out.push(fix(t));
  }
  for (const x of s.suggest(lower)) out.push(fix(x));
  if (cap) for (const x of s.suggest(w)) out.push(x);
  return [...new Set(out)].filter((x) => x.toLowerCase() !== lower).slice(0, 8);
}

self.onmessage = (e) => {
  const { id, type, words, word } = e.data;
  try {
    const s = get();
    if (type === 'init') return self.postMessage({ id, ok: true });
    if (type === 'add') { (words || [word]).forEach((w) => w && s.add(w)); return self.postMessage({ id, ok: true }); }
    if (type === 'remove') { (words || [word]).forEach((w) => w && s.remove(w)); return self.postMessage({ id, ok: true }); }
    if (type === 'check') return self.postMessage({ id, result: words.filter((w) => !correct(s, w)) });
    if (type === 'suggest') return self.postMessage({ id, result: suggestions(s, word) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
