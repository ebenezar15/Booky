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

self.onmessage = (e) => {
  const { id, type, words, word } = e.data;
  try {
    const s = get();
    if (type === 'init') return self.postMessage({ id, ok: true });
    if (type === 'add') { (words || [word]).forEach((w) => w && s.add(w)); return self.postMessage({ id, ok: true }); }
    if (type === 'remove') { (words || [word]).forEach((w) => w && s.remove(w)); return self.postMessage({ id, ok: true }); }
    if (type === 'check') return self.postMessage({ id, result: words.filter((w) => !correct(s, w)) });
    if (type === 'suggest') return self.postMessage({ id, result: s.suggest(word.replace(/’/g, "'")).slice(0, 8) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
