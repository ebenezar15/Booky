// Whole-manuscript analysis: readability, repetition, similar sentences and originality.
// Pure functions over plain text so they can be unit-tested and run anywhere.
import { sentences, words, syllables, readability, checkText } from './grammar.js';

const STOP = new Set(('a an the and or but if then so of to in on at by for with from as is was were be been being are am it its this that these those ' +
  'he she they we you i me him her them us my his their our your not no do did does had have has will would can could should may might must ' +
  'there here what which who whom when where why how all any some one up out about into over than just like also only very said says say ' +
  'too more most such own same other each few both through during before after above below again further once off down while because until').split(' '));

const norm = (w) => w.toLowerCase().replace(/[’']/g, "'");

/** units: [{ id, title, text }] → sentence records with location */
export function sentenceRecords(units, minWords = 1) {
  const out = [];
  for (const u of units) {
    for (const para of u.text.split(/\n+/)) {
      for (const s of sentences(para)) {
        const ws = words(s.text).map(norm);
        if (ws.length >= minWords) out.push({ id: u.id, title: u.title, text: s.text, words: ws });
      }
    }
  }
  return out;
}

const jaccard = (a, b) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};

/** Pairs of near-identical sentences anywhere in the book. */
export function similarSentences(units, { threshold = 0.6, minWords = 6, limit = 60 } = {}) {
  const recs = sentenceRecords(units, minWords).map((r, i) => ({ ...r, i, set: new Set(r.words.filter((w) => !STOP.has(w))) })).filter((r) => r.set.size >= 3);
  const index = new Map();
  recs.forEach((r) => {
    for (let k = 0; k + 2 < r.words.length; k++) {
      const sh = r.words.slice(k, k + 3).join(' ');
      if (!index.has(sh)) index.set(sh, []);
      index.get(sh).push(r.i);
    }
  });
  const shared = new Map();
  for (const list of index.values()) {
    if (list.length < 2 || list.length > 60) continue;
    const uniq = [...new Set(list)];
    for (let a = 0; a < uniq.length; a++) for (let b = a + 1; b < uniq.length; b++) {
      const key = uniq[a] * 1e6 + uniq[b];
      shared.set(key, (shared.get(key) || 0) + 1);
    }
  }
  const byIdx = new Map(recs.map((r) => [r.i, r]));
  const out = [];
  for (const [key, n] of shared) {
    if (n < 2) continue;
    const a = byIdx.get(Math.floor(key / 1e6)), b = byIdx.get(key % 1e6);
    const score = jaccard(a.set, b.set);
    if (score >= threshold) out.push({ score: Math.round(score * 100), exact: a.words.join(' ') === b.words.join(' '), a: { id: a.id, title: a.title, text: a.text }, b: { id: b.id, title: b.title, text: b.text } });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, limit);
}

/** Phrases of 3–7 words that recur across the book. */
export function repeatedPhrases(units, { limit = 40 } = {}) {
  const counts = new Map();
  for (const r of sentenceRecords(units, 3)) {
    const w = r.words;
    for (let n = 3; n <= 7; n++) {
      for (let k = 0; k + n <= w.length; k++) {
        const g = w.slice(k, k + n);
        if (STOP.has(g[0]) && STOP.has(g[g.length - 1])) continue;
        if (g.filter((x) => !STOP.has(x)).length < 2) continue;
        const key = g.join(' ');
        const c = counts.get(key) || { n: 0, where: new Set() };
        c.n++;
        c.where.add(r.title);
        counts.set(key, c);
      }
    }
  }
  const rows = [...counts.entries()]
    .filter(([p, c]) => c.n >= (p.split(' ').length >= 5 ? 2 : 3))
    .map(([phrase, c]) => ({ phrase, count: c.n, where: [...c.where] }))
    .sort((a, b) => b.phrase.split(' ').length * b.count - a.phrase.split(' ').length * a.count);
  // Drop phrases contained in a longer phrase with the same count
  const kept = [];
  for (const r of rows) {
    if (kept.some((k) => k.count >= r.count && k.phrase.includes(r.phrase))) continue;
    kept.push(r);
    if (kept.length >= limit) break;
  }
  return kept.sort((a, b) => b.count - a.count);
}

/** How sentences begin: most common first words, and runs of identical openers. */
export function sentenceOpeners(units) {
  const recs = sentenceRecords(units, 2);
  const freq = new Map();
  const runs = [];
  let prev = null, run = [];
  for (const r of recs) {
    const first = r.words[0];
    freq.set(first, (freq.get(first) || 0) + 1);
    if (prev && prev.id === r.id && prev.words[0] === first) run.push(r);
    else { if (run.length >= 3) runs.push(run); run = [r]; }
    prev = r;
  }
  if (run.length >= 3) runs.push(run);
  const total = recs.length || 1;
  return {
    total: recs.length,
    top: [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, n]) => ({ word, n, pct: Math.round((n / total) * 100) })),
    runs: runs.slice(0, 30).map((rr) => ({ id: rr[0].id, title: rr[0].title, word: rr[0].words[0], count: rr.length, text: rr.map((x) => x.text).join(' ') })),
  };
}

