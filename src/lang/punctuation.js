// Punctuation checker for every language Booky writes in (pure, unit-tested).
// Shared rules (spacing, doubled marks, brackets) plus the conventions of each script:
// Urdu/Arabic ، ؟ ؛ ۔ · Hindi, Sanskrit, Nepali, Bengali, Punjabi, Odia । ॥ · Spanish ¿ ¡ · French spaces before ; : ! ? and inside « » ·
// Chinese and Japanese full-width marks.
// Used live in the editor (underlines) and book-wide in Review → Punctuation.

const base = (lang) => String(lang || 'en').toLowerCase().split('-')[0];
const ARABIC_SCRIPT = new Set(['ur', 'ar', 'fa', 'ps', 'sd', 'ks', 'ug']);
const DANDA = new Set(['hi', 'sa', 'ne', 'bn', 'as', 'pa', 'or', 'mai', 'bho', 'doi', 'kok']);
const CASED = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'pl', 'id', 'sw', 'tr', 'vi', 'da', 'no', 'nb', 'fi', 'ro', 'cs', 'hu', 'ms', 'tl', 'ru', 'uk', 'el']);
const CJK = new Set(['zh', 'ja']);
// common abbreviations that end in a full stop but don't end a sentence
const ABBR = /(?:\b(?:mr|mrs|ms|dr|st|vs|etc|e\.g|i\.e|cf|no|vol|pp?|ch|fig|approx|sr|jr|prof|gen|col|capt|lt|sgt|rev|inc|ltd|co|sra?|dra?|av|ca|bzw|usw|z\.b|vgl|mme|mlle|sig)|\b\p{L})$/iu;

/**
 * Each rule: id, title, detail, kind ('grammar' error | 'style' suggestion), re (global), fix(match, ...groups) → text or null,
 * when(lang) → applies to this language, english: true if the English grammar checker already underlines it live.
 */
