// Font registry: fonts bundled with the app (work offline) + fonts the user uploads.
import catalog from '../fonts/catalog.json';
import fontCss from '../fonts/fonts.css?inline';
import { state, setApp } from './store.js';
import { SCRIPT_LABELS, langInfo } from './languages.js';

export const FONT_CATALOG = catalog;
export const BUNDLED_FONTS = catalog.map((f) => f.name);
export const FONT_META = Object.fromEntries(catalog.map((f) => [f.name, f.category]));

// Popular fonts that are usually already installed on Windows / Mac (used if present).
export const SYSTEM_FONTS = ['Times New Roman', 'Georgia', 'Garamond', 'Palatino Linotype', 'Book Antiqua', 'Bookman Old Style', 'Baskerville', 'Cambria',
  'Calibri', 'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Century Gothic', 'Gill Sans', 'Futura', 'Segoe UI', 'Courier New',
  'Iowan Old Style', 'Charter', 'Hoefler Text', 'Didot', 'Nirmala UI', 'Latha', 'Mangal'];

export function allFonts() {
  return [...BUNDLED_FONTS, ...state.app.customFonts.map((f) => f.name), ...SYSTEM_FONTS];
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
  groups.push({ value: '__system', label: '── Installed on this computer ──', disabled: true });
  SYSTEM_FONTS.forEach((n) => groups.push(opt(n)));
  return groups;
}

// langFont: a font for the book's language, used for any characters `name` lacks (e.g. Tamil text in a Latin font).
export function fontStack(name, langFont) {
  if (!name) return langFont ? `"${langFont}", serif` : 'serif';
  const kind = FONT_META[name];
  const fallback = kind === 'sans' ? 'Helvetica, Arial, sans-serif' : kind === 'mono' ? '"Courier New", monospace' : 'Georgia, "Times New Roman", serif';
  return `"${name}", ${langFont && langFont !== name ? `"${langFont}", ` : ''}${fallback}`;
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
