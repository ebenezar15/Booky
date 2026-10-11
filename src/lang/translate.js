// Book translation: turn a project into a new project in another language.
// Providers: the browser's built-in on-device translator (Chrome / Edge), Claude (your Anthropic API key),
// Google Cloud Translation, a LibreTranslate server, or "manual" (original kept beside an empty copy for you to translate).
// The original text of every page is kept in `element.source` so you can compare, retranslate and correct.
import { langInfo } from '../core/languages.js';
import { uid } from '../core/model.js';

export const PROVIDERS = [
  { id: 'browser', label: 'Built-in browser translator', hint: 'Free and private. On-device translation in recent Chrome / Edge on desktop (downloads a language pack once). Keeps paragraphs, loses bold/italic inside paragraphs.' },
  { id: 'claude', label: 'Claude (Anthropic)', hint: 'Literary-quality translation that keeps formatting, tone and footnotes. Needs your Anthropic API key (billed to your account).' },
  { id: 'google', label: 'Google Cloud Translation', hint: 'Fast, keeps formatting. Needs a Google Cloud API key with the Translation API enabled.' },
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

async function browserTranslator(source, target, onStatus) {
  const T = globalThis.Translator;
  if (!T) throw new Error('This browser has no built-in translator. Use Chrome or Edge 138+ on a computer, or pick another provider.');
  const opts = { sourceLanguage: baseCode(source), targetLanguage: baseCode(target) };
  const a = await T.availability(opts);
  if (a === 'unavailable') throw new Error(`The built-in translator can’t translate ${langInfo(source).name} → ${langInfo(target).name}. Pick another provider.`);
  return T.create({
    ...opts,
    monitor(m) { m.addEventListener('downloadprogress', (e) => onStatus?.(`Downloading language pack… ${Math.round(e.loaded * 100)}%`)); },
  });
}

let browserCache = null;
async function translateBrowser(blocks, ctx) {
  const key = `${ctx.source}>${ctx.target}`;
  if (browserCache?.key !== key) browserCache = { key, t: await browserTranslator(ctx.source, ctx.target, ctx.onStatus) };
  const t = browserCache.t;
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

function claudeSystem(ctx) {
  const S = langInfo(ctx.source), T = langInfo(ctx.target);
  return [
    `You are an experienced literary translator preparing a published book in ${T.name} (${T.native}) from the ${S.name} original.`,
    'Translate faithfully and naturally, the way a skilled human translator would for print: keep the author’s voice, tone, register, imagery and paragraphing; make dialogue sound natural in the target language; use the target language’s own punctuation and quotation conventions.',
    'You receive a JSON list of HTML fragments. Return exactly one translated fragment per input fragment, in the same order.',
    'Keep every HTML tag and attribute exactly as given (classes, data-* attributes, styles, images). Translate only human-readable text, plus the text inside data-note attributes (footnotes) and alt attributes.',
    'Leave anything marked translate="no" unchanged, including {{placeholders}}. A fragment with nothing to translate is returned unchanged.',
    ctx.glossary ? `Translator’s notes and glossary from the author — follow them:\n${ctx.glossary}` : '',
  ].filter(Boolean).join('\n\n');
}

let claudeClient = null;
async function translateClaude(blocks, ctx) {
  if (!ctx.keys.claudeKey) throw new Error('Add your Anthropic API key in Settings → Translation.');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  if (claudeClient?.key !== ctx.keys.claudeKey) {
    claudeClient = { key: ctx.keys.claudeKey, c: new Anthropic({ apiKey: ctx.keys.claudeKey, dangerouslyAllowBrowser: true }) };
  }
  const run = async (list) => {
    const stream = claudeClient.c.beta.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      system: claudeSystem(ctx),
      output_config: {
        format: {
          type: 'json_schema',
          schema: { type: 'object', properties: { blocks: { type: 'array', items: { type: 'string' } } }, required: ['blocks'], additionalProperties: false },
        },
      },
      messages: [{ role: 'user', content: `Translate these ${list.length} fragment(s) into ${langInfo(ctx.target).name}:\n\n${JSON.stringify(list)}` }],
    }, { signal: ctx.signal });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') throw new Error('Claude declined to translate this passage. Try another provider for this page, or translate it by hand.');
    if (msg.stop_reason === 'max_tokens') return null; // too long: split and retry
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    let parsed;
    try { parsed = JSON.parse(text); } catch { return null; }
    return Array.isArray(parsed.blocks) && parsed.blocks.length === list.length ? parsed.blocks : null;
  };
  const go = async (list) => {
    const res = await run(list);
    if (res) return res;
    if (list.length === 1) throw new Error('Claude could not translate a very long paragraph. Split it and try again.');
    const mid = Math.ceil(list.length / 2);
    return [...await go(list.slice(0, mid)), ...await go(list.slice(mid))];
  };
  return go(blocks);
}

async function translateGoogle(blocks, ctx) {
  if (!ctx.keys.googleKey) throw new Error('Add your Google Cloud API key in Settings → Translation.');
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
  if (!url) throw new Error('Add a LibreTranslate server address in Settings → Translation.');
  const res = await fetch(`${url}/translate`, {
    method: 'POST', signal: ctx.signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: blocks, source: baseCode(ctx.source), target: baseCode(ctx.target), format: 'html', api_key: ctx.keys.libreKey || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`LibreTranslate: ${data.error || res.status}`);
  return Array.isArray(data.translatedText) ? data.translatedText : [data.translatedText];
}

const ENGINES = { browser: translateBrowser, claude: translateClaude, google: translateGoogle, libre: translateLibre, manual: async (b) => b };
const BATCH = { browser: 4000, claude: 6000, google: 8000, libre: 4000, manual: 1e9 };

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
  const content = el.type === 'toc' || el.type === 'blank' ? src.content : await translateHtml(src.content, ctx);
  Object.assign(el, { title, subtitle, content, trStatus: 'machine' });
}

/** Translate everything still pending. Calls onProgress(done, total, el) and onSave() as pages finish. */
export async function runTranslation(book, { keys, signal, onProgress, onSave, onStatus, only } = {}) {
  const tr = book.translation;
  const ctx = { provider: tr.provider, source: tr.source, target: tr.target, glossary: tr.glossary, keys: keys || {}, signal, onStatus };
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

export function translationProgress(book) {
  const els = book.elements.filter((e) => e.source);
  const count = (s) => els.filter((e) => e.trStatus === s).length;
  return { total: els.length, pending: count('pending'), todo: count('todo'), machine: count('machine'), reviewed: count('reviewed') };
}
