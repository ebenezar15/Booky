// Back-of-book index and cross-references (pure helpers, unit-tested).
//
// Index entries are invisible marks in the text: <span data-type="index" data-id="…" data-term="…"
// data-sub="…" data-see="…" data-see-also="…">. Cross-references are
// <span data-type="xref" data-target="s:EL" | "h:EL:Heading text" | "f:EL:N" data-label="…">.

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decode(m[2] ?? m[3] ?? '') : '';
};
const decode = (s) => String(s || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Index marks in reading order: { id, term, sub, see, seeAlso, elId }. */
export function collectIndexMarks(elements) {
  const out = [];
  for (const el of elements) {
    (String(el.content || '').match(/<span\b[^>]*data-type="index"[^>]*>/gi) || []).forEach((tag, k) => {
      const term = attr(tag, 'data-term').trim();
      if (!term) return;
      out.push({ id: markId(el.id, attr(tag, 'data-id'), k), term, sub: attr(tag, 'data-sub').trim(), see: attr(tag, 'data-see').trim(), seeAlso: attr(tag, 'data-see-also').trim(), elId: el.id });
    });
  }
  return out;
}

/** Anchor id of an index mark (the k-th mark in its page when it has no id of its own). */
export const markId = (elId, id, k) => String(id || `${elId}-${k}`).replace(/[^\w-]/g, '');

/** Terms with how often they are marked, sorted for the language. */
export function termCounts(marks, lang = 'en') {
  const map = new Map();
  for (const m of marks) map.set(m.term, (map.get(m.term) || 0) + 1);
  const coll = new Intl.Collator(lang, { sensitivity: 'base', numeric: true });
  return [...map].map(([term, count]) => ({ term, count })).sort((a, b) => coll.compare(a.term, b.term));
}

/** The letter an entry is filed under: the first letter, upper-cased for the language; digits and symbols under "#". */
export function groupLetter(term, lang = 'en') {
  const ch = [...String(term).trim()][0] || '#';
  if (!/\p{L}/u.test(ch)) return '#';
  return ch.toLocaleUpperCase(lang);
}

/**
 * Build the index structure.
 * @returns [{ letter, entries: [{ term, refs: [markIds], see, seeAlso, subs: [{ term, refs, see, seeAlso }] }] }]
 */
export function buildIndex(marks, lang = 'en') {
  const coll = new Intl.Collator(lang, { sensitivity: 'base', numeric: true });
  const entries = new Map();
  const get = (map, term) => {
    const key = term.toLocaleLowerCase(lang);
    if (!map.has(key)) map.set(key, { term, refs: [], see: '', seeAlso: new Set(), subsMap: new Map() });
    return map.get(key);
  };
  for (const m of marks) {
    const e = get(entries, m.term);
    const target = m.sub ? get(e.subsMap, m.sub) : e;
    if (m.see) target.see = m.see; else target.refs.push(m.id);
    if (m.seeAlso) target.seeAlso.add(m.seeAlso);
  }
  const finish = (e) => ({ term: e.term, refs: e.refs, see: e.see, seeAlso: [...e.seeAlso].sort(coll.compare) });
  const list = [...entries.values()].map((e) => ({ ...finish(e), subs: [...e.subsMap.values()].map(finish).sort((a, b) => coll.compare(a.term, b.term)) }))
    .sort((a, b) => coll.compare(a.term, b.term));
  const groups = [];
  for (const e of list) {
    const letter = groupLetter(e.term, lang);
    if (!groups.length || groups[groups.length - 1].letter !== letter) groups.push({ letter, entries: [] });
    groups[groups.length - 1].entries.push(e);
  }
  // "#" (numbers and symbols) first, as most indexes do
  groups.sort((a, b) => (a.letter === '#' ? -1 : b.letter === '#' ? 1 : 0));
  return groups;
}

const ROMAN = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
const romanValue = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { const v = ROMAN[s[i]], n = ROMAN[s[i + 1]] || 0; t += v < n ? -v : v; } return t; };
const pageValue = (p) => (/^\d+$/.test(p) ? { kind: 'n', v: +p } : /^[ivxlcdm]+$/i.test(p) ? { kind: 'r', v: romanValue(p.toLowerCase()) } : { kind: 'x', v: 0 });

