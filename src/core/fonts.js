// Font registry: fonts bundled with the app (work offline) + fonts the user uploads.
import families from '../fonts/families.json';
import fontCss from '../fonts/fonts.css?inline';
import { state, setApp } from './store.js';

export const BUNDLED_FONTS = families;

export const FONT_META = {
  'EB Garamond': 'serif', 'Crimson Pro': 'serif', 'Libre Baskerville': 'serif', Lora: 'serif',
  Merriweather: 'serif', 'Playfair Display': 'display', 'Cormorant Garamond': 'serif', 'Source Serif 4': 'serif',
  Alegreya: 'serif', Spectral: 'serif', Inter: 'sans', Montserrat: 'sans', Lato: 'sans', Oswald: 'display',
  Cinzel: 'display', 'Abril Fatface': 'display', 'Great Vibes': 'script', 'Courier Prime': 'mono',
};

export const SYSTEM_FONTS = ['Georgia', 'Times New Roman', 'Palatino Linotype', 'Book Antiqua', 'Garamond', 'Arial', 'Helvetica', 'Verdana', 'Trebuchet MS'];

export function allFonts() {
  return [...BUNDLED_FONTS, ...state.app.customFonts.map((f) => f.name), ...SYSTEM_FONTS];
}

export function fontStack(name) {
  if (!name) return 'serif';
  const kind = FONT_META[name];
  const fallback = kind === 'sans' ? 'Helvetica, Arial, sans-serif' : kind === 'mono' ? '"Courier New", monospace' : 'Georgia, "Times New Roman", serif';
  return `"${name}", ${fallback}`;
}

export function customFontCss() {
  return state.app.customFonts
    .map((f) => `@font-face{font-family:'${f.name}';src:url(${f.data});font-display:swap;}`)
    .join('\n');
}

// CSS (with embedded font data in production builds) for iframes and exports.
export function fontFaceCss() {
  return fontCss + '\n' + customFontCss();
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
