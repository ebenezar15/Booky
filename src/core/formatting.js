// Formatting control (pure, unit-tested): character styles, editable paragraph styles, note markers,
// figure numbers, links in print, verse line numbers, and custom-CSS validation.

export const CHAR_STYLE_DEFAULTS = [
  { id: 'foreign', name: 'Foreign word', italic: true },
  { id: 'thought', name: 'Thought', italic: true },
  { id: 'ship', name: 'Ship / vehicle name', italic: true },
  { id: 'strong', name: 'Emphasis strong', bold: true },
  { id: 'textmsg', name: 'Text message', font: 'Inter', size: 0.9, letterSpacing: 0 },
];

export const FORMAT_DEFAULTS = {
  charStyles: CHAR_STYLE_DEFAULTS,
  paraStyles: {}, // overrides of built-in paragraph styles: { verse: { font, size, above, below, indent, align } }
  customParaStyles: [], // [{ id, label, basedOn, font, size, above, below, indent, align, italic }]
  printLinks: 'footnote', // text | footnote | brackets | qr
  captions: { numbering: 'chapter', label: 'Figure' }, // numbering: none | book | chapter
  notes: { placement: 'chapter', numbering: 'chapter', marker: 'number' }, // placement: page | chapter | book; numbering: chapter | continuous; marker: number | symbol
  verse: { lineNumbers: 0, keepStanzas: true, hanging: true, onePerPage: false },
  openers: {}, // { prologue|epilogue|interlude|part|special: { ornament, align, titleSize, image, numberStyle } }
  customCss: { print: '', ebook: '' },
};

const safeId = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'style';
export const newStyleId = (name, taken) => { let id = safeId(name), n = 2; while (taken.includes(id)) id = `${safeId(name)}-${n++}`; return id; };

/** CSS declarations for a character style. */
export function charStyleDecls(s, fontStack = (f) => `'${f}'`) {
  return [
    s.font ? `font-family: ${fontStack(s.font)};` : '',
    s.size && +s.size !== 1 ? `font-size: ${+s.size}em;` : '',
    s.italic ? 'font-style: italic;' : s.italic === false ? 'font-style: normal;' : '',
    s.bold ? 'font-weight: 700;' : '',
    s.smallCaps ? 'font-variant: small-caps; letter-spacing: .04em;' : '',
    s.underline ? 'text-decoration: underline;' : '',
    s.letterSpacing ? `letter-spacing: ${+s.letterSpacing}em;` : '',
    s.color ? `color: ${s.color};` : '',
  ].filter(Boolean).join(' ');
}
export const charStylesCss = (styles = [], fontStack) => styles.map((s) => `.cs-${safeId(s.id)} { ${charStyleDecls(s, fontStack)} }`).join('\n');

/** CSS for paragraph-style overrides and custom styles. `units` converts em spacing for print (pt) or ebook (em). */
export function paraStylesCss(overrides = {}, custom = [], fontStack = (f) => `'${f}'`, sel = (id) => `.bk-content .ps-${id}`) {
  const decls = (o) => [
    o.font ? `font-family: ${fontStack(o.font)};` : '',
    o.size && +o.size !== 1 ? `font-size: ${+o.size}em;` : '',
    o.above != null && o.above !== '' ? `margin-top: ${+o.above}em !important;` : '',
    o.below != null && o.below !== '' ? `margin-bottom: ${+o.below}em !important;` : '',
    o.indent != null && o.indent !== '' ? `text-indent: ${+o.indent}em !important;` : '',
    o.left != null && o.left !== '' ? `margin-left: ${+o.left}em !important;` : '',
    o.align ? `text-align: ${o.align} !important;` : '',
    o.italic ? 'font-style: italic;' : '',
  ].filter(Boolean).join(' ');
  const out = [];
  for (const [id, o] of Object.entries(overrides || {})) { const d = decls(o || {}); if (d) out.push(`${sel(safeId(id))} { ${d} }`); }
  for (const c of custom || []) {
    // a custom style starts from its base style's rules: give it the base class too (done in the renderer), then its own
    const d = decls(c);
    if (d) out.push(`${sel(safeId(c.id))} { ${d} }`);
  }
  return out.join('\n');
}

/** Note markers: 1 2 3…, or * † ‡ § ‖ ¶ then doubled. */
const SYMBOLS = ['*', '†', '‡', '§', '‖', '¶'];
export function noteMarker(n, style = 'number') {
  if (style !== 'symbol') return String(n);
  const i = (n - 1) % SYMBOLS.length;
  return SYMBOLS[i].repeat(Math.floor((n - 1) / SYMBOLS.length) + 1);
}

