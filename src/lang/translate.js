// Book translation: turn a project into a new project in another language.
// Providers: the browser's built-in on-device translator (Chrome / Edge), Claude (your Anthropic API key),
// Google Cloud Translation, a LibreTranslate server, or "manual" (original kept beside an empty copy for you to translate).
// The original text of every page is kept in `element.source` so you can compare, retranslate and correct.
import { langInfo } from '../core/languages.js';
import { uid } from '../core/model.js';

export const PROVIDERS = [
  { id: 'browser', label: 'Built-in browser translator (free)', hint: 'Free and private. On-device translation in recent Chrome / Edge on desktop (downloads a language pack once). Keeps paragraphs, loses bold/italic inside paragraphs.' },
  { id: 'mymemory', label: 'MyMemory (free, no key)', hint: 'Free online translation that works everywhere, including the desktop app. Free limit: about 50,000 characters a day (enough for a few chapters a day) — add your email in Settings → Voice & translation for the higher limit. Keeps paragraphs, loses bold/italic inside paragraphs.' },
  { id: 'claude', label: 'Claude (Anthropic) — paid, your API key', hint: 'Literary-quality translation that keeps formatting, tone and footnotes. Needs your Anthropic API key (billed to your account).' },
  { id: 'google', label: 'Google Cloud Translation — paid, your API key', hint: 'Fast, keeps formatting. Needs a Google Cloud API key with the Translation API enabled.' },
  { id: 'libre', label: 'LibreTranslate server', hint: 'Open-source; use a public or self-hosted server URL (and key if it needs one).' },
  { id: 'manual', label: 'Manual (translate it yourself)', hint: 'Creates the new project with the original beside every page, ready for you or a translator to write over.' },
];

export const CLAUDE_MODEL = 'claude-opus-5-5';

const baseCode = (code) => String(code || 'en').split('-')[0];

// ---------- HTML helpers (pure string functions, also used by tests) ----------

/** Protect {{placeholders}} so no translator touches them. */
export function protectPlaceholders(html) {
  return html.replace(/\{\{(\w+)\}\}/g, '<span translate="no" class="notranslate" data-ph="$1">{{$1}}</span>');
}
export function restorePlaceholders(html) {
  return html
    .replace(/<span[^>]*data-ph="(\w+)"[^>]*>[\s\S]*?<\/span>/g, '{{$1}}')
    .replace(/\{\{\s*(\w+)\s*\}\}/g, '{{$1}}');
}

/** Group blocks into batches no larger than `max` characters. */
export function batchBlocks(blocks, max = 6000) {
  const out = [];
  let cur = [], size = 0;
  blocks.forEach((b, i) => {
    if (cur.length && size + b.length > max) { out.push(cur); cur = []; size = 0; }
    cur.push(i);
    size += b.length;
  });
  if (cur.length) out.push(cur);
  return out;
}

/** True when a block has words worth translating. */
export const hasText = (html) => /[\p{L}\p{N}]/u.test(html.replace(/<[^>]+>/g, '').replace(/\{\{\w+\}\}/g, ''));

// Split page HTML into its top-level blocks (browser only).
function splitBlocks(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return [...doc.body.childNodes].map((n) => (n.nodeType === 1 ? n.outerHTML : n.textContent)).filter((s) => s.trim());
}

// ---------- providers ----------