export const PUNCT_RULES = [
  {
    id: 'space-before', title: 'Space before punctuation', kind: 'grammar', english: true,
    detail: 'There is a space before a comma, full stop or other mark. Most languages put the mark straight after the word.',
    re: /(?<=[\p{L}\p{M}\p{N}”’")\]])[ \u00A0]+([,.;:!?%،؛؟۔।॥](?![.\d]))/gu, fix: (m, p) => p,
    when: (l) => l !== 'fr',
  },
  {
    id: 'space-before-fr', title: 'Space before punctuation', kind: 'grammar',
    detail: 'In French there is no space before a comma or full stop.',
    re: /(?<=[\p{L}\p{M}\p{N}»)])[ \u00A0\u202F]+([,.)](?![.\d]))/gu, fix: (m, p) => p,
    when: (l) => l === 'fr',
  },
  {
    id: 'space-after', title: 'Missing space after punctuation', kind: 'grammar', english: true,
    detail: 'A comma, semicolon, question mark or similar mark is followed straight away by the next word.',
    re: /(?<=[\p{L}\p{M}][”’"]?)([,;!?،؛؟।॥])(?=[\p{L}])/gu, fix: (m, p) => `${p} `,
    when: (l) => !CJK.has(l),
  },
  {
    id: 'space-after-stop', title: 'Missing space after a full stop', kind: 'grammar', english: true,
    detail: 'A sentence ends and the next one begins without a space.',
    re: /(?<=[\p{Ll}]{2})\.(?=\p{Lu}(?:\p{Ll}|[\s,']|$))/gu, fix: () => '. ',
    when: (l) => CASED.has(l),
  },
  {
    id: 'doubled', title: 'Doubled punctuation', kind: 'grammar',
    detail: 'The same mark is typed twice (,, ;; ::), or a comma and full stop sit together.',
    re: /([,;:،؛])\1+|,\.(?!\.)|\.,|(?<![.\d])\.\.(?![.\d])/gu, fix: (m) => (m === ',.' || m === '..' ? '.' : m === '.,' ? '.' : m[0]),
  },
  {
    id: 'many-stops', title: 'Too many dots', kind: 'style',
    detail: 'Four or more dots in a row. Use a single ellipsis (…).',
    re: /\.{4,}/g, fix: () => '…',
  },
  {
    id: 'exclaim', title: 'Repeated ! or ?', kind: 'style', english: true,
    detail: 'Two or more exclamation or question marks. One is usually enough in published prose.',
    re: /([!?！？])\1+/gu, fix: (m, p) => p,
  },
  {
    id: 'bracket-space', title: 'Space inside brackets', kind: 'grammar',
    detail: 'Brackets hug the words they enclose: “(like this)”, not “( like this )”.',
    re: /([([])[ \u00A0]+(?=\S)|(?<=\S)[ \u00A0]+([)\]])/gu, fix: (m, a, b) => a || b,
  },
  {
    id: 'hyphen-dash', title: 'Hyphen used as a dash', kind: 'style',
    detail: 'A hyphen with spaces round it is usually meant as a dash (— or –).',
    re: /(?<=[\p{L}\p{M}]) - (?=[\p{L}])/gu, fix: () => ' — ',
  },
  {
    id: 'capital-after-stop', title: 'Small letter after a full stop', kind: 'grammar',
    detail: 'A new sentence usually starts with a capital letter.',
    re: /(?<=([\p{L}.]+)[.!?]["”’)]?[ \u00A0]+)(\p{Ll})/gu,
    fix: (m) => m.toUpperCase(),
    test: (text, index) => {
      const before = text.slice(Math.max(0, index - 30), index).replace(/["”’)]?[ \u00A0]+$/, '');
      if (/[!?]$/.test(before)) return true;
      const word = before.slice(0, -1);
      return !ABBR.test(word) && !/\.\.$|…$/.test(before);
    },
    when: (l) => CASED.has(l) && l !== 'en', // English: the grammar checker does this
  },
  // ---- Urdu, Arabic, Persian ----
  {
    id: 'arabic-comma', title: 'Latin comma in Urdu/Arabic text', kind: 'grammar',
    detail: 'Arabic-script languages use the Arabic comma “،”.',
    re: /(?<=[\p{Script=Arabic}][\p{M}]*[ \u00A0]?),/gu, fix: () => '،',
    when: (l) => ARABIC_SCRIPT.has(l),
  },
  {
    id: 'arabic-question', title: 'Latin question mark in Urdu/Arabic text', kind: 'grammar',
    detail: 'Arabic-script languages use the reversed question mark “؟”.',
    re: /(?<=[\p{Script=Arabic}][\p{M}]*[ \u00A0]?)\?/gu, fix: () => '؟',
    when: (l) => ARABIC_SCRIPT.has(l),
  },
  {
    id: 'arabic-semicolon', title: 'Latin semicolon in Urdu/Arabic text', kind: 'grammar',
    detail: 'Arabic-script languages use “؛”.',
    re: /(?<=[\p{Script=Arabic}][\p{M}]*[ \u00A0]?);/gu, fix: () => '؛',
    when: (l) => ARABIC_SCRIPT.has(l),
  },
  {
    id: 'urdu-stop', title: 'Latin full stop in Urdu', kind: 'grammar',
    detail: 'Urdu ends a sentence with the full stop “۔”, not “.”.',
    re: /(?<=[\p{Script=Arabic}][\p{M}]*[ \u00A0]?)\.(?=\s|$|["”’)])/gu, fix: () => '۔',
    when: (l) => l === 'ur' || l === 'sd' || l === 'ks',
  },
  // ---- danda (Hindi, Sanskrit, Nepali, Bengali, Punjabi, Odia …) ----
  {
    id: 'danda', title: 'Full stop instead of danda', kind: 'grammar',
    detail: 'Sentences in this language end with the danda “।”.',
    re: /(?<=[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Oriya}][\p{M}]*)\.(?=\s|$|["”’)])/gu, fix: () => '।',
    when: (l) => DANDA.has(l),
  },
  {
    id: 'pipe-danda', title: 'Vertical bar instead of danda', kind: 'grammar',
    detail: 'A keyboard bar “|” was typed where a danda “।” (or double danda “॥”) belongs. They look alike but search, line breaking and fonts treat them differently.',
    re: /(?<=[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Oriya}][\p{M}]*[ \u00A0]?)(\|\|?)/gu, fix: (m, p) => (p.length === 2 ? '॥' : '।'),
    when: (l) => DANDA.has(l) || l === 'mr',
  },
  {
    id: 'double-danda', title: 'Two dandas instead of a double danda', kind: 'style',
    detail: 'Use the single character “॥” rather than two “।”.',
    re: /।।/gu, fix: () => '॥',
    when: (l) => DANDA.has(l) || l === 'mr',
  },
  // ---- Spanish ----
  {
    id: 'es-question', title: 'Missing opening question mark “¿”', kind: 'grammar',
    detail: 'Spanish questions open with “¿”.',
    re: /(^|[.!?…»”]\s+|\n)([^¿¡.!?…\n]*?[^\s¿¡.!?…])\?/gu, fix: (m, pre, s) => `${pre}¿${s}?`,
    when: (l) => l === 'es',
  },
  {
    id: 'es-exclaim', title: 'Missing opening exclamation mark “¡”', kind: 'grammar',
    detail: 'Spanish exclamations open with “¡”.',
    re: /(^|[.!?…»”]\s+|\n)([^¿¡.!?…\n]*?[^\s¿¡.!?…])!/gu, fix: (m, pre, s) => `${pre}¡${s}!`,
    when: (l) => l === 'es',
  },
  // ---- French ----
  {
    id: 'fr-space', title: 'Missing space before ; : ! ?', kind: 'grammar',
    detail: 'French puts a thin no-break space before “;”, “:”, “!” and “?”.',
    re: /(?<=[\p{L}\p{M}»)])([;:!?])(?!\/\/)/gu, fix: (m, p) => `\u202F${p}`,
    when: (l) => l === 'fr',
  },
  {
    id: 'fr-guillemets', title: 'No space inside « »', kind: 'grammar',
    detail: 'French guillemets take a no-break space inside: « comme ceci ».',
    re: /«(?=[^\s\u00A0\u202F])|(?<=[^\s\u00A0\u202F])»/gu, fix: (m) => (m === '«' ? '«\u00A0' : '\u00A0»'),
    when: (l) => l === 'fr',
  },
  // ---- Chinese and Japanese ----
  {
    id: 'cjk-fullwidth', title: 'Half-width punctuation in Chinese/Japanese', kind: 'grammar',
    detail: 'Chinese and Japanese text uses full-width marks (，。？！：；).',
    re: /(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])[ ]?([,.?!:;])(?![\d.])/gu,
    fix: (m, p) => ({ ',': '，', '.': '。', '?': '？', '!': '！', ':': '：', ';': '；' })[p],
    when: (l) => CJK.has(l),
  },
];

/** Unmatched brackets and quotation marks, paragraph by paragraph: [{ index, match }]. */
export function unbalanced(text, lang = 'en') {
  const out = [];
  const pairs = { ')': '(', ']': '[', '}': '{', '”': '“', '»': '«', '」': '「', '』': '『', '）': '（' };
  const opens = new Set(Object.values(pairs));
  let offset = 0;
  for (const para of String(text).split('\n')) {
    const stack = [];
    for (let i = 0; i < para.length; i++) {
      const c = para[i];
      if (opens.has(c)) {
        // German and some others use » « reversed; don't guess, only check the common direction
        if (c === '«' && base(lang) === 'de') continue;
        stack.push({ c, i });
      } else if (pairs[c]) {
        if (c === '»' && base(lang) === 'de') continue;
        // "1)" "a)" list markers at the start of a paragraph are fine
        if (c === ')' && /^\s*[\p{L}\p{N}]{1,3}$/u.test(para.slice(0, i))) continue;
        const top = stack[stack.length - 1];
        if (top && top.c === pairs[c]) stack.pop(); else out.push({ index: offset + i, match: c, closing: true });
      }
    }
    // an opening quote left open is normal when speech runs on into the next paragraph
    for (const s of stack) if (s.c !== '“' && s.c !== '«') out.push({ index: offset + s.i, match: s.c, closing: false });
    offset += para.length + 1;
  }
  return out;
}

const rulesFor = (lang) => PUNCT_RULES.filter((r) => !r.when || r.when(base(lang)));

function* ruleHits(rule, text) {
  rule.re.lastIndex = 0;
  for (const m of text.matchAll(rule.re)) {
    if (rule.test && !rule.test(text, m.index)) continue;
    const rep = rule.fix(...m);
    if (rep == null || rep === m[0]) continue;
    yield { index: m.index, match: m[0], replacement: rep };
  }
}

/** Replace every hit of one rule in a piece of plain text. */
export function fixPunctuation(text, ruleId, lang = 'en') {
  const rule = PUNCT_RULES.find((r) => r.id === ruleId);
  if (!rule || (rule.when && !rule.when(base(lang)))) return text;
  let out = '', last = 0;
  for (const hit of ruleHits(rule, text)) { out += text.slice(last, hit.index) + hit.replacement; last = hit.index + hit.match.length; }
  return out + text.slice(last);
}

/** Live issues for one paragraph, in the grammar checker's format. skipEnglish: leave out what grammar.js already reports. */
export function checkPunctuation(text, lang = 'en', { skipEnglish = false } = {}) {
  const out = [];
  for (const rule of rulesFor(lang)) {
    if (skipEnglish && rule.english && base(lang) === 'en') continue;
    for (const hit of ruleHits(rule, text)) {
      out.push({ start: hit.index, end: hit.index + hit.match.length, kind: rule.kind, rule: `punct-${rule.id}`, title: rule.title, message: rule.detail, replacements: [hit.replacement] });
    }
  }
  for (const u of unbalanced(text, lang)) {
    out.push({ start: u.index, end: u.index + 1, kind: 'grammar', rule: 'punct-unbalanced', title: u.closing ? 'Closing mark without an opening one' : 'Bracket never closed', message: u.closing ? `This “${u.match}” has no matching opening mark in the paragraph.` : `This “${u.match}” is never closed in the paragraph.`, replacements: [] });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Book-wide findings for Review → Punctuation, grouped by rule: [{ kind, id, title, detail, hits: [{ elId, index, match, replacement }] }]. */
export function punctuationFindings(units, lang = 'en') {
  const out = [];
  for (const rule of rulesFor(lang)) {
    const hits = [];
    for (const u of units) for (const hit of ruleHits(rule, u.text)) hits.push({ elId: u.elId, ...hit });
    if (hits.length) out.push({ kind: rule.kind, id: rule.id, title: rule.title, detail: rule.detail, hits, fix: true });
  }
  const unb = [];
  for (const u of units) for (const hit of unbalanced(u.text, lang)) unb.push({ elId: u.elId, ...hit });
  if (unb.length) out.push({ kind: 'grammar', id: 'unbalanced', title: 'Unmatched brackets or quotation marks', detail: 'A bracket or quotation mark has no partner in its paragraph. (An opening “ left open is fine when speech continues into the next paragraph.)', hits: unb, fix: false });
  return out.sort((a, b) => (a.kind === b.kind ? b.hits.length - a.hits.length : a.kind === 'grammar' ? -1 : 1));
}