/** "12, 13, 14, 20, 20, ix" → "ix, 12–14, 20": de-duplicated, roman pages first, consecutive pages merged. */
export function mergePageRanges(pages) {
  const uniq = [...new Set(pages.map(String).filter(Boolean))];
  const items = uniq.map((p) => ({ p, ...pageValue(p) }));
  const order = { r: 0, n: 1, x: 2 };
  items.sort((a, b) => order[a.kind] - order[b.kind] || a.v - b.v);
  const out = [];
  for (let i = 0; i < items.length;) {
    let j = i;
    while (j + 1 < items.length && items[j + 1].kind === items[i].kind && items[i].kind !== 'x' && items[j + 1].v === items[j].v + 1) j++;
    out.push(j > i ? `${items[i].p}–${items[j].p}` : items[i].p);
    i = j + 1;
  }
  return out.join(', ');
}

// ---------- cross-references ----------
/** Parse a cross-reference target: { kind: 'section' | 'heading' | 'figure', elId, text, index }. */
export function parseXrefTarget(t) {
  const [kind, elId, ...rest] = String(t || '').split(':');
  const tail = rest.join(':');
  if (kind === 's') return { kind: 'section', elId };
  if (kind === 'h') return { kind: 'heading', elId, text: tail };
  if (kind === 'f') return { kind: 'figure', elId, index: +tail || 0 };
  return { kind: 'unknown', elId };
}

/** Cross-references in the manuscript: { elId, target, label }. */
export function collectXrefs(elements) {
  const out = [];
  for (const el of elements) {
    for (const tag of String(el.content || '').match(/<span\b[^>]*data-type="xref"[^>]*>/gi) || []) out.push({ elId: el.id, target: attr(tag, 'data-target'), label: attr(tag, 'data-label') });
  }
  return out;
}

/** For plain-text exports: cross-references become their label, index marks and notes to self disappear. */
export const xrefsToText = (html) => String(html)
  .replace(/<span\b[^>]*data-type="xref"[^>]*>(?:<\/span>)?/gi, (tag) => escAttr(attr(tag, 'data-label')))
  .replace(/<span\b[^>]*data-type="(index|authornote)"[^>]*>(?:<\/span>)?/gi, '');

const plain = (html) => decode(String(html).replace(/<[^>]+>/g, '')).trim();

/** Is the target still there? (elements are the book's elements) */
export function xrefResolves(elements, target) {
  const t = parseXrefTarget(target);
  const el = elements.find((e) => e.id === t.elId);
  if (!el) return false;
  if (t.kind === 'section') return true;
  if (t.kind === 'heading') return (String(el.content || '').match(/<h[1-4]\b[^>]*>[\s\S]*?<\/h[1-4]>/gi) || []).some((h) => plain(h) === t.text);
  if (t.kind === 'figure') return (String(el.content || '').match(/<img\b/gi) || []).length > t.index;
  return false;
}

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const termOfTag = (tag) => attr(tag, 'data-term');

/** Insert a mark before every whole-word occurrence of `word` (in text, not inside tags) that has no mark yet. */
export function markAllInHtml(html, word, term) {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${esc})(?![\\p{L}\\p{N}])`, 'giu');
  let added = 0;
  const parts = String(html).split(/(<[^>]+>)/);
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i] || parts[i].startsWith('<')) continue;
    parts[i] = parts[i].replace(re, (all, pre, w, off, str) => {
      let j = i - 1;
      while (j > 0 && (!parts[j] || parts[j] === '</span>')) j--;
      const before = parts[j] || '';
      if (off === 0 && /data-type="index"/.test(before) && termOfTag(before) === term) return all; // already marked here
      added++;
      return `${pre}<span data-type="index" data-id="${Math.random().toString(36).slice(2, 10)}" data-term="${escAttr(term)}"></span>${w}`;
    });
  }
  return { html: parts.join(''), added };
}