const withTimeout = (promise, ms, what) => Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} did not respond`)), ms))]);

async function browserTranslator(source, target, onStatus) {
  const T = globalThis.Translator;
  if (!T) throw new Error('This browser has no built-in translator.');
  const opts = { sourceLanguage: baseCode(source), targetLanguage: baseCode(target) };
  const a = await withTimeout(T.availability(opts), 8000, 'The built-in translator');
  if (a === 'unavailable') throw new Error(`The built-in translator can’t translate ${langInfo(source).name} → ${langInfo(target).name}.`);
  // A language pack may need downloading first (shown as progress); give it a few minutes.
  return withTimeout(T.create({
    ...opts,
    monitor(m) { m.addEventListener('downloadprogress', (e) => onStatus?.(`Downloading language pack… ${Math.round(e.loaded * 100)}%`)); },
  }), a === 'available' ? 20000 : 300000, 'The built-in translator');
}

let browserCache = null;
async function translateBrowser(blocks, ctx) {
  const key = `${ctx.source}>${ctx.target}`;
  if (browserCache?.key !== key) {
    try {
      browserCache = { key, t: await browserTranslator(ctx.source, ctx.target, ctx.onStatus) };
    } catch (e) {
      // No usable on-device translator here (other browsers, the desktop app, unsupported language pair): use the free online one.
      browserCache = { key, t: null };
      ctx.onStatus?.('The built-in translator isn’t available here — using MyMemory (free) instead.');
    }
  }
  if (!browserCache.t) return translateMyMemory(blocks, ctx);
  return blockwise(blocks, async (text) => {
    if (browserCache.t) {
      try { return await browserCache.t.translate(text); } catch (e) {
        if (e?.name === 'AbortError') throw e;
        browserCache.t = null;
        ctx.onStatus?.('The built-in translator stopped — continuing with MyMemory (free).');
      }
    }
    return text.trim() ? myMemoryText(text, ctx) : text;
  }, ctx);
}

// Plain-text translators: translate each block's text, keeping the block, its style, footnotes and {{fields}}.
async function blockwise(blocks, translate, ctx) {
  const t = { translate };
  const out = [];
  for (const b of blocks) {
    ctx.signal?.throwIfAborted();
    // Plain text per block: keep the block element and its class, translate its text.
    if (!hasText(b)) { out.push(b); continue; }
    const plain = !/^\s*<[a-z]/i.test(b); // titles and other plain strings
    const doc = new DOMParser().parseFromString(`<body>${plain ? `<p>${b}</p>` : b}</body>`, 'text/html');
    const el = doc.body.firstElementChild;
    const notes = [...el.querySelectorAll('[data-type="footnote"]')];
    for (const n of notes) n.setAttribute('data-note', await t.translate(n.getAttribute('data-note') || ''));
    const phs = [];
    el.querySelectorAll('[data-ph]').forEach((p) => { phs.push(p.getAttribute('data-ph')); p.replaceWith(`⟦${phs.length - 1}⟧`); });
    notes.forEach((n, i) => n.replaceWith(`⟪${i}⟫`));
    const text = el.textContent;
    let tr = await t.translate(text);
    tr = tr.replace(/⟦\s*(\d+)\s*⟧/g, (_, i) => `{{${phs[+i]}}}`);
    el.textContent = '';
    tr.split(/(⟪\s*\d+\s*⟫)/).forEach((part) => {
      const m = part.match(/⟪\s*(\d+)\s*⟫/);
      el.append(m && notes[+m[1]] ? notes[+m[1]] : doc.createTextNode(part));
    });
    out.push(plain ? el.textContent : el.outerHTML);
  }
  return out;
}

// ---------- MyMemory (free, no key) ----------
// Splits text into pieces of at most ~450 characters at sentence boundaries (the free API's limit is 500 bytes).
export function splitForApi(text, max = 450) {
  const parts = [];
  let cur = '';
  for (const sentence of String(text).match(/[^.!?।॥。]+[.!?।॥。]*\s*/gu) || [text]) {
    if ((cur + sentence).length > max && cur) { parts.push(cur); cur = ''; }
    if (sentence.length > max) { for (let i = 0; i < sentence.length; i += max) parts.push(sentence.slice(i, i + max)); continue; }
    cur += sentence;
  }
  if (cur) parts.push(cur);
  return parts;
}

async function myMemoryRaw(q, ctx) {
  const pair = `${baseCode(ctx.source)}|${baseCode(ctx.target)}`;
  const de = ctx.keys?.myMemoryEmail ? `&de=${encodeURIComponent(ctx.keys.myMemoryEmail)}` : '';
  let res;
  try {
    res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(pair)}${de}`, { signal: ctx.signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new Error('MyMemory could not be reached — check your internet connection.');
  }
  const data = await res.json().catch(() => ({}));
  const msg = String(data.responseDetails || '');
  if (+data.responseStatus === 429 || /USED ALL AVAILABLE FREE TRANSLATIONS/i.test(msg) || /USED ALL AVAILABLE FREE TRANSLATIONS/i.test(data.responseData?.translatedText || '')) {
    throw new Error('Today’s free MyMemory limit is used up. Translation continues tomorrow (“Continue translation”), or add your email in Settings → Voice & translation for a higher free limit.');
  }
  if (+data.responseStatus !== 200) throw new Error(`MyMemory: ${msg || res.status}`);
  return data;
}