/** Distinctive words repeated close together ("echoes"). */
export function echoes(units, { window = 50, limit = 60 } = {}) {
  const out = [];
  for (const u of units) {
    const ws = words(u.text).map(norm);
    const last = new Map();
    ws.forEach((w, i) => {
      if (w.length < 5 || STOP.has(w)) return;
      const stem = w.replace(/(ing|ed|es|s|ly)$/, '');
      if (last.has(stem) && i - last.get(stem) <= window) {
        out.push({ id: u.id, title: u.title, word: w, gap: i - last.get(stem), context: ws.slice(Math.max(0, last.get(stem) - 4), i + 3).join(' ') });
      }
      last.set(stem, i);
    });
  }
  return out.sort((a, b) => a.gap - b.gap).slice(0, limit);
}

const stdev = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / (xs.length || 1); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length || 1)); };

/** Readability metrics for one text. */
export function textMetrics(text) {
  const r = readability(text);
  const recs = sentenceRecords([{ id: '', title: '', text }], 1);
  const lens = recs.map((x) => x.words.length);
  const ws = words(text);
  const n = ws.length || 1;
  const adverbs = ws.filter((w) => /ly$/i.test(w) && w.length > 4 && !/^(only|early|family|reply|supply|holy|ugly|lovely|likely|daily|friendly|lonely|silly|belly|jelly|fly|july|italy|rely|ally|apply)$/i.test(w)).length;
  const long = lens.filter((l) => l > 30).length;
  const passive = checkText(text, { grammar: false, style: true, fiction: false }).filter((i) => i.rule === 'passive').length;
  const complex = ws.filter((w) => syllables(w) >= 3).length;
  const dialogue = (text.match(/[“"][^”"]{2,}[”"]/g) || []).join(' ');
  return {
    ...r,
    words: ws.length,
    sentenceCount: recs.length,
    longPct: Math.round((long / (recs.length || 1)) * 100),
    adverbPct: Math.round((adverbs / n) * 1000) / 10,
    passivePct: Math.round((passive / (recs.length || 1)) * 100),
    complexPct: Math.round((complex / n) * 100),
    dialoguePct: Math.round((words(dialogue).length / n) * 100),
    variety: Math.round(stdev(lens) * 10) / 10,
  };
}

/** Overall score (0–100) and plain-language suggestions. */
export function readabilityAdvice(m, { fiction = true } = {}) {
  const tips = [];
  let score = 100;
  const pen = (n, tip) => { score -= n; tips.push(tip); };
  if (m.avgSentence > 24) pen(12, { level: 'warn', text: `Average sentence is ${m.avgSentence} words. Aim for 15–20 by splitting long sentences.` });
  else if (m.avgSentence < 8 && m.words > 200) pen(6, { level: 'info', text: `Sentences are very short on average (${m.avgSentence} words) — combine some for a smoother rhythm.` });
  if (m.longPct > 15) pen(10, { level: 'warn', text: `${m.longPct}% of sentences are over 30 words. Break up the longest ones.` });
  if (m.passivePct > 10) pen(10, { level: 'warn', text: `${m.passivePct}% of sentences use the passive voice. Prefer active verbs (“The storm hit the town”).` });
  if (m.adverbPct > 3) pen(8, { level: 'warn', text: `Adverbs make up ${m.adverbPct}% of words. Replace “ran quickly” with stronger verbs like “sprinted”.` });
  if (m.complexPct > 18) pen(8, { level: 'info', text: `${m.complexPct}% of words have three or more syllables. Simpler words read faster.` });
  if (m.variety < 4 && m.sentenceCount > 15) pen(6, { level: 'info', text: 'Sentence lengths are very uniform. Mix short and long sentences for rhythm.' });
  if (fiction && m.words > 1500 && m.dialoguePct < 5) tips.push({ level: 'info', text: 'Very little dialogue. Conversation can bring scenes to life — if it suits your story.' });
  if (m.grade > 12) pen(8, { level: 'info', text: `Reading grade ${m.grade} — suited to academic readers. Most popular fiction sits at grade 6–9.` });
  if (m.ease < 50) pen(6, { level: 'info', text: `Flesch reading ease is ${m.ease} (difficult). Shorter sentences and words raise it.` });
  if (!tips.length) tips.push({ level: 'ok', text: 'Clear, well-balanced prose. Nothing major to fix.' });
  score = Math.max(0, Math.min(100, Math.round(score * 0.6 + m.ease * 0.4)));
  return { score, tips };
}

// ---------- originality ----------
function shingles(ws, n) {
  const out = [];
  for (let k = 0; k + n <= ws.length; k++) out.push(ws.slice(k, k + n).join(' '));
  return out;
}

/**
 * Compare the manuscript with reference texts (other projects, sources you add, famous passages).
 * sources: [{ id, title, text, kind }]
 * Returns matched passages and an originality percentage.
 */
export function originalityCheck(units, sources, { n = 7 } = {}) {
  const index = new Map();
  for (const s of sources) {
    const ws = words(s.text).map(norm);
    shingles(ws, n).forEach((sh, k) => { if (!index.has(sh)) index.set(sh, { src: s, pos: k, ws }); });
  }
  const matches = [];
  let total = 0, matched = 0;
  for (const u of units) {
    const ws = words(u.text).map(norm);
    total += ws.length;
    const hit = new Array(ws.length).fill(null);
    shingles(ws, n).forEach((sh, k) => {
      const m = index.get(sh);
      if (m) for (let j = k; j < k + n; j++) hit[j] = hit[j] || m;
    });
    // Group consecutive hits into passages
    for (let i = 0; i < ws.length;) {
      if (!hit[i]) { i++; continue; }
      const src = hit[i].src;
      let j = i;
      while (j < ws.length && hit[j] && hit[j].src === src) j++;
      matched += j - i;
      const srcPos = hit[i].pos;
      matches.push({
        id: u.id, title: u.title, source: src.title, kind: src.kind, words: j - i,
        text: ws.slice(i, j).join(' '),
        sourceText: hit[i].ws.slice(Math.max(0, srcPos - 3), srcPos + (j - i) + 3).join(' '),
      });
      i = j;
    }
  }
  return {
    totalWords: total,
    matchedWords: matched,
    originality: total ? Math.round((1 - matched / total) * 1000) / 10 : 100,
    matches: matches.sort((a, b) => b.words - a.words),
  };
}

// Famous passages (public domain or widely quoted) to catch borrowed lines.
export const FAMOUS_PASSAGES = [
  ['A Tale of Two Cities — Dickens', 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness'],
  ['Pride and Prejudice — Austen', 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife'],
  ['Moby-Dick — Melville', 'Call me Ishmael. Some years ago never mind how long precisely having little or no money in my purse'],
  ['Anna Karenina — Tolstoy', 'Happy families are all alike; every unhappy family is unhappy in its own way'],
  ['1984 — Orwell', 'It was a bright cold day in April, and the clocks were striking thirteen'],
  ['The Great Gatsby — Fitzgerald', 'So we beat on, boats against the current, borne back ceaselessly into the past'],
  ['The Hobbit — Tolkien', 'In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell'],
  ['Hamlet — Shakespeare', 'To be, or not to be, that is the question: whether tis nobler in the mind to suffer the slings and arrows of outrageous fortune'],
  ['Macbeth — Shakespeare', 'Tomorrow, and tomorrow, and tomorrow, creeps in this petty pace from day to day'],
  ['Romeo and Juliet — Shakespeare', 'What is in a name? That which we call a rose by any other name would smell as sweet'],
  ['Jane Eyre — Brontë', 'Reader, I married him. A quiet wedding we had: he and I, the parson and clerk, were alone present'],
  ['Alice in Wonderland — Carroll', 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do'],
  ['Frankenstein — Shelley', 'Beware; for I am fearless, and therefore powerful'],
  ['The Raven — Poe', 'Once upon a midnight dreary, while I pondered, weak and weary, over many a quaint and curious volume of forgotten lore'],
  ['Genesis 1:1', 'In the beginning God created the heaven and the earth. And the earth was without form, and void'],
  ['Psalm 23', 'The Lord is my shepherd; I shall not want. He maketh me to lie down in green pastures'],
  ['Gettysburg Address — Lincoln', 'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty'],
  ['I Have a Dream — King', 'I have a dream that my four little children will one day live in a nation where they will not be judged by the color of their skin but by the content of their character'],
  ['Declaration of Independence', 'We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights'],
  ['The Road Not Taken — Frost', 'Two roads diverged in a wood, and I, I took the one less traveled by, and that has made all the difference'],
  ['Sonnet 18 — Shakespeare', 'Shall I compare thee to a summer’s day? Thou art more lovely and more temperate'],
  ['Don Quixote — Cervantes', 'In a village of La Mancha, the name of which I have no desire to call to mind, there lived not long since one of those gentlemen'],
  ['The Old Man and the Sea — Hemingway', 'He was an old man who fished alone in a skiff in the Gulf Stream and he had gone eighty-four days now without taking a fish'],
  ['Dracula — Stoker', 'Listen to them, the children of the night. What music they make'],
  ['Peter Pan — Barrie', 'All children, except one, grow up. They soon know that they will grow up'],
  ['The Little Prince — Saint-Exupéry', 'It is only with the heart that one can see rightly; what is essential is invisible to the eye'],
  ['Les Misérables — Hugo', 'Even the darkest night will end and the sun will rise'],
  ['Desiderata — Ehrmann', 'Go placidly amid the noise and haste, and remember what peace there may be in silence'],
].map(([title, text], i) => ({ id: `famous-${i}`, title, text, kind: 'famous' }));
