// Font registry: fonts bundled with the app (work offline) + fonts the user uploads.
import catalog from '../fonts/catalog.json';
import fontCss from '../fonts/fonts.css?inline';
import { state, setApp } from './store.js';
import { SCRIPT_LABELS, langInfo } from './languages.js';

export const FONT_CATALOG = catalog;
export const BUNDLED_FONTS = catalog.map((f) => f.name);
export const FONT_META = Object.fromEntries(catalog.map((f) => [f.name, f.category]));

// Bundled fonts whose figures switch to lining with font-variant-numeric (checked by rendering both).
// None of the bundled fonts include old-style figures (the 'onum' feature); fonts not listed have one style only.
const LINING_SWITCHABLE = new Set(['Alegreya', 'Bitter', 'Cormorant Garamond', 'Gelasio', 'Playfair Display', 'Raleway', 'Roboto', 'Roboto Slab', 'Sorts Mill Goudy', 'Vollkorn',
  'Tiro Tamil', 'Tiro Bangla', 'Tiro Devanagari Hindi', 'Tiro Kannada', 'Tiro Telugu', 'Tiro Devanagari Marathi', 'Tiro Devanagari Sanskrit']);
/** 'lining' (default figures are old-style; lining available), 'single' (one style only), or 'unknown' (your own font). */
export const figureSupport = (name) => (LINING_SWITCHABLE.has(name) ? 'lining' : FONT_META[name] ? 'single' : 'unknown');

// Fonts that come with Windows or macOS. Booky uses them when this computer has them (they are never copied
// into an ebook — Apple and Microsoft fonts are licensed for the computer, not for redistribution).
export const SYSTEM_FONT_LIST = [
  // macOS
  ['Avenir Next', 'sans'], ['Avenir', 'sans'], ['Helvetica Neue', 'sans'], ['Helvetica', 'sans'], ['Futura', 'sans'], ['Gill Sans', 'sans'], ['Optima', 'sans'],
  ['Seravek', 'sans'], ['Lucida Grande', 'sans'], ['Skia', 'sans'], ['Verdana', 'sans'], ['Trebuchet MS', 'sans'], ['Arial', 'sans'], ['Tahoma', 'sans'],
  ['Baskerville', 'serif'], ['Big Caslon', 'display'], ['Didot', 'display'], ['Bodoni 72', 'display'], ['Hoefler Text', 'serif'], ['Palatino', 'serif'],
  ['Charter', 'serif'], ['Iowan Old Style', 'serif'], ['Athelas', 'serif'], ['Georgia', 'serif'], ['Cochin', 'serif'], ['Times', 'serif'], ['Times New Roman', 'serif'],
  ['Superclarendon', 'display'], ['Rockwell', 'display'], ['Copperplate', 'display'], ['Phosphate', 'display'], ['Impact', 'display'], ['Herculanum', 'display'],
  ['American Typewriter', 'mono'], ['Courier', 'mono'], ['Courier New', 'mono'], ['Menlo', 'mono'], ['Monaco', 'mono'], ['Andale Mono', 'mono'],
  ['Snell Roundhand', 'script'], ['Zapfino', 'script'], ['Savoye LET', 'script'], ['Bradley Hand', 'script'], ['Noteworthy', 'script'], ['Marker Felt', 'script'],
  ['Chalkboard SE', 'script'], ['Apple Chancery', 'script'], ['Brush Script MT', 'script'], ['Luminari', 'display'], ['Trattatello', 'display'], ['Papyrus', 'display'],
  ['Tamil Sangam MN', 'serif'], ['InaiMathi', 'sans'], ['Kohinoor Devanagari', 'sans'], ['Devanagari Sangam MN', 'serif'], ['ITF Devanagari', 'sans'],
  ['Kohinoor Bangla', 'sans'], ['Bangla Sangam MN', 'serif'], ['Malayalam Sangam MN', 'serif'], ['Telugu Sangam MN', 'serif'], ['Kohinoor Telugu', 'sans'],
  ['Kannada Sangam MN', 'serif'], ['Gujarati Sangam MN', 'serif'], ['Kohinoor Gujarati', 'sans'], ['Gurmukhi MN', 'sans'], ['Oriya Sangam MN', 'serif'],
  ['Sinhala Sangam MN', 'serif'], ['Noto Nastaliq Urdu', 'serif'], ['Geeza Pro', 'sans'], ['Baghdad', 'serif'], ['Al Nile', 'sans'], ['Damascus', 'sans'],
  ['Hiragino Sans', 'sans'], ['Hiragino Mincho ProN', 'serif'], ['PingFang SC', 'sans'], ['Songti SC', 'serif'],
  // Windows
  ['Segoe UI', 'sans'], ['Calibri', 'sans'], ['Candara', 'sans'], ['Corbel', 'sans'], ['Century Gothic', 'sans'], ['Franklin Gothic Medium', 'sans'],
  ['Cambria', 'serif'], ['Constantia', 'serif'], ['Garamond', 'serif'], ['Palatino Linotype', 'serif'], ['Book Antiqua', 'serif'], ['Bookman Old Style', 'serif'],
  ['Sitka Text', 'serif'], ['Georgia Pro', 'serif'], ['Consolas', 'mono'], ['Segoe Script', 'script'], ['Lucida Handwriting', 'script'],
  ['Nirmala UI', 'sans'], ['Latha', 'sans'], ['Vijaya', 'serif'], ['Mangal', 'sans'], ['Aparajita', 'serif'], ['Kokila', 'serif'], ['Urdu Typesetting', 'serif'],
];
export const SYSTEM_FONTS = SYSTEM_FONT_LIST.map(([n]) => n);
const SYSTEM_KIND = Object.fromEntries(SYSTEM_FONT_LIST);