async function myMemoryText(text, ctx) {
  const leading = text.match(/^\s*/)[0], trailing = text.match(/\s*$/)[0];
  const out = [];
  for (const part of splitForApi(text.trim())) out.push((await myMemoryRaw(part, ctx)).responseData.translatedText);
  return leading + out.join(' ').replace(/\s+/g, ' ').trim() + trailing;
}

const translateMyMemory = (blocks, ctx) => blockwise(blocks, (text) => (text.trim() ? myMemoryText(text, ctx) : text), ctx);

/** Several free suggestions for a short phrase: MyMemory's best result plus distinct human translations from its memory. */
async function myMemorySuggestions(text, ctx) {
  const data = await myMemoryRaw(text.slice(0, 450), ctx);
  const seen = new Set();
  const out = [];
  const add = (t, note) => { const k = (t || '').trim(); if (k && !seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); out.push({ text: k, note }); } };
  add(data.responseData?.translatedText, 'Best match (MyMemory)');
  for (const m of (data.matches || []).filter((x) => +x.quality >= 50 || +x.match >= 0.5).slice(0, 8)) add(m.translation, m['created-by'] && !/MT!/i.test(m['created-by']) ? 'From human translations' : 'Alternative');
  return out.slice(0, 5);
}

function claudeSystem(ctx) {
  const S = langInfo(ctx.source), T = langInfo(ctx.target);
  const b = ctx.book || {};
  return [
    `You are an experienced literary translator preparing a published book in ${T.name} (${T.native}) from the ${S.name} original.`,
    'Translate for meaning in context, never word by word: read the whole passage first, then render each sentence the way a skilled native writer of the target language would put it in print. Resolve idioms, metaphors, humour and cultural references to natural equivalents; keep the author’s voice, tone, register and paragraphing; keep names and terms consistent; make dialogue sound natural; use the target language’s own punctuation and quotation conventions.',
    b.title ? `About the book — title: “${b.title}”${b.genre ? `; genre: ${b.genre}` : ''}${b.description ? `; summary: ${b.description.slice(0, 600)}` : ''}.` : '',
    'You receive a JSON list of HTML fragments. Return exactly one translated fragment per input fragment, in the same order.',
    'Keep every HTML tag and attribute exactly as given (classes, data-* attributes, styles, images). Translate only human-readable text, plus the text inside data-note attributes (footnotes) and alt attributes.',
    'Leave anything marked translate="no" unchanged, including {{placeholders}}. A fragment with nothing to translate is returned unchanged.',
    ctx.glossary ? `Translator’s notes and glossary from the author — follow them:\n${ctx.glossary}` : '',
  ].filter(Boolean).join('\n\n');
}

let claudeClient = null;
async function claude(ctx) {
  if (!ctx.keys?.claudeKey) throw new Error('Add your Anthropic API key in Settings → Voice & translation.');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  if (claudeClient?.key !== ctx.keys.claudeKey) {
    claudeClient = { key: ctx.keys.claudeKey, c: new Anthropic({ apiKey: ctx.keys.claudeKey, dangerouslyAllowBrowser: true }) };
  }
  return claudeClient.c;
}