/** "Figure 3.2" (per chapter), "Figure 7" (whole book), or '' (no numbering). */
export function figureLabel(captions, chapterNo, n, bookN) {
  const c = { ...FORMAT_DEFAULTS.captions, ...(captions || {}) };
  if (c.numbering === 'none') return '';
  return `${c.label || 'Figure'} ${c.numbering === 'chapter' && chapterNo ? `${chapterNo}.${n}` : bookN}`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Display form of a URL for print: no scheme, no trailing slash. */
export const printableUrl = (href) => String(href).replace(/^https?:\/\//i, '').replace(/^mailto:/i, '').replace(/\/$/, '');
const isExternal = (href) => /^(https?:|mailto:)/i.test(String(href || ''));

/**
 * How a link appears in print. Returns { html, note } — note is footnote text when mode is 'footnote'.
 * qr(href) → SVG string (or '' when unavailable, then brackets are used).
 */
export function linkForPrint(href, innerHtml, mode = 'footnote', qr = null) {
  if (!isExternal(href)) return { html: innerHtml, note: null };
  const shown = printableUrl(href);
  const textIsUrl = innerHtml.replace(/<[^>]+>/g, '').trim().replace(/\/$/, '').endsWith(shown);
  if (mode === 'text' || (textIsUrl && mode !== 'qr')) return { html: innerHtml, note: null };
  if (mode === 'footnote') return { html: innerHtml, note: shown };
  if (mode === 'qr') {
    const svg = qr ? qr(href) : '';
    if (svg) return { html: `${innerHtml}<span class="bk-qr" title="${esc(shown)}">${svg}</span>`, note: null };
  }
  return { html: `${innerHtml} <span class="bk-url">(${esc(shown)})</span>`, note: null };
}

/** Verse: which line numbers to print for a poem of `count` lines. */
export const verseNumbers = (count, every) => (every ? Array.from({ length: count }, (_, i) => i + 1).filter((n) => n % every === 0) : []);

/**
 * Check author CSS before it goes into the preview, PDF or EPUB.
 * @returns { ok, css, error } — css has imports and anything that could close the style element removed.
 */
export function validateCss(input) {
  let css = String(input || '');
  if (!css.trim()) return { ok: true, css: '', error: '' };
  if (/<\/?style|<script/i.test(css)) return { ok: false, css: '', error: 'Remove “<style>” or “<script>” — just write the CSS rules.' };
  css = css.replace(/@import[^;]*;?/gi, '');
  // scan: strings, comments, braces
  let depth = 0, line = 1;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '\n') line++;
    if (c === '/' && css[i + 1] === '*') { const end = css.indexOf('*/', i + 2); if (end < 0) return { ok: false, css: '', error: `A comment that starts on line ${line} is never closed with */.` }; line += (css.slice(i, end).match(/\n/g) || []).length; i = end + 1; continue; }
    if (c === '"' || c === "'") { const end = css.indexOf(c, i + 1); const nl = css.indexOf('\n', i + 1); if (end < 0 || (nl >= 0 && nl < end)) return { ok: false, css: '', error: `A quoted string on line ${line} is never closed.` }; i = end; continue; }
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth < 0) return { ok: false, css: '', error: `There is an extra “}” on line ${line}.` }; }
  }
  if (depth > 0) return { ok: false, css: '', error: `${depth} “{” ${depth === 1 ? 'is' : 'are'} never closed with “}”.` };
  return { ok: true, css, error: '' };
}

/** Which overrides a book uses, for the list in Format: [{ elId, kind, label, index }]. */
export function listOverrides(elements) {
  const out = [];
  for (const el of elements) {
    if (el.tracking) out.push({ elId: el.id, kind: 'chapter-tracking', label: `Whole chapter tracking ${el.tracking > 0 ? '+' : ''}${el.tracking}/1000 em`, index: -1 });
    let i = 0;
    for (const m of String(el.content || '').matchAll(/<(p|h[1-4]|blockquote)\b([^>]*)>/gi)) {
      const a = m[2];
      const add = (kind, label) => out.push({ elId: el.id, kind, label, index: i });
      if (/data-keep-next/.test(a)) add('keep-next', 'Keep with next');
      if (/data-keep-lines/.test(a)) add('keep-lines', 'Keep lines together');
      if (/data-break-before/.test(a)) add('break-before', 'Page break before');
      const t = a.match(/data-tracking="(-?\d+)"/);
      if (t && +t[1]) add('tracking', `Tracking ${+t[1] > 0 ? '+' : ''}${t[1]}/1000 em`);
      const only = a.match(/data-only="(print|ebook)"/);
      if (only) add('only', only[1] === 'print' ? 'Print only' : 'Ebook only');
      i++;
    }
  }
  return out;
}
