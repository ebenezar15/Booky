// Writing-flow helpers (pure, unit-tested): split/merge chapters, placeholders and notes to self,
// sentences for read-aloud, voice choice, and quick-jump search.

const decode = (s) => String(s || '').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
export const plainText = (html) => decode(String(html || '').replace(/<(br|\/p|\/h\d|\/li|\/blockquote)[^>]*>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** After a split: if the new part starts with a heading, use it as the title and drop it from the text. */
export function titleFromHtml(html) {
  const m = String(html || '').match(/^\s*<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/i);
  if (!m) return { title: '', html };
  const title = plainText(m[2]).trim();
  const rest = String(html).slice(m[0].length).trim();
  return { title, html: rest || '<p></p>' };
}

const isEmptyDoc = (html) => !String(html || '').replace(/<p>\s*<\/p>/g, '').trim();

/** Join two chapters; the second chapter's title is kept as a subheading so nothing is lost. */
export function mergeHtml(a, b, bTitle = '') {
  const head = bTitle.trim() ? `<h2>${esc(bTitle.trim())}</h2>` : '';
  if (isEmptyDoc(b)) return head ? `${a}${head}` : a;
  return `${isEmptyDoc(a) ? '' : a}${head}${b}`;
}

/** Append moved text at the end of a chapter. */
export const appendHtml = (target, moved) => (isEmptyDoc(target) ? moved : `${target}${moved}`);

// ---------- placeholders and notes to self ----------
// TK / TKTK and XX are the publishing conventions for "to come"; [[…]] and ??? are common author markers.
const PLACEHOLDER_RE = /\b(TK(?:TK)*|XX+)\b|\[\[[^\]\n]{0,120}\]\]|\?{3,}/g;

/** Every placeholder and note to self: [{ elId, kind: 'placeholder'|'note', text, context, index }] in book order. */
export function findPlaceholders(elements) {
  const out = [];
  for (const el of elements) {
    const html = String(el.content || '');
    for (const m of html.matchAll(/<span\b[^>]*data-type="authornote"[^>]*>/gi)) {
      const t = (m[0].match(/\sdata-text="([^"]*)"/i) || [])[1] || '';
      out.push({ elId: el.id, kind: 'note', text: decode(t), context: '', index: out.filter((o) => o.elId === el.id && o.kind === 'note').length });
    }
    const text = plainText(html.replace(/<span\b[^>]*data-type="authornote"[^>]*>(<\/span>)?/gi, ''));
    let k = 0;
    for (const m of text.matchAll(PLACEHOLDER_RE)) {
      const a = Math.max(0, m.index - 30), b = Math.min(text.length, m.index + m[0].length + 30);
      out.push({ elId: el.id, kind: 'placeholder', text: m[0], context: text.slice(a, b).replace(/\s+/g, ' ').trim(), index: k++ });
    }
  }
  return out;
}

// ---------- read aloud ----------
/** Sentences with offsets: [{ start, end, text }]. Uses Intl.Segmenter when available (handles Indic and Urdu full stops). */
export function splitSentences(text, lang = 'en') {
  const out = [];
  try {
    const seg = new Intl.Segmenter(lang, { granularity: 'sentence' });
    for (const s of seg.segment(text)) {
      const lead = s.segment.match(/^\s*/)[0].length;
      const body = s.segment.trim();
      if (body) out.push({ start: s.index + lead, end: s.index + lead + body.length, text: body });
    }
    return out;
  } catch {
    const re = /[^.!?।۔]+[.!?।۔]*["'”’)]*\s*/g;
    let m;
    while ((m = re.exec(text))) {
      const body = m[0].trim();
      if (body) { const st = m.index + m[0].indexOf(body); out.push({ start: st, end: st + body.length, text: body }); }
    }
    return out;
  }
}

/** The best voice for a language: exact match, then same language, preferring local (offline) voices. */
export function pickVoice(voices, lang = 'en', preferredName = '') {
  const want = String(lang || 'en').toLowerCase();
  const base = want.split('-')[0];
  if (preferredName) { const v = voices.find((x) => x.name === preferredName); if (v) return v; }
  const score = (v) => {
    const l = String(v.lang || '').toLowerCase().replace('_', '-');
    if (l.split('-')[0] !== base) return -1;
    return (l === want ? 4 : 2) + (v.localService ? 1 : 0) + (v.default ? 0.5 : 0);
  };
  const ranked = voices.map((v) => [score(v), v]).filter(([s]) => s >= 0).sort((a, b) => b[0] - a[0]);
  return ranked[0]?.[1] || null;
}

// ---------- quick jump ----------
/** "p 142", "page 142", "p.142" → 142 */
export function parsePageQuery(q) {
  const m = String(q).trim().match(/^(?:p|pg|page)\.?\s*(\d{1,5})$/i);
  return m ? +m[1] : 0;
}

const norm = (s) => String(s || '').toLocaleLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** Score a candidate: whole start > word start > anywhere > in-order letters (fuzzy). 0 = no match. */
export function matchScore(text, q) {
  const t = norm(text), s = norm(q).trim();
  if (!s) return 1;
  if (t.startsWith(s)) return 100 - Math.min(40, t.length - s.length);
  const i = t.indexOf(s);
  if (i >= 0) return (/[\s\p{P}]/u.test(t[i - 1] || ' ') ? 70 : 50) - Math.min(30, i);
  // every word of the query somewhere in the text ("half second" finds "The Second Half")
  const words = s.split(/\s+/);
  if (words.length > 1) return words.every((w) => t.includes(w)) ? 40 : 0;
  // single word: letters in order (typos and abbreviations, "lghthse"), only for 3+ letters
  if (s.length < 3) return 0;
  let j = 0;
  for (const ch of t) if (ch === s[j]) j++;
  return j === s.length ? 20 : 0;
}

/**
 * Places to jump to: [{ kind: 'chapter'|'heading'|'bible'|'recent', label, sub, elId, headingIndex, bibleId }].
 * titleOf(el) gives the display title.
 */
export function jumpCandidates(book, titleOf, recent = []) {
  const out = [];
  const byId = new Map(book.elements.map((e) => [e.id, e]));
  for (const id of recent) { const el = byId.get(id); if (el) out.push({ kind: 'recent', label: titleOf(el), sub: 'Recent', elId: id }); }
  for (const el of book.elements) {
    const title = titleOf(el);
    out.push({ kind: 'chapter', label: title, sub: '', elId: el.id });
    let i = 0;
    for (const m of String(el.content || '').matchAll(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
      const t = plainText(m[2]).trim();
      if (t) out.push({ kind: 'heading', label: t, sub: title, elId: el.id, headingIndex: i });
      i++;
    }
  }
  for (const b of book.bible || []) if (b.name) out.push({ kind: 'bible', label: b.name, sub: `Story bible · ${b.kind || 'entry'}`, bibleId: b.id });
  return out;
}

export function searchJump(cands, q, limit = 30) {
  if (!String(q).trim()) return cands.filter((c) => c.kind === 'recent' || c.kind === 'chapter').slice(0, limit);
  return cands.filter((c) => c.kind !== 'recent')
    .map((c) => [matchScore(c.label, q) + (c.kind === 'chapter' ? 5 : 0), c]).filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, c]) => c);
}

/** Which top-level block of which page starts a printed page: pages = [{ page, elId, block }] → entry for page n. */
export const pageTarget = (pages, n) => pages.find((p) => p.page === n) || null;