// A free built-in font that looks close, used where the computer font is missing (other computers, ebook readers).
export const LOOKALIKE = {
  'Avenir Next': 'Urbanist', Avenir: 'Nunito Sans', Futura: 'Jost', 'Gill Sans': 'Cabin', 'Helvetica Neue': 'Arimo', Helvetica: 'Arimo', Arial: 'Arimo',
  Optima: 'Marcellus', Seravek: 'Mulish', 'Segoe UI': 'Open Sans', Calibri: 'Carlito', 'Century Gothic': 'Montserrat', 'Franklin Gothic Medium': 'Libre Franklin',
  Verdana: 'PT Sans', Tahoma: 'PT Sans', 'Trebuchet MS': 'Fira Sans', 'Lucida Grande': 'Open Sans',
  Baskerville: 'Libre Baskerville', 'Big Caslon': 'Libre Caslon Text', Didot: 'Prata', 'Bodoni 72': 'Libre Bodoni', 'Hoefler Text': 'EB Garamond', Garamond: 'EB Garamond',
  Palatino: 'Domine', 'Palatino Linotype': 'Domine', 'Book Antiqua': 'Domine', Charter: 'Merriweather', 'Iowan Old Style': 'Literata', Athelas: 'Crimson Pro',
  Georgia: 'Gelasio', 'Georgia Pro': 'Gelasio', Cochin: 'Cormorant Garamond', Times: 'Tinos', 'Times New Roman': 'Tinos', Cambria: 'Caladea', Constantia: 'Spectral',
  Superclarendon: 'Bitter', Rockwell: 'Zilla Slab', Copperplate: 'Cinzel', Impact: 'Anton',
  'American Typewriter': 'Special Elite', Courier: 'Courier Prime', 'Courier New': 'Cousine', Menlo: 'JetBrains Mono', Monaco: 'JetBrains Mono', Consolas: 'JetBrains Mono',
  'Snell Roundhand': 'Great Vibes', Zapfino: 'Great Vibes', 'Savoye LET': 'Great Vibes', 'Bradley Hand': 'Caveat', Noteworthy: 'Caveat', 'Marker Felt': 'Caveat',
  'Apple Chancery': 'Dancing Script', 'Brush Script MT': 'Satisfy', 'Segoe Script': 'Satisfy',
  'Tamil Sangam MN': 'Noto Serif Tamil', InaiMathi: 'Noto Sans Tamil', Latha: 'Noto Sans Tamil', Vijaya: 'Noto Serif Tamil',
  'Kohinoor Devanagari': 'Noto Sans Devanagari', 'Devanagari Sangam MN': 'Noto Serif Devanagari', Mangal: 'Noto Sans Devanagari', 'Nirmala UI': 'Noto Sans',
  'Noto Nastaliq Urdu': 'Noto Nastaliq Urdu', 'Urdu Typesetting': 'Noto Nastaliq Urdu',
};
export const lookalikeFor = (name) => (LOOKALIKE[name] && FONT_META[LOOKALIKE[name]] ? LOOKALIKE[name] : null);

