// Main-thread spell-check client with caching. Runs fully offline.
import SpellWorker from './spell.worker.js?worker&inline';
import { state, emit } from '../core/store.js';

let worker = null;
let seq = 0;
const pending = new Map();
const cache = new Map(); // word -> boolean (true = correct)
let ready = null;

function call(type, payload = {}) {
  if (!worker) start();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, ...payload });
  });
}

function start() {
  worker = new SpellWorker();
  worker.onerror = (e) => {
    console.warn('Spell worker error', e.message);
    pending.forEach((p) => p.reject(new Error('Spell checker failed to load')));
    pending.clear();
  };
  worker.onmessage = (e) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data.result);
  };
}

export function initSpell() {
  if (!ready) {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000));
    ready = Promise.race([call('init'), timeout]).then(() => call('add', { words: state.app.dictionary })).then(() => { emit('spell-ready'); return true; })
      .catch((err) => { console.warn('Spell checker unavailable', err); return false; });
  }
  return ready;
}

export const WORD_RE = /[\p{L}][\p{L}\p{M}'’\-]*[\p{L}]|[\p{L}]/gu;

export function shouldSkip(word) {
  if (word.length < 2) return true;
  if (/\d/.test(word)) return true;
  if (/\p{Lu}/u.test(word) && word === word.toUpperCase() && word.length <= 6) return true; // acronyms (scripts without capitals never are)
  if (/^(https?|www)/i.test(word)) return true;
  return false;
}

const ignoredSet = () => new Set([...(state.app.ignored || []), ...(state.app.dictionary || [])].map((w) => w.toLowerCase()));

// Returns the Set of misspelled words among `words` (fetches unknown ones from the worker).
export async function findMisspelled(words) {
  const unknown = [...new Set(words.filter((w) => !cache.has(w) && !shouldSkip(w)))];
  if (unknown.length) {
    const ok = await initSpell();
    if (!ok) return new Set();
    const bad = new Set(await call('check', { words: unknown }));
    unknown.forEach((w) => cache.set(w, !bad.has(w)));
  }
  const ign = ignoredSet();
  return new Set(words.filter((w) => cache.get(w) === false && !ign.has(w.toLowerCase())));
}

export function isKnownMisspelled(word) {
  return cache.get(word) === false && !ignoredSet().has(word.toLowerCase());
}

export async function suggest(word) {
  await initSpell();
  return call('suggest', { word }).catch(() => []);
}

export function addToDictionary(word) {
  const dict = [...new Set([...(state.app.dictionary || []), word])];
  state.app.dictionary = dict;
  cache.set(word, true);
  call('add', { word });
  import('../core/store.js').then((m) => m.saveAppSettings());
  emit('spell-changed');
}

export function removeFromDictionary(word) {
  state.app.dictionary = (state.app.dictionary || []).filter((w) => w !== word);
  cache.delete(word);
  call('remove', { word });
  import('../core/store.js').then((m) => m.saveAppSettings());
  emit('spell-changed');
}

export function ignoreWord(word) {
  state.app.ignored = [...new Set([...(state.app.ignored || []), word])];
  import('../core/store.js').then((m) => m.saveAppSettings());
  emit('spell-changed');
}

// ---------- per-book spelling: English variety, or an imported dictionary for other languages ----------
let configured = '';
/** True when the open book's language has a dictionary (bundled English, or one the author imported). */
export const hasSpelling = () => state.spellLang !== null && state.spellLang !== undefined;

export async function applyBookSpelling(book) {
  const { isEnglish } = await import('../core/languages.js');
  const { normalizeStyleSheet, SPELLING_PAIRS } = await import('../core/consistency.js');
  const { db } = await import('../core/db.js');
  const lang = String(book?.meta.language || 'en').split('-')[0];
  const variety = normalizeStyleSheet(book?.styleSheet).variety;
  const key = isEnglish(lang) ? `en:${variety}` : `user:${lang}`;
  if (key === configured) return;
  await initSpell();
  if (isEnglish(lang)) {
    await call('config', { mode: 'en', variety, pairs: SPELLING_PAIRS });
    state.spellLang = 'en';
  } else {
    const dict = await db.get(`dict:${lang}`).catch(() => null);
    if (dict?.aff && dict?.dic) { await call('config', { mode: 'user', aff: dict.aff, dic: dict.dic }); state.spellLang = lang; } else { await call('config', { mode: 'en', variety: 'us', pairs: [] }); state.spellLang = null; }
  }
  configured = key;
  cache.clear();
  emit('spell-changed');
}

/** Save an imported Hunspell dictionary (.aff + .dic text) for a language. */
export async function importDictionary(lang, aff, dic, name = '') {
  const { db } = await import('../core/db.js');
  await db.set(`dict:${String(lang).split('-')[0]}`, { aff, dic, name, at: Date.now() });
  configured = '';
}
export async function removeDictionary(lang) {
  const { db } = await import('../core/db.js');
  await db.set(`dict:${String(lang).split('-')[0]}`, null);
  configured = '';
}
export async function dictionaryInfo(lang) {
  const { db } = await import('../core/db.js');
  const d = await db.get(`dict:${String(lang).split('-')[0]}`).catch(() => null);
  return d ? { name: d.name, at: d.at, words: (d.dic.match(/\n/g) || []).length } : null;
}
