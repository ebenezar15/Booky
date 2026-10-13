// Typographic clean-up and Indian-language / Urdu text checks (pure, unit-tested).

const NBSP = ' ', NNBSP = ' ';
const UNITS = 'km|m|cm|mm|kg|g|mg|lb|lbs|oz|ml|l|L|mph|km/h|kph|ft|in|yd|mi|°C|°F|°|%|kB|MB|GB|TB|Hz|kHz|MHz|GHz|W|kW|V|A|h|min|s|ms|am|pm|a\\.m\\.|p\\.m\\.';
const TITLES = 'Mr|Mrs|Ms|Mx|Dr|Prof|St|Sr|Jr|Rev|Capt|Col|Gen|Lt|Sgt|Hon|Mt';
// Leading apostrophes in common contractions: ’90s, ’em, ’tis, ’twas, ’cause, ’til, ’n’
const LEADING_APOS = /(^|[\s(\[—–-])'(?=(\d0s|\d\ds|em\b|tis\b|twas\b|cause\b|til\b|round\b|n'?\b|bout\b|im\b|er\b))/giu;

/**
 * Clean one run of text. `prev` is the text before it in the same paragraph (for quote direction).
 * opts: { lang, quotes: 'double'|'single' }
 */
export function cleanText(text, prev = '', { lang = 'en' } = {}) {
  const french = /^fr/i.test(lang);
  let t = text;
  // ellipses
  t = t.replace(/\.\s?\.\s?\.(?!\.)/g, '…');
  // double (or more) spaces
  t = t.replace(/ {2,}/g, ' ');
  // space before punctuation (French keeps a narrow no-break space before ; : ! ? and inside « »)
  if (french) {
    t = t.replace(/[  ]*([;:!?»])/g, `${NNBSP}$1`).replace(/(«)[  ]*/g, `$1${NNBSP}`);
  } else {
    t = t.replace(/(\S)[  ]+([,.;:!?…)\]])/g, '$1$2');
  }
  // leading apostrophes, then the remaining quotes by context
  t = t.replace(LEADING_APOS, '$1’');
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c !== '"' && c !== "'") { out += c; continue; }
    const before = (prev + out).slice(-1);
    const after = t[i + 1] || '';
    const opening = !before || /[\s(\[{—–\-“‘«/]/u.test(before);
    if (c === "'") {
      // apostrophe inside or at the end of a word: don’t, James’
      if (/[\p{L}\p{N}]/u.test(before) && (!after || /[\p{L}\p{N}\s.,;:!?)\]—–…]/u.test(after))) { out += '’'; continue; }
      out += opening ? '‘' : '’';
    } else out += opening ? '“' : '”';
  }
  t = out;
  // no-break spaces: number + unit, titles, "Chapter 12", "page 4", "p. 4", "No. 5"
  t = t.replace(new RegExp(`(\\d) (?=(?:${UNITS})(?![\\p{L}]))`, 'gu'), `$1${NBSP}`);
  t = t.replace(new RegExp(`\\b(${TITLES})\\. (?=\\p{Lu})`, 'gu'), `$1.${NBSP}`);
  t = t.replace(/\b(Chapter|chapter|Part|part|Page|page|pp?\.|No\.|Figure|figure|Fig\.|Table|table|Vol\.|vol\.|Section|section|§) (?=\d)/g, `$1${NBSP}`);
  return t;
}