/** One structured-output request to Claude. Returns the parsed JSON, or null if the answer was cut off or malformed. */
export async function claudeJson({ system, user, schema, maxTokens = 32000 }, ctx) {
  const client = await claude(ctx);
  const stream = client.beta.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    system,
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: user }],
  }, { signal: ctx.signal });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('Claude declined to translate this passage. Try another provider for it, or translate it by hand.');
  if (msg.stop_reason === 'max_tokens') return null;
  try { return JSON.parse(msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')); } catch { return null; }
}

async function translateClaude(blocks, ctx) {
  const schema = { type: 'object', properties: { blocks: { type: 'array', items: { type: 'string' } } }, required: ['blocks'], additionalProperties: false };
  const run = async (list) => {
    const where = ctx.chapter ? `These fragments come from “${ctx.chapter}”. ` : '';
    const before = ctx.prev ? `For continuity, the passage just before this one was:\n${ctx.prev.src}\n…which you translated as:\n${ctx.prev.out}\n\n` : '';
    const parsed = await claudeJson({ system: claudeSystem(ctx), schema, user: `${before}${where}Translate these ${list.length} fragment(s) into ${langInfo(ctx.target).name}:\n\n${JSON.stringify(list)}` }, ctx);
    return Array.isArray(parsed?.blocks) && parsed.blocks.length === list.length ? parsed.blocks : null;
  };
  const go = async (list) => {
    const res = await run(list);
    if (res) return res;
    if (list.length === 1) throw new Error('Claude could not translate a very long paragraph. Split it and try again.');
    const mid = Math.ceil(list.length / 2);
    return [...await go(list.slice(0, mid)), ...await go(list.slice(mid))];
  };
  const out = await go(blocks);
  const last = blocks.length - 1;
  if (last >= 0) ctx.prev = { src: blocks[last].replace(/<[^>]+>/g, '').slice(-700), out: out[last].replace(/<[^>]+>/g, '').slice(-700) };
  return out;
}

async function translateGoogle(blocks, ctx) {
  if (!ctx.keys.googleKey) throw new Error('Add your Google Cloud API key in Settings → Voice & translation.');
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(ctx.keys.googleKey)}`, {
    method: 'POST', signal: ctx.signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: blocks, source: baseCode(ctx.source), target: baseCode(ctx.target), format: 'html' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Translate: ${data.error?.message || res.status}`);
  return data.data.translations.map((t) => t.translatedText);
}

