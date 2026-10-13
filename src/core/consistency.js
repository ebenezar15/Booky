// House style sheet and consistency checks (pure, unit-tested).
// A style sheet is the copyeditor's record of the book's choices; the checker finds places that differ from it
// (or, where the sheet says nothing, from the book's own first use).

export const STYLE_SHEET_DEFAULTS = {
  variety: 'us', // us | uk | in (Indian English follows UK spelling)
  serialComma: true,
  dash: 'em-closed', // em-closed "word—word" | en-spaced "word – word"
  quotes: 'double', // double “…” (single inside) | single ‘…’ (double inside)
  ellipsis: 'char', // char … | dots ... | spaced . . .
  numbers: 'words-100', // words-10 | words-100 | numerals
  percent: 'percent', // percent | per-cent | symbol
  dates: 'mdy', // mdy (October 13, 2026) | dmy (13 October 2026)
  words: [], // [{ word, note }]
};

export const normalizeStyleSheet = (s) => ({ ...STYLE_SHEET_DEFAULTS, ...(s || {}), words: Array.isArray(s?.words) ? s.words : [] });

// US ⇄ UK spellings (UK forms are also Indian English). Pairs are [us, uk].
export const SPELLING_PAIRS = [
  ['color', 'colour'], ['favor', 'favour'], ['honor', 'honour'], ['humor', 'humour'], ['labor', 'labour'], ['neighbor', 'neighbour'], ['flavor', 'flavour'], ['harbor', 'harbour'], ['behavior', 'behaviour'], ['rumor', 'rumour'], ['savior', 'saviour'], ['armor', 'armour'], ['odor', 'odour'], ['valor', 'valour'], ['vapor', 'vapour'], ['parlor', 'parlour'],
  ['center', 'centre'], ['theater', 'theatre'], ['meter', 'metre'], ['liter', 'litre'], ['fiber', 'fibre'], ['somber', 'sombre'], ['luster', 'lustre'],
  ['realize', 'realise'], ['recognize', 'recognise'], ['organize', 'organise'], ['apologize', 'apologise'], ['criticize', 'criticise'], ['memorize', 'memorise'], ['emphasize', 'emphasise'], ['summarize', 'summarise'], ['sympathize', 'sympathise'], ['agonize', 'agonise'], ['analyze', 'analyse'], ['paralyze', 'paralyse'], ['cozy', 'cosy'],
  ['defense', 'defence'], ['offense', 'offence'], ['license', 'licence'], ['pretense', 'pretence'],
  ['gray', 'grey'], ['plow', 'plough'], ['mold', 'mould'], ['skeptic', 'sceptic'], ['aluminum', 'aluminium'], ['tire', 'tyre'], ['curb', 'kerb'], ['pajamas', 'pyjamas'], ['mom', 'mum'], ['jewelry', 'jewellery'], ['catalog', 'catalogue'], ['dialog', 'dialogue'], ['program', 'programme'], ['check', 'cheque'],
  ['traveled', 'travelled'], ['traveling', 'travelling'], ['traveler', 'traveller'], ['canceled', 'cancelled'], ['canceling', 'cancelling'], ['labeled', 'labelled'], ['modeled', 'modelled'], ['fueled', 'fuelled'], ['quarreled', 'quarrelled'], ['marvelous', 'marvellous'], ['jeweler', 'jeweller'],
  ['judgment', 'judgement'], ['acknowledgment', 'acknowledgement'], ['aging', 'ageing'], ['toward', 'towards'], ['afterward', 'afterwards'], ['airplane', 'aeroplane'], ['maneuver', 'manoeuvre'], ['fetus', 'foetus'], ['anesthetic', 'anaesthetic'], ['encyclopedia', 'encyclopaedia'],
];
// Hyphenation / spacing variants that are style choices in any variety: [preferred, ...variants] (first is the usual modern choice).
export const FORM_VARIANTS = [
  ['email', 'e-mail'], ['online', 'on-line'], ['website', 'web site'], ['okay', 'OK', 'ok', 'O.K.'], ['all right', 'alright'], ['cooperate', 'co-operate'], ['coordinate', 'co-ordinate'], ['nowadays', 'nowdays'], ['today', 'to-day'], ['tomorrow', 'to-morrow'], ['grown-up', 'grownup'], ['goodbye', 'good-bye'], ['healthcare', 'health care'], ['T-shirt', 't-shirt', 'tee shirt'],
];

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** 0–100 as words ("forty-two"). */
export function numberToWords(n) {
  if (n < 20) return NUMBER_WORDS[n];
  if (n === 100) return 'one hundred';
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${NUMBER_WORDS[n % 10]}` : '');
}

/** Levenshtein distance (for name near-misses). */
export function editDistance(a, b) {
  a = [...a]; b = [...b];
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = t;
    }
  }
  return prev[b.length];
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (w, flags = 'gu') => new RegExp(`(?<![\\p{L}\\p{N}-])${esc(w)}(?![\\p{L}\\p{N}-])`, flags);
/** Matching keeps the first letter's case: "Colour" for "Color". */
const keepCase = (found, want) => (found[0] === found[0].toUpperCase() && found[0] !== found[0].toLowerCase() ? want[0].toUpperCase() + want.slice(1) : want);

/**
 * texts: [{ elId, text }] in book order.
 * @returns [{ id, kind, title, detail, preferred, variants: [string], hits: [{ elId, index, match }], fix: { from: regexSource, to } | null }]
 */
export function consistencyFindings(texts, sheet = STYLE_SHEET_DEFAULTS, { names = [] } = {}) {
  sheet = normalizeStyleSheet(sheet);
  const out = [];
  const hitsOf = (re) => {
    const hits = [];
    for (const t of texts) for (const m of t.text.matchAll(re)) hits.push({ elId: t.elId, index: m.index, match: m[0] });
    return hits;
  };
  const listWords = new Map(sheet.words.map((w) => [String(w.word).toLowerCase(), w.word]));
  const preferredFromList = (forms) => forms.map((f) => listWords.get(f.toLowerCase())).find(Boolean);

  // 1. spelling variety (US/UK) and variants used side by side
  const uk = sheet.variety !== 'us';
  for (const [us, gb] of SPELLING_PAIRS) {
    const want = preferredFromList([us, gb]) || (uk ? gb : us);
    const other = want.toLowerCase() === us ? gb : us;
    const bad = hitsOf(wordRe(other, 'giu'));
    if (!bad.length) continue;
    const good = hitsOf(wordRe(want, 'giu')).length;
    out.push({ id: `sp:${other}`, kind: 'spelling', title: `“${other}” → “${want}”`, detail: `${bad.length} × “${other}”${good ? `, ${good} × “${want}”` : ''} — ${listWords.has(want.toLowerCase()) ? 'your word list says' : `${uk ? (sheet.variety === 'in' ? 'Indian' : 'UK') : 'US'} spelling is`} “${want}”.`, preferred: want, variants: [other], hits: bad, fix: { from: wordRe(other, 'giu').source, flags: 'giu', to: want } });
  }

  // 2. hyphenation / spacing / capitalisation forms: the word list wins, otherwise the first form used
  const formGroups = [...FORM_VARIANTS.map((g) => g), ...sheet.words.map((w) => [w.word])];
  const seen = new Set();
  for (const group of formGroups) {
    const key = group[0].toLowerCase().replace(/[\s-]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    // all spellings of the same letters with or without hyphen/space, any case
    const letters = [...key].map((c) => esc(c)).join('[\\s-]?');
    const re = new RegExp(`(?<![\\p{L}\\p{N}-])${letters}(?![\\p{L}\\p{N}-])`, 'giu');
    const hits = hitsOf(re).filter((h) => !/\s/.test(h.match) || /\s/.test(group.join(' ')) || group.some((g) => /\s/.test(g)));
    const forms = [...new Set(hits.map((h) => h.match))];
    if (forms.length < 2 && !(forms.length === 1 && listWords.has(key) === false && group.length > 1 && !group.includes(forms[0]))) {
      // one form only: flag it only when the word list asks for a different one
      const want = listWords.get(forms[0]?.toLowerCase().replace(/[\s-]/g, '')) || preferredFromList(group);
      if (!(forms.length === 1 && want && want !== forms[0] && forms[0].toLowerCase().replace(/[\s-]/g, '') === want.toLowerCase().replace(/[\s-]/g, ''))) continue;
    }
    const want = preferredFromList([...group, ...forms]) || hits[0]?.match;
    if (!want) continue;
    // sentence-initial capitals are not a different form
    const differs = (h) => h.match !== want && !(h.match.toLowerCase() === want.toLowerCase() && atSentenceStart(texts, h));
    const bad = hits.filter(differs);
    if (!bad.length) continue;
    out.push({ id: `form:${key}`, kind: 'form', title: `${[...new Set(bad.map((b) => `“${b.match}”`))].join(', ')} → “${want}”`, detail: `${bad.length} place${bad.length === 1 ? '' : 's'} differ from ${listWords.has(want.toLowerCase().replace(/[\s-]/g, '')) || listWords.has(want.toLowerCase()) ? 'your word list' : 'the first use'} (“${want}”).`, preferred: want, variants: [...new Set(bad.map((b) => b.match))], hits: bad, fix: null });
  }

  // 3. character names: near-misses of story-bible names (Meenakshi / Meenatchi)
  const nameSet = new Set(names.map((n) => n.toLowerCase()));
  const tokens = new Map();
  for (const t of texts) for (const m of t.text.matchAll(/\p{Lu}[\p{L}\p{M}]+|[\p{L}\p{M}]{4,}/gu)) {
    if (!tokens.has(m[0])) tokens.set(m[0], []);
    tokens.get(m[0]).push({ elId: t.elId, index: m.index, match: m[0] });
  }
  for (const name of names) {
    if ([...name].length < 4) continue;
    const near = [];
    for (const [tok, hits] of tokens) {
      if (tok === name || nameSet.has(tok.toLowerCase()) || tok.toLowerCase() === name.toLowerCase()) continue;
      const d = editDistance(tok.toLowerCase(), name.toLowerCase());
      const len = [...name].length;
      const limit = len >= 7 ? 2 : 1;
      const sameStart = [...tok][0]?.toLowerCase() === [...name][0]?.toLowerCase();
      if (d > 0 && d <= limit && sameStart && Math.abs([...tok].length - len) <= limit) near.push(...hits);
    }
    if (near.length) out.push({ id: `name:${name}`, kind: 'name', title: `${[...new Set(near.map((h) => `“${h.match}”`))].join(', ')} → “${name}”?`, detail: `Looks like a misspelling of the story-bible name “${name}”.`, preferred: name, variants: [...new Set(near.map((h) => h.match))], hits: near, fix: null });
  }

  // 4. numbers
  if (sheet.numbers !== 'numerals') {
    const max = sheet.numbers === 'words-10' ? 10 : 100;
    const bad = hitsOf(/(?<![\p{L}\p{N}.,:/$£€₹#-])(\d{1,3})(?![\p{N}.,:/%-]|\s?(?:%|percent|per cent|am|pm|a\.m\.|p\.m\.|kg|km|cm|mm|m|g|ml|l|lb|mph|kph|°))/gu).filter((h) => +h.match <= max && !/^0\d/.test(h.match));
    if (bad.length) out.push({ id: 'numbers', kind: 'numbers', title: `Numbers up to ${max} written as figures`, detail: `${bad.length} place${bad.length === 1 ? '' : 's'} — the style sheet spells out numbers up to ${max} (“${numberToWords(+bad[0].match)}”).`, preferred: '', variants: [...new Set(bad.map((b) => b.match))].slice(0, 6), hits: bad, fix: { numbers: true } });
  }
  // percentages
  const pctForms = { percent: /\b(per cent|%)(?!\w)/gu, 'per-cent': /\b(percent)\b|(?<=\d)\s?%/gu, symbol: /\b(per ?cent)\b/gu };
  const pctBad = hitsOf(pctForms[sheet.percent] || pctForms.percent);
  if (pctBad.length) out.push({ id: 'percent', kind: 'percent', title: `Percentages: use “${{ percent: 'percent', 'per-cent': 'per cent', symbol: '%' }[sheet.percent]}”`, detail: `${pctBad.length} place${pctBad.length === 1 ? '' : 's'} use another form.`, preferred: { percent: ' percent', 'per-cent': ' per cent', symbol: '%' }[sheet.percent], variants: [...new Set(pctBad.map((b) => b.match))], hits: pctBad, fix: null });

  // 5. dashes
  const dashBad = sheet.dash === 'en-spaced' ? hitsOf(/\s?—\s?/gu) : hitsOf(/(?<=\p{L})\s[–-]\s(?=\p{L})|\s—\s/gu);
  if (dashBad.length) out.push({ id: 'dash', kind: 'dash', title: sheet.dash === 'en-spaced' ? 'Em dashes → spaced en dashes ( – )' : 'Spaced dashes → closed em dashes (—)', detail: `${dashBad.length} place${dashBad.length === 1 ? '' : 's'}.`, preferred: sheet.dash === 'en-spaced' ? ' – ' : '—', variants: [...new Set(dashBad.map((b) => b.match))], hits: dashBad, fix: { from: dashBad === null ? '' : (sheet.dash === 'en-spaced' ? /\s?—\s?/.source : /(?<=\p{L})\s[–-]\s(?=\p{L})|\s—\s/.source), flags: 'gu', to: sheet.dash === 'en-spaced' ? ' – ' : '—' } });

  // 6. quotes: straight quotes, and the outer style
  const straight = hitsOf(/["]|(?<![\p{L}\p{N}])'|'(?![\p{L}\p{N}])/gu);
  if (straight.length) out.push({ id: 'straight-quotes', kind: 'quotes', title: 'Straight quotes', detail: `${straight.length} straight quote mark${straight.length === 1 ? '' : 's'} — use Typography clean-up to make them curly.`, preferred: '', variants: ['"', "'"], hits: straight, fix: null });
  const wrongOuter = sheet.quotes === 'double' ? hitsOf(/(?<=^|[\s(\[—])‘(?=[^’]{2,}?[.,!?]’)/gmu) : hitsOf(/(?<=^|[\s(\[—])“/gmu);
  if (wrongOuter.length) out.push({ id: 'quote-style', kind: 'quotes', title: sheet.quotes === 'double' ? 'Single quotes used for dialogue' : 'Double quotes used for dialogue', detail: `The style sheet uses ${sheet.quotes === 'double' ? 'double quotes (single inside)' : 'single quotes (double inside)'}; ${wrongOuter.length} quotation${wrongOuter.length === 1 ? '' : 's'} differ.`, preferred: '', variants: [], hits: wrongOuter, fix: null });

  // 7. ellipses
  const ellRe = { char: /\.\s?\.\s?\./gu, dots: /…|\. \. \./gu, spaced: /…|(?<!\. )\.\.\.(?! \.)/gu }[sheet.ellipsis];
  const ell = hitsOf(ellRe);
  if (ell.length) out.push({ id: 'ellipsis', kind: 'ellipsis', title: `Ellipses → “${{ char: '…', dots: '...', spaced: '. . .' }[sheet.ellipsis]}”`, detail: `${ell.length} place${ell.length === 1 ? '' : 's'}.`, preferred: { char: '…', dots: '...', spaced: '. . .' }[sheet.ellipsis], variants: [...new Set(ell.map((e) => e.match))], hits: ell, fix: { from: ellRe.source, flags: 'gu', to: { char: '…', dots: '...', spaced: '. . .' }[sheet.ellipsis] } });

  // 8. serial comma (lists of three single words)
  const serialRe = sheet.serialComma ? /\b(\p{L}+), (\p{L}+) (and|or) (\p{L}+)\b/gu : /\b(\p{L}+), (\p{L}+), (and|or) (\p{L}+)\b/gu;
  const serial = hitsOf(serialRe).filter((h) => !/^(and|or|but|so|yes|no|well|oh)\b/i.test(h.match));
  if (serial.length) out.push({ id: 'serial', kind: 'serial', title: sheet.serialComma ? 'Missing serial (Oxford) comma' : 'Serial comma used', detail: `${serial.length} list${serial.length === 1 ? '' : 's'} like “${serial[0].match}”.`, preferred: '', variants: [], hits: serial, fix: { from: serialRe.source, flags: 'gu', to: sheet.serialComma ? '$1, $2, $3 $4' : '$1, $2 $3 $4' } });

  return out;
}

function atSentenceStart(texts, h) {
  const t = texts.find((x) => x.elId === h.elId)?.text || '';
  const before = t.slice(Math.max(0, h.index - 4), h.index);
  return h.index === 0 || /(^|[.!?…:]["”’)]?\s+|\n\s*)$/.test(before) || /["“‘(]$/.test(before);
}

/** Apply a finding's fix to a plain-text string (used on text nodes). */
export function applyFix(text, fix) {
  if (!fix) return text;
  if (fix.numbers) return text.replace(/(?<![\p{L}\p{N}.,:/$£€₹#-])(\d{1,3})(?![\p{N}.,:/%-]|\s?(?:%|percent|per cent|am|pm|a\.m\.|p\.m\.|kg|km|cm|mm|m|g|ml|l|lb|mph|kph|°))/gu, (m, d) => (+d <= 100 && !/^0\d/.test(d) ? numberToWords(+d) : m));
  return text.replace(new RegExp(fix.from, fix.flags), (m, ...g) => {
    if (!/\$\d/.test(fix.to)) return keepCase(m, fix.to.trim() ? fix.to : fix.to);
    return fix.to.replace(/\$(\d)/g, (_, i) => g[+i - 1]);
  });
}

/** Replace inside the text of an HTML string only (never inside tags or attributes). */
export function replaceInHtmlText(html, fn) {
  return String(html).split(/(<[^>]+>)/).map((part) => (part.startsWith('<') ? part : fn(part))).join('');
}

/** A style sheet as a printable page for a human copyeditor. */
export function styleSheetHtml(book, sheet) {
  sheet = normalizeStyleSheet(sheet);
  const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = [
    ['Spelling', { us: 'US English', uk: 'UK English', in: 'Indian English (UK spelling)' }[sheet.variety]],
    ['Serial (Oxford) comma', sheet.serialComma ? 'Yes — red, white, and blue' : 'No — red, white and blue'],
    ['Dashes', sheet.dash === 'en-spaced' ? 'Spaced en dash – like this' : 'Closed em dash—like this'],
    ['Quotation marks', sheet.quotes === 'double' ? '“Double”, with ‘single’ inside' : '‘Single’, with “double” inside'],
    ['Ellipsis', { char: 'One character …', dots: 'Three full stops ...', spaced: 'Spaced . . .' }[sheet.ellipsis]],
    ['Numbers', { 'words-10': 'Spell out one to ten', 'words-100': 'Spell out one to one hundred', numerals: 'Use figures' }[sheet.numbers]],
    ['Percentages', { percent: '5 percent', 'per-cent': '5 per cent', symbol: '5%' }[sheet.percent]],
    ['Dates', sheet.dates === 'dmy' ? '13 October 2026' : 'October 13, 2026'],
  ];
  const words = [...sheet.words].sort((a, b) => String(a.word).localeCompare(String(b.word)));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Style sheet — ${e(book.meta.title || 'Untitled')}</title>
<style>body{font:11pt/1.5 Georgia,serif;max-width:46em;margin:2em auto;padding:0 1em;color:#111}h1{font-size:18pt;margin:0}p.sub{color:#555;margin:.2em 0 1.5em}table{border-collapse:collapse;width:100%;margin-bottom:1.5em}th,td{text-align:left;border-bottom:1px solid #ccc;padding:.35em .5em;vertical-align:top}th{width:30%}h2{font-size:13pt;margin-top:1.5em}.cols{columns:2;column-gap:2em}.w{break-inside:avoid;margin:0 0 .3em}.w small{color:#555}@media print{body{margin:0}}</style></head><body>
<h1>Style sheet</h1><p class="sub">${e(book.meta.title || 'Untitled')}${book.meta.author ? ` · ${e(book.meta.author)}` : ''} · ${new Date().toLocaleDateString()}</p>
<table>${rows.map(([k, v]) => `<tr><th>${e(k)}</th><td>${e(v)}</td></tr>`).join('')}</table>
<h2>Word list</h2>${words.length ? `<div class="cols">${words.map((w) => `<p class="w"><b>${e(w.word)}</b>${w.note ? ` <small>— ${e(w.note)}</small>` : ''}</p>`).join('')}</div>` : '<p>No entries yet.</p>'}
</body></html>`;
}
