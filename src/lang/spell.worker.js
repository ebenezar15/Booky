// Spell-check worker: loads the bundled Hunspell en dictionary with nspell.
import nspell from 'nspell';
import aff from '@dict/index.aff?raw';
import dic from '@dict/index.dic?raw';

let spell = null;
let user = null; // an imported Hunspell dictionary for a non-English book
let mode = 'en';
let variety = 'us';
let pairs = []; // [us, uk]
function get() {
  if (mode === 'user' && user) return user;
  if (!spell) spell = nspell({ aff, dic });
  return spell;
}

// The bundled dictionary is US English. For UK and Indian English, UK forms are accepted (colour, colourful,
// realise, realised) and US forms are flagged (color → colour).
const swap = (w, from, to) => (w.startsWith(from) ? to + w.slice(from.length) : null);
function varietyCheck(s, w) {
  if (mode !== 'en' || variety === 'us') return null;
  const lower = w.toLowerCase();
  for (const [us, uk] of pairs) {
    if (lower.startsWith(uk)) { const t = swap(lower, uk, us); if (t && s.correct(t)) return true; }
    if (lower.startsWith(us) && !lower.startsWith(uk)) { const t = swap(lower, us, uk); if (t && s.correct(swap(t, uk, us))) return false; }
  }
  const ise = lower.match(/^(.+)is(e|es|ed|ing|ation|ations|er|ers)$/);
  if (ise && s.correct(`${ise[1]}iz${ise[2]}`)) return true;
  return null;
}
function ukForm(w) {
  const lower = w.toLowerCase();
  for (const [us, uk] of pairs) if (lower.startsWith(us) && !lower.startsWith(uk)) return uk + lower.slice(us.length);
  return null;
}

function correct(s, w) {
  const v = varietyCheck(s, w);
  if (v !== null) return v;
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
  if (mode === 'en' && variety !== 'us' && ukForm(lower)) out.push(fix(ukForm(lower)));
  if (mode === 'en' && COMMON[lower]) out.push(fix(COMMON[lower]));
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
    const s = type === 'config' ? null : get();
    if (type === 'init') return self.postMessage({ id, ok: true });
    if (type === 'config') {
      mode = e.data.mode || 'en';
      variety = e.data.variety || 'us';
      pairs = e.data.pairs || [];
      if (mode === 'user') user = nspell({ aff: e.data.aff, dic: e.data.dic });
      return self.postMessage({ id, ok: true });
    }
    if (type === 'add') { (words || [word]).forEach((w) => w && s.add(w)); return self.postMessage({ id, ok: true }); }
    if (type === 'remove') { (words || [word]).forEach((w) => w && s.remove(w)); return self.postMessage({ id, ok: true }); }
    if (type === 'check') return self.postMessage({ id, result: words.filter((w) => !correct(s, w)) });
    if (type === 'suggest') return self.postMessage({ id, result: suggestions(s, word) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
