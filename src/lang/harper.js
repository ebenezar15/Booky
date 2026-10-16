// Harper (Automattic, Apache-2.0): an offline English grammar engine compiled to WebAssembly.
// Booky uses it alongside its own rules for agreement, word choice (could of, their/there, its/it's, to/too…),
// articles, repeated words and more. The engine is a separate 16 MB file, harper.wasm:
//   desktop app — shipped inside the app;  website — next to the page;  single-file Booky.html — downloaded once
//   from the Booky website when online and kept, so it then works offline too.
// When it isn't available, Booky's own rules still check grammar.
import { db } from '../core/db.js';

const ONLINE = [
  'https://ebenezar15.github.io/Booky/release/harper.wasm',
  'https://raw.githubusercontent.com/ebenezar15/Booky/main/release/harper.wasm',
  'https://raw.githubusercontent.com/ebenezar15/Booky/claude/sleepy-tesla-l6eefn/release/harper.wasm',
];
const CACHE_KEY = 'harper-wasm-2.10.0';

let linter = null, loading = null, status = 'idle', dialectNow = null;
const waiters = new Set();
/** For tests: use a linter made elsewhere. */
export const useLinter = (l) => { linter = l; status = l ? 'ready' : 'idle'; cache.clear(); };
export const harperStatus = () => status; // idle | loading | ready | unavailable | off
export const onHarperReady = (cb) => { if (linter) cb(); else waiters.add(cb); return () => waiters.delete(cb); };

const blobUrl = (bytes) => URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' }));

async function wasmUrl() {
  const desk = globalThis.bookyDesktop;
  if (desk?.readAsset) {
    try { const bytes = await desk.readAsset('harper.wasm'); if (bytes?.byteLength) return blobUrl(bytes); } catch { /* not packaged */ }
  }
  if (/^https?:/.test(location.protocol)) {
    try { const r = await fetch(new URL('harper.wasm', location.href), { method: 'HEAD' }); if (r.ok) return new URL('harper.wasm', location.href).href; } catch { /* not here */ }
  }
  try { const cached = await db.get(CACHE_KEY); if (cached?.byteLength) return blobUrl(cached); } catch { /* no storage */ }
  if (navigator.onLine === false) return null;
  for (const url of ONLINE) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.length < 1e6 || bytes[0] !== 0 || bytes[1] !== 0x61) continue; // "\0asm"
      db.set(CACHE_KEY, bytes).catch(() => {});
      return blobUrl(bytes);
    } catch { /* try the next */ }
  }
  return null;
}

const DIALECTS = { us: 'American', uk: 'British', in: 'Indian', au: 'Australian', ca: 'Canadian' };

/** Start loading the engine (once). Resolves to true when ready. */
let lastFail = 0;
export function loadHarper(variety = 'us') {
  if (linter) return Promise.resolve(true);
  if (loading) return loading;
  // not available (offline, single-file copy): don't keep trying on every chapter — again in 10 minutes
  if (status === 'unavailable' && Date.now() - lastFail < 600000) return Promise.resolve(false);
  status = 'loading';
  loading = (async () => {
    try {
      const url = await wasmUrl();
      if (!url) { status = 'unavailable'; lastFail = Date.now(); return false; }
      const H = await import('harper.js');
      const binary = H.createBinaryModuleFromUrl(url, 'full');
      const l = new H.LocalLinter({ binary, dialect: H.Dialect[DIALECTS[variety] || 'American'] });
      await l.setup();
      linter = l; dialectNow = variety; status = 'ready';
      waiters.forEach((cb) => { try { cb(); } catch { /* ignore */ } });
      waiters.clear();
      return true;
    } catch (e) {
      console.warn('Harper unavailable', e);
      status = 'unavailable'; lastFail = Date.now();
      return false;
    } finally { loading = null; }
  })();
  return loading;
}

export async function setHarperDialect(variety) {
  if (!linter || variety === dialectNow) return;
  const H = await import('harper.js');
  try { await linter.setDialect?.(H.Dialect[DIALECTS[variety] || 'American']); dialectNow = variety; cache.clear(); } catch { /* older engine */ }
}

// ---------- lints → Booky issues ----------
const STYLE_KINDS = new Set(['Style', 'Enhancement', 'Readability', 'Usage']);
const SKIP_KINDS = new Set(['Spelling']); // Booky's own dictionary handles spelling
const cache = new Map();

const clean = (msg) => String(msg || '').replace(/`([^`]+)`/g, '“$1”').replace(/\*\*([^*]+)\*\*/g, '$1');

/** Convert one Harper lint. Exported for tests. */
export function toIssue(text, l, map) {
  const kind = l.kind;
  if (SKIP_KINDS.has(kind)) return null;
  const start = map ? map[l.start] : l.start, end = map ? map[l.end] : l.end;
  if (start == null || end == null || end <= start) return null;
  const orig = text.slice(start, end);
  const reps = l.suggestions.map((s) => (s.kind === 1 ? '' : s.kind === 2 ? orig + s.text : s.text)).filter((r) => r !== orig);
  // "Who's" at the start of a sentence is not a capitalisation error
  if (kind === 'Capitalization' && reps.every((r) => r.toLowerCase() === orig.toLowerCase()) && /(^|[.!?]["”’)]?\s+)$/.test(text.slice(0, start))) return null;
  return {
    start, end,
    kind: STYLE_KINDS.has(kind) ? 'style' : 'grammar',
    rule: `harper-${String(kind).toLowerCase()}`,
    title: l.title || kind,
    message: clean(l.message),
    replacements: [...new Set(reps)].slice(0, 4),
    source: 'harper',
  };
}

function plain(l) {
  const span = l.span();
  const out = {
    start: span.start, end: span.end, kind: l.lint_kind(), title: l.lint_kind_pretty?.() || l.lint_kind(), message: l.message(),
    suggestions: l.suggestions().map((s) => ({ kind: s.kind(), text: s.get_replacement_text() })),
  };
  return out;
}

/** Issues for a paragraph, or null when the engine isn't ready. */
export async function harperIssues(text) {
  if (!linter || !text.trim()) return linter ? [] : null;
  const hit = cache.get(text);
  if (hit) return hit;
  // Harper only understands straight apostrophes and quotes; curly ones are swapped one-for-one (same positions)
  const curly = /[‘’“”]/.test(text);
  const norm = curly ? text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"') : text;
  let lints = [];
  try { lints = (await linter.lint(norm, { language: 'plaintext' })).map(plain); } catch { return []; }
  if (curly) for (const l of lints) for (const sg of l.suggestions) sg.text = sg.text.replace(/'/g, '’');
  // Harper's spans are already in JavaScript (UTF-16) units — checked with emoji in the tests
  const out = lints.map((l) => toIssue(text, l, null)).filter(Boolean);
  cache.set(text, out);
  if (cache.size > 3000) cache.delete(cache.keys().next().value);
  return out;
}

/** Merge Harper's issues with Booky's own: where they cover the same words, Harper's grammar wins. */
export function mergeIssues(own, harper) {
  if (!harper?.length) return own;
  const overlaps = (a, b) => a.start < b.end && b.start < a.end;
  return [...own.filter((o) => o.kind !== 'grammar' || !harper.some((hh) => overlaps(o, hh))), ...harper].sort((a, b) => a.start - b.start);
}
