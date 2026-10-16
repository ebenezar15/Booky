// Read a font file's own family name, weight and style (pure; unit-tested).
// TTF/OTF (sfnt): the 'name' table (typographic family 16/17, else 1/2) and OS/2 (usWeightClass, fsSelection).
// WOFF: the same tables, zlib-compressed. WOFF2 and anything unreadable fall back to the file name.

const WEIGHT_WORDS = [
  [/hairline|thin/i, 100], [/extra[\s-]?light|ultra[\s-]?light/i, 200], [/light/i, 300], [/medium/i, 500],
  [/semi[\s-]?bold|demi[\s-]?bold|demi\b/i, 600], [/extra[\s-]?bold|ultra[\s-]?bold/i, 800], [/black|heavy/i, 900], [/bold/i, 700],
];
export const weightFromName = (s) => +(String(s || '').match(/\b([1-9]00)\b/)?.[1] || 0) || (WEIGHT_WORDS.find(([re]) => re.test(s || ''))?.[1]) || 400;
export const italicFromName = (s) => /italic|oblique|kursiv/i.test(s || '');

/** "Avenir-HeavyOblique.ttf" → { family: 'Avenir', weight: 900, style: 'italic' } */
export function guessFromFileName(fileName) {
  const base = String(fileName).replace(/\.(ttf|otf|woff2?|ttc)$/i, '');
  const parts = base.split(/[-_ ]+/);
  const styleWords = /^(regular|normal|book|roman|italic|oblique|thin|hairline|light|extralight|ultralight|medium|semibold|demibold|demi|bold|extrabold|ultrabold|black|heavy|condensed|narrow|variable|vf|webfont)+$/i;
  let cut = parts.length;
  // "Avenir-HeavyOblique" / "Lora-BoldItalic" / "OpenSans_SemiBold"
  // also numeric weights and Fontsource-style subset names ("lora-latin-700-italic")
  while (cut > 1 && (styleWords.test(parts[cut - 1].replace(/(?<=[a-z])(?=[A-Z])/g, '')) || /^([1-9]00|latin|ext|cyrillic|greek|vietnamese)$/i.test(parts[cut - 1]))) cut--;
  let family = parts.slice(0, cut).join(' ');
  const tail = parts.slice(cut).join(' ');
  // "LoraBold" written as one word
  const glued = family.match(/^(.+?)(Thin|ExtraLight|Light|Regular|Medium|SemiBold|Bold|ExtraBold|Black|Heavy)?(Italic|Oblique)?$/);
  let style = tail;
  if (!tail && glued && (glued[2] || glued[3]) && glued[1].length > 2) { family = glued[1]; style = `${glued[2] || ''}${glued[3] || ''}`; }
  family = family.replace(/(?<=[a-z])(?=[A-Z])/g, ' ').replace(/\s+/g, ' ').trim();
  if (family === family.toLowerCase()) family = family.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  return { family: family || base, weight: weightFromName(style), style: italicFromName(style) ? 'italic' : 'normal' };
}

const u16 = (d, o) => (d[o] << 8) | d[o + 1];
const u32 = (d, o) => ((d[o] << 24) >>> 0) + ((d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]);

function decodeName(d, off, len, platform) {
  if (platform === 3 || platform === 0) { let s = ''; for (let i = 0; i + 1 < len; i += 2) s += String.fromCharCode(u16(d, off + i)); return s; }
  let s = ''; for (let i = 0; i < len; i++) s += String.fromCharCode(d[off + i]); return s;
}

/** Names from a 'name' table: { 1, 2, 4, 16, 17 } preferring Windows English, then any. */
export function readNameTable(d) {
  const count = u16(d, 2), strOff = u16(d, 4);
  const best = {};
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    const platform = u16(d, r), lang = u16(d, r + 4), id = u16(d, r + 6), len = u16(d, r + 8), off = u16(d, r + 10);
    if (![1, 2, 4, 16, 17].includes(id)) continue;
    const score = platform === 3 && lang === 0x409 ? 3 : platform === 3 ? 2 : platform === 1 && lang === 0 ? 1 : 0;
    if (best[id] && best[id].score >= score) continue;
    best[id] = { score, text: decodeName(d, strOff + off, len, platform) };
  }
  return Object.fromEntries(Object.entries(best).map(([k, v]) => [k, v.text.replace(/\0/g, '').trim()]));
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Tables we need from an sfnt or WOFF file: { name, os2 } as byte arrays. */
async function tables(d) {
  const tag = String.fromCharCode(d[0], d[1], d[2], d[3]);
  const out = {};
  if (tag === 'wOFF') {
    const n = u16(d, 12);
    for (let i = 0; i < n; i++) {
      const r = 44 + i * 20;
      const t = String.fromCharCode(d[r], d[r + 1], d[r + 2], d[r + 3]);
      if (t !== 'name' && t !== 'OS/2') continue;
      const off = u32(d, r + 4), comp = u32(d, r + 8), orig = u32(d, r + 12);
      const raw = d.subarray(off, off + comp);
      out[t] = comp < orig ? await inflate(raw) : raw;
    }
    return out;
  }
  if (tag === 'wOF2') return out; // Brotli-compressed: use the file name
  const n = u16(d, 4);
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16;
    const t = String.fromCharCode(d[r], d[r + 1], d[r + 2], d[r + 3]);
    if (t === 'name' || t === 'OS/2') out[t] = d.subarray(u32(d, r + 8), u32(d, r + 8) + u32(d, r + 12));
  }
  return out;
}

/** Family, weight and style of a font file. */
export async function readFontInfo(bytes, fileName = '') {
  const guess = guessFromFileName(fileName);
  try {
    const d = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const t = await tables(d);
    if (!t.name) return guess;
    const names = readNameTable(t.name);
    const family = names[16] || names[1] || guess.family;
    const sub = names[17] || names[2] || '';
    let weight = weightFromName(sub), italic = italicFromName(sub);
    if (t['OS/2'] && t['OS/2'].length > 64) {
      const w = u16(t['OS/2'], 4);
      if (w >= 100 && w <= 1000) weight = Math.round(w / 100) * 100;
      if (u16(t['OS/2'], 62) & 1) italic = true;
    }
    return { family, weight, style: italic ? 'italic' : 'normal', fullName: names[4] || '' };
  } catch {
    return guess;
  }
}

export const FONT_FILE_RE = /\.(ttf|otf|woff2?)$/i;
export const fontMime = (name) => ({ ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' })[String(name).split('.').pop().toLowerCase()] || 'application/octet-stream';