/** Is a font installed on this computer? Measured by drawing text: a missing font falls back and measures like the fallback. */
const installedCache = new Map();
export function isInstalled(name) {
  if (installedCache.has(name)) return installedCache.get(name);
  let yes = false;
  try {
    const ctx = (isInstalled.c ||= document.createElement('canvas')).getContext('2d');
    const sample = 'mmmmmmmmmmlli WAV 0123 ஆ अ ب';
    for (const base of ['monospace', 'serif', 'sans-serif']) {
      ctx.font = `72px ${base}`;
      const w0 = ctx.measureText(sample).width;
      ctx.font = `72px "${name}", ${base}`;
      if (Math.abs(ctx.measureText(sample).width - w0) > 0.5) { yes = true; break; }
    }
  } catch { /* no canvas (tests) */ }
  installedCache.set(name, yes);
  return yes;
}

/** Ask the browser for every font on this computer (Chrome, Edge and the desktop app). Saves the family names. */
export async function scanComputerFonts() {
  if (typeof globalThis.queryLocalFonts !== 'function') return null;
  const all = await globalThis.queryLocalFonts();
  const names = [...new Set(all.map((f) => f.family))].filter((n) => n && !n.startsWith('.') && !FONT_META[n]).sort((a, b) => a.localeCompare(b));
  setApp({ computerFonts: names });
  return names;
}
export const canScanFonts = () => typeof globalThis.queryLocalFonts === 'function';

export function allFonts() {
  return [...BUNDLED_FONTS, ...state.app.customFonts.map((f) => f.name), ...SYSTEM_FONTS, ...(state.app.computerFonts || [])];
}

/** Font choices for a select, with the book's own script first and groups labelled. */
export function fontOptions(langCode) {
  const script = langInfo(langCode).script;
  const opt = (n, extra = '') => ({ value: n, label: `${n}${extra}`, style: `font-family:${fontStack(n)}` });
  const groups = [];
  const byScript = (sc) => catalog.filter((f) => (sc === 'latin' ? f.scripts.length === 1 && f.scripts[0] === 'latin' : f.scripts.includes(sc)));
  const order = [script, ...Object.keys(SCRIPT_LABELS).filter((s) => s !== script)];
  for (const sc of order) {
    const list = byScript(sc);
    if (!list.length) continue;
    groups.push({ value: `__${sc}`, label: `── ${SCRIPT_LABELS[sc]} ──`, disabled: true });
    for (const f of list) groups.push(opt(f.name, f.note ? `  (${f.note})` : ''));
  }
  if (state.app.customFonts.length) {
    groups.push({ value: '__custom', label: '── Your fonts ──', disabled: true });
    state.app.customFonts.forEach((f) => groups.push(opt(f.name)));
  }
  const here = SYSTEM_FONTS.filter(isInstalled);
  const scanned = (state.app.computerFonts || []).filter((n) => !SYSTEM_KIND[n]);
  if (here.length || scanned.length) {
    groups.push({ value: '__system', label: '── On this computer ──', disabled: true });
    here.forEach((n) => groups.push(opt(n, lookalikeFor(n) ? `  (ebooks: ${lookalikeFor(n)})` : '')));
    scanned.forEach((n) => groups.push(opt(n)));
  }
  return groups;
}