/** Clean every text run of an HTML string. Returns { html, changes: [{ before, after }] } (changes are short snippets). */
export function cleanHtml(html, opts = {}) {
  const parts = String(html).split(/(<[^>]+>)/);
  const changes = [];
  let para = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith('<')) { if (/^<\/?(p|h\d|li|blockquote|div|br)\b/i.test(p)) para = ''; continue; }
    const decoded = p.replace(/&nbsp;/g, NBSP).replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const cleaned = cleanText(decoded, para, opts);
    if (cleaned !== decoded) {
      const snippet = (s) => s.replace(new RegExp(NBSP, 'g'), '⍽').replace(new RegExp(NNBSP, 'g'), '⍽').slice(0, 90);
      changes.push({ before: snippet(decoded), after: snippet(cleaned) });
      parts[i] = cleaned.replace(/&(?!(amp|lt|gt|quot|#\d+|#x[0-9a-f]+|nbsp);)/gi, '&amp;');
    }
    para += cleaned;
  }
  return { html: parts.join(''), changes };
}

// ---------- Indian scripts and Urdu ----------
const SCRIPTS = ['Devanagari', 'Bengali', 'Gurmukhi', 'Gujarati', 'Oriya', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Sinhala', 'Arabic'];
const scriptOf = (ch) => SCRIPTS.find((s) => new RegExp(`\\p{Script=${s}}`, 'u').test(ch)) || (/\p{Script=Latin}/u.test(ch) ? 'Latin' : /\p{N}/u.test(ch) ? 'Digit' : '');
const MAIN_SCRIPT = { hi: 'Devanagari', mr: 'Devanagari', ne: 'Devanagari', sa: 'Devanagari', bn: 'Bengali', as: 'Bengali', pa: 'Gurmukhi', gu: 'Gujarati', or: 'Oriya', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam', si: 'Sinhala', ur: 'Arabic', ar: 'Arabic', fa: 'Arabic' };
// Arabic-letter forms that look like Urdu letters but are different characters: [wrong, right, name]
const URDU_LOOKALIKES = [['ي', 'ی', 'Arabic yeh ي → Urdu choti yeh ی'], ['ك', 'ک', 'Arabic kaf ك → Urdu kaf ک'], ['ه', 'ہ', 'Arabic heh ه → Urdu heh goal ہ'], ['ى', 'ی', 'Alef maksura ى → choti yeh ی'], ['٠', '۰', 'Arabic-Indic digits → Urdu digits']];

export const supportsIndicChecks = (lang) => !!MAIN_SCRIPT[String(lang || '').split('-')[0]];

/**
 * Unicode problems in Indian-language and Urdu text.
 * texts: [{ elId, text }]  →  [{ kind, title, detail, hits: [{ elId, index, match }], fix: 'nfc'|'zw'|'lookalike'|null, from, to }]
 */
export function indicFindings(texts, lang) {
  const main = MAIN_SCRIPT[String(lang || '').split('-')[0]];
  if (!main) return [];
  const out = [];
  const add = (kind, title, detail, hits, extra = {}) => { if (hits.length) out.push({ kind, title, detail, hits, ...extra }); };

  // not in NFC: compare each word with its normalised form
  const nfc = [];
  for (const t of texts) for (const m of t.text.matchAll(/[\p{L}\p{M}‌‍]+/gu)) if (m[0] !== m[0].normalize('NFC')) nfc.push({ elId: t.elId, index: m.index, match: m[0] });
  add('nfc', 'Text not in standard (NFC) form', 'These words are stored with decomposed characters — they look the same but break search, sorting and some fonts. “Fix all” normalises them.', nfc, { fix: 'nfc' });

  // stray zero-width joiner / non-joiner: at a word edge, doubled, or next to a space
  const zw = [];
  for (const t of texts) for (const m of t.text.matchAll(/[‌‍]{2,}|(?<![\p{L}\p{M}])[‌‍]|[‌‍](?![\p{L}\p{M}])/gu)) zw.push({ elId: t.elId, index: m.index, match: m[0] });
  add('zw', 'Stray zero-width joiners', 'Invisible joiner (ZWJ) or non-joiner (ZWNJ) characters at the edge of a word or doubled. They have no effect there and confuse search. “Fix all” removes them.', zw, { fix: 'zw' });

  // Latin letters or digits inside a word of the book's script, and letters from another Indian script
  const mixed = [], other = [];
  for (const t of texts) for (const m of t.text.matchAll(/[\p{L}\p{M}\p{N}‌‍]+/gu)) {
    const w = m[0];
    const scripts = new Set([...w].map(scriptOf).filter(Boolean));
    if (!scripts.has(main)) continue;
    if (scripts.has('Latin') || scripts.has('Digit')) mixed.push({ elId: t.elId, index: m.index, match: w });
    else if ([...scripts].some((s) => s !== main)) other.push({ elId: t.elId, index: m.index, match: w });
  }
  add('mixed', 'Latin letters or digits inside a word', 'A word mixes the book’s script with Latin letters or digits — usually a typing slip (e.g. a Latin “o” in place of a vowel sign).', mixed);
  add('other-script', 'Letters from another script inside a word', 'These words contain look-alike letters from another Indian script — they will not be found by search or spell-check.', other);

  // doubled vowel signs / viramas
  const doubled = [];
  for (const t of texts) for (const m of t.text.matchAll(/(\p{M})\1/gu)) doubled.push({ elId: t.elId, index: m.index, match: m[0] });
  add('doubled', 'Doubled vowel sign or virama', 'The same sign typed twice in a row. Fonts show a dotted circle or an odd shape.', doubled);

  // Urdu: Arabic look-alike letters
  if (String(lang).startsWith('ur')) {
    for (const [wrong, right, name] of URDU_LOOKALIKES) {
      const hits = [];
      for (const t of texts) for (const m of t.text.matchAll(new RegExp(wrong, 'gu'))) hits.push({ elId: t.elId, index: m.index, match: m[0] });
      add('lookalike', `Arabic letter instead of Urdu: ${name}`, 'Arabic and Urdu letters look alike but are different characters — mixing them breaks search and spell-check.', hits, { fix: 'lookalike', from: wrong, to: right });
    }
  }
  return out;
}

/** Apply an Indic finding's fix to a text run. */
export function applyIndicFix(text, f) {
  if (f.fix === 'nfc') return text.normalize('NFC');
  if (f.fix === 'zw') return text.replace(/[‌‍]{2,}/g, (m) => m[0]).replace(/(?<![\p{L}\p{M}])[‌‍]|[‌‍](?![\p{L}\p{M}])/gu, '');
  if (f.fix === 'lookalike') return f.from === '٠' ? text.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x06F0)) : text.split(f.from).join(f.to);
  return text;
}

// ---------- paragraph-level comparison ----------
/** Top-level blocks of an HTML string. */
export const blocksOf = (html) => String(html || '').match(/<(p|h[1-6]|blockquote|ul|ol|div|figure)\b[^>]*>[\s\S]*?<\/\1>|<(hr|img)\b[^>]*>/gi) || [];

/**
 * Align old and new paragraphs: [{ op: '=', old, new } | { op: '~', old, new, oldIndex, newIndex } | { op: '-', old, newIndex } | { op: '+', new, newIndex }].
 * '-' = a paragraph that was deleted (restoring re-inserts it at newIndex).
 */
export function paragraphDiff(oldHtml, newHtml) {
  const a = blocksOf(oldHtml), b = blocksOf(newHtml);
  // longest common subsequence of whole paragraphs
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const raw = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { raw.push({ op: '=', old: a[i], new: b[j], newIndex: j }); i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { raw.push({ op: '+', new: b[j], newIndex: j }); j++; }
    else { raw.push({ op: '-', old: a[i], newIndex: j }); i++; }
  }
  // within each run of changes, pair deletions with insertions in order: those are changed paragraphs
  const out = [];
  for (let k = 0; k < raw.length;) {
    if (raw[k].op === '=') { out.push(raw[k++]); continue; }
    const run = [];
    while (k < raw.length && raw[k].op !== '=') run.push(raw[k++]);
    const dels = run.filter((x) => x.op === '-'), ins = run.filter((x) => x.op === '+');
    const pairs = Math.min(dels.length, ins.length);
    for (let q = 0; q < pairs; q++) out.push({ op: '~', old: dels[q].old, new: ins[q].new, newIndex: ins[q].newIndex });
    for (const x of ins.slice(pairs)) out.push(x);
    const at = ins.length ? ins[ins.length - 1].newIndex + 1 : (dels[0]?.newIndex ?? 0);
    dels.slice(pairs).forEach((x, q) => out.push({ ...x, newIndex: at + q - (ins.length - pairs) }));
  }
  return out;
}

/** Restore one paragraph from an older version: replace (op '~') or re-insert (op '-'). */
export function restoreParagraph(currentHtml, change) {
  const blocks = blocksOf(currentHtml);
  if (change.op === '~') blocks.splice(change.newIndex, 1, change.old);
  else if (change.op === '-') blocks.splice(change.newIndex, 0, change.old);
  else if (change.op === '+') blocks.splice(change.newIndex, 1);
  return blocks.join('');
}