async function translateLibre(blocks, ctx) {
  const url = (ctx.keys.libreUrl || '').replace(/\/+$/, '');
  if (!url) throw new Error('Add a LibreTranslate server address in Settings → Voice & translation.');
  const res = await fetch(`${url}/translate`, {
    method: 'POST', signal: ctx.signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: blocks, source: baseCode(ctx.source), target: baseCode(ctx.target), format: 'html', api_key: ctx.keys.libreKey || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`LibreTranslate: ${data.error || res.status}`);
  return Array.isArray(data.translatedText) ? data.translatedText : [data.translatedText];
}

const ENGINES = { browser: translateBrowser, mymemory: translateMyMemory, claude: translateClaude, google: translateGoogle, libre: translateLibre, manual: async (b) => b };
const BATCH = { browser: 4000, mymemory: 4000, claude: 6000, google: 8000, libre: 4000, manual: 1e9 };

/** Translate a list of HTML fragments, keeping empty/non-text fragments as they are. */
export async function translateFragments(fragments, ctx) {
  const engine = ENGINES[ctx.provider];
  if (!engine) throw new Error('Unknown translation provider');
  const out = fragments.slice();
  const todo = fragments.map((f, i) => [protectPlaceholders(f), i]).filter(([f]) => hasText(f));
  for (const group of batchBlocks(todo.map(([f]) => f), BATCH[ctx.provider])) {
    ctx.signal?.throwIfAborted();
    const res = await engine(group.map((g) => todo[g][0]), ctx);
    group.forEach((g, k) => { out[todo[g][1]] = restorePlaceholders(res[k] ?? todo[g][0]); });
  }
  return out;
}

// HTML-mode services return titles with entities (&amp; &#39;); titles are stored as plain text.
const plainText = (s) => (s && /[<&]/.test(s) && typeof DOMParser !== 'undefined' ? new DOMParser().parseFromString(`<body>${s}</body>`, 'text/html').body.textContent : s);
const translateTitles = async (list, ctx) => (await translateFragments(list.map((t) => t || ''), ctx)).map(plainText);

export const translateText = async (text, ctx) => (text && hasText(text) ? plainText((await translateFragments([text], ctx))[0]) : text);
export const translateHtml = async (html, ctx) => (await translateFragments(splitBlocks(html || ''), ctx)).join('');

// ---------- whole books ----------

/** A new project ready to be translated: same design, new language, original text kept on every page. */
export function prepareTranslation(book, target, provider) {
  const copy = JSON.parse(JSON.stringify(book));
  copy.id = uid('bk_');
  copy.createdAt = copy.updatedAt = Date.now();
  copy.reviews = { reviewers: [], comments: [], overall: [], rounds: [] };
  copy.translation = {
    fromId: book.id, fromTitle: book.meta.title, source: book.meta.language || 'en', target, provider,
    createdAt: Date.now(), glossary: book.translation?.glossary || '',
    meta: { title: book.meta.title, subtitle: book.meta.subtitle, description: book.meta.description, series: book.meta.series },
  };
  for (const el of copy.elements) {
    el.source = { title: el.title, subtitle: el.subtitle, content: el.content };
    el.trStatus = provider === 'manual' ? 'todo' : 'pending'; // pending → machine → reviewed (todo = translate by hand)
    el.snapshots = [];
  }
  return copy;
}

/** Translate one page of a translation project from its stored original. */
export async function translateElement(book, el, ctx) {
  const src = el.source || { title: el.title, subtitle: el.subtitle, content: el.content };
  const [title, subtitle] = await translateTitles([src.title, src.subtitle], ctx);
  ctx.chapter = src.title || '';
  const content = el.type === 'toc' || el.type === 'blank' ? src.content : await translateHtml(src.content, ctx);
  Object.assign(el, { title, subtitle, content, trStatus: 'machine' });
}

/** Translate everything still pending. Calls onProgress(done, total, el) and onSave() as pages finish. */
export async function runTranslation(book, { keys, signal, onProgress, onSave, onStatus, only } = {}) {
  const tr = book.translation;
  const ctx = { provider: tr.provider, source: tr.source, target: tr.target, glossary: tr.glossary, keys: keys || {}, signal, onStatus, book: bookContext(book) };
  if (tr.provider === 'manual') return;
  if (!tr.metaDone) {
    onStatus?.('Translating the title and description…');
    const m = tr.meta || {};
    const [title, subtitle, series] = await translateTitles([m.title, m.subtitle, m.series], ctx);
    Object.assign(book.meta, { title: title || book.meta.title, subtitle, series });
    if (m.description) book.meta.description = (await translateText(m.description, ctx)) || book.meta.description;
    tr.metaDone = true;
    await onSave?.();
  }
  const list = book.elements.filter((e) => (only ? only.includes(e.id) : e.trStatus === 'pending'));
  let done = 0;
  for (const el of list) {
    signal?.throwIfAborted();
    onProgress?.(done, list.length, el);
    await translateElement(book, el, ctx);
    done++;
    onProgress?.(done, list.length, el);
    await onSave?.();
  }
}

/** What a translator should know about the book (used by Claude for context). */
export function bookContext(book) {
  const m = book.translation?.meta || book.meta || {};
  return { title: m.title || book.meta?.title || '', genre: book.meta?.genre || '', description: m.description || book.meta?.description || '' };
}

/**
 * Several context-aware translations for a word or sentence, each with a note on when to use it.
 * mode 'translate': `text` is in `source`, find the best ways to say it in `target`.
 * mode 'improve': `text` is already in `target` (part of a translation of `original`); suggest better wordings.
 * Returns [{ text, note }]. Claude gives 3–5 options; other providers give one.
 */
export async function suggestTranslations({ text, context = '', original = '', mode = 'translate' }, ctx) {
  const S = langInfo(ctx.source), T = langInfo(ctx.target);
  if (ctx.provider !== 'claude') {
    const label = PROVIDERS.find((p) => p.id === ctx.provider)?.label || ctx.provider;
    if (mode === 'improve') {
      if (!original) return [];
      return [{ text: plainText((await translateFragments([original], ctx))[0]), note: `Fresh translation of the whole original paragraph (${label}) — compare and copy the part you need.` }];
    }
    const list = ctx.provider === 'mymemory' ? await myMemorySuggestions(text, ctx) : [{ text: plainText((await translateFragments([text], ctx))[0]), note: label }];
    // Context: also translate the whole sentence the selection sits in, so the writer sees how it reads in place.
    const sentence = sentenceAround(context, text);
    if (sentence && sentence.length > text.length + 3) {
      const whole = plainText((await translateFragments([sentence], ctx))[0]);
      if (whole) list.push({ text: whole, note: 'The whole sentence, translated together — shows the meaning in context', context: true });
    }
    return list;
  }
  const schema = {
    type: 'object', additionalProperties: false, required: ['suggestions'],
    properties: { suggestions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'note'], properties: { text: { type: 'string' }, note: { type: 'string' } } } } },
  };
  const system = [
    `You are a literary translator and editor working between ${S.name} and ${T.name} (${T.native}).`,
    'Give 3 to 5 genuinely different options, best first. Each must fit the surrounding sentence grammatically and match its tone and register. Prefer what a native writer would naturally say over literal equivalents.',
    `Write each note in ${S.code.startsWith('en') ? 'English' : 'English, briefly'}: one short line on the nuance (literal / idiomatic / formal / colloquial / poetic, regional usage, connotations) and when to choose it.`,
    ctx.glossary ? `Author’s glossary and notes — follow them:\n${ctx.glossary}` : '',
  ].filter(Boolean).join('\n\n');
  const book = ctx.book?.title ? `Book: “${ctx.book.title}”${ctx.book.genre ? ` (${ctx.book.genre})` : ''}.\n` : '';
  const user = mode === 'improve'
    ? `${book}Original ${S.name} passage:\n${original}\n\nCurrent ${T.name} translation of that passage:\n${context}\n\nSuggest better ${T.name} wordings for this part of the translation: «${text}». Each option replaces exactly that part, so it must read correctly in the sentence.`
    : `${book}Surrounding text (${S.name}):\n${context || text}\n\nTranslate «${text}» into ${T.name}, as it is meant in this context.`;
  const parsed = await claudeJson({ system, user, schema, maxTokens: 16000 }, ctx);
  return (parsed?.suggestions || []).filter((x) => x.text).slice(0, 5);
}