// langFont: a font for the book's language, used for any characters `name` lacks (e.g. Tamil text in a Latin font).
export function fontStack(name, langFont) {
  if (!name) return langFont ? `"${langFont}", serif` : 'serif';
  const kind = FONT_META[name] || SYSTEM_KIND[name];
  const fallback = kind === 'sans' ? 'Helvetica, Arial, sans-serif' : kind === 'mono' ? '"Courier New", monospace' : kind === 'script' ? 'cursive' : 'Georgia, "Times New Roman", serif';
  // a computer font is followed by its built-in look-alike, so other computers and ebook readers stay close
  const alike = lookalikeFor(name);
  return `"${name}", ${alike && alike !== name ? `"${alike}", ` : ''}${langFont && langFont !== name ? `"${langFont}", ` : ''}${fallback}`;
}

export function customFontCss() {
  return state.app.customFonts
    .map((f) => `@font-face{font-family:'${f.name}';src:url(${f.data});font-display:swap;}`)
    .join('\n');
}

/** @font-face CSS for all fonts, or only for the given family names (keeps previews and exports small). */
export function fontFaceCss(families) {
  const all = fontCss + '\n' + customFontCss();
  if (!families) return all;
  const want = new Set([...families].filter(Boolean));
  return (all.match(/@font-face\s*{[^}]*}/g) || []).filter((b) => {
    const m = b.match(/font-family:\s*(?:['"]([^'"]+)['"]|([^;}]+))/); // the build may strip the quotes
    const fam = (m?.[1] || m?.[2] || '').trim();
    return fam && want.has(fam);
  }).join('\n');
}

/** Every font a book uses: its design, cover, and any font set on text in the manuscript. */
export function fontsUsedBy(book) {
  const f = book.format;
  const set = new Set([f.body.font, f.headings.font, f.headings.numberFont, f.headings.subheadFont, f.firstPara.dropCapFont, f.header.font, f.pageNumbers.font]);
  for (const l of book.cover?.layers || []) set.add(l.font);
  if (book.cover) { set.add(book.cover.spine?.font); set.add(book.cover.back?.font); }
  for (const e of book.elements) for (const m of (e.content || '').matchAll(/font-family:\s*(?:&quot;|["'])?([^;"'&]+)/g)) set.add(m[1].split(',')[0].trim());
  const L = langInfo(book.meta?.language);
  if (L.script !== 'latin') { set.add(L.body); set.add(L.heading); }
  for (const n of [...set]) { const a = lookalikeFor(n); if (a) set.add(a); }
  set.delete('');
  set.delete(undefined);
  return set;
}

let styleEl;
export function installFonts() {
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'booky-fonts';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = fontFaceCss();
}

export async function addCustomFont(file) {
  const data = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ').replace(/\b(regular|normal)\b/i, '').trim();
  const fonts = state.app.customFonts.filter((f) => f.name !== name).concat({ name, data });
  setApp({ customFonts: fonts });
  installFonts();
  return name;
}

export function removeCustomFont(name) {
  setApp({ customFonts: state.app.customFonts.filter((f) => f.name !== name) });
  installFonts();
}

export async function ensureFontsLoaded(names) {
  if (!document.fonts) return;
  await Promise.all(
    [...new Set(names.filter(Boolean))].flatMap((n) => [
      document.fonts.load(`400 20px "${n}"`), document.fonts.load(`700 20px "${n}"`), document.fonts.load(`italic 400 20px "${n}"`),
    ].map((p) => p.catch(() => null)))
  );
}