/** The sentence of `paragraph` that contains `text` (or the paragraph if not found). */
export function sentenceAround(paragraph, text) {
  const p = String(paragraph || '');
  const i = p.indexOf(text);
  if (i < 0) return '';
  const start = Math.max(p.lastIndexOf('. ', i), p.lastIndexOf('! ', i), p.lastIndexOf('? ', i), p.lastIndexOf('। ', i));
  const endMatch = p.slice(i + text.length).search(/[.!?।](\s|$)/);
  const end = endMatch < 0 ? p.length : i + text.length + endMatch + 1;
  return p.slice(start < 0 ? 0 : start + 2, end).trim();
}

export function translationProgress(book) {
  const els = book.elements.filter((e) => e.source);
  const count = (s) => els.filter((e) => e.trStatus === s).length;
  return { total: els.length, pending: count('pending'), todo: count('todo'), machine: count('machine'), reviewed: count('reviewed') };
}

/**
 * Writing assistant, optional: Claude rewrites a passage in any language. Uses the Anthropic key from Settings.
 * @returns [{ label, text }] — three versions, or [] when Claude couldn't answer.
 */
export async function claudeRewrite(text, { mode = 'standard', instruction = '', language = 'en', bookTitle = '', signal } = {}, keys) {
  const MODES = {
    standard: 'Reword it naturally with fresh vocabulary and sentence shapes, keeping the meaning, tone and length.',
    fluency: 'Fix every grammar, spelling and punctuation error and smooth awkward phrasing, changing as little as possible.',
    formal: 'Make it formal and polished, suitable for professional or academic publishing.',
    casual: 'Make it relaxed and conversational.',
    simple: 'Make it plain and easy to read: everyday words, shorter sentences.',
    creative: 'Rewrite it with vivid, inventive language and varied rhythm, as a skilled novelist would.',
    shorten: 'Make it noticeably shorter and tighter without losing meaning.',
    expand: 'Expand it with relevant detail and smoother transitions, roughly half again as long.',
  };
  const schema = { type: 'object', properties: { versions: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, text: { type: 'string' } }, required: ['label', 'text'], additionalProperties: false } } }, required: ['versions'], additionalProperties: false };
  const system = [
    'You are an expert book editor helping an author revise their manuscript.',
    'Rewrite the passage you are given. Write in the same language as the passage, keep paragraph breaks as blank lines, keep names, facts and point of view, and never add commentary.',
    'Return three distinct versions, each with a two-to-four-word label describing how it differs.',
    bookTitle ? `The book is “${bookTitle}”.` : '',
  ].filter(Boolean).join('\n');
  const user = `${MODES[mode] || MODES.standard}${instruction ? `\nAlso: ${instruction}` : ''}\nThe passage is in the language with code “${language}”.\n\nPassage:\n${text}`;
  const out = await claudeJson({ system, user, schema, maxTokens: 16000 }, { keys, signal });
  return Array.isArray(out?.versions) ? out.versions.filter((v) => v.text?.trim()) : [];
}
