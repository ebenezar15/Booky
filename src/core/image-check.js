// Image pre-flight: print resolution at the placed size, colour on black-and-white paper,
// full-page images without bleed, and missing alt text for ebooks.
// `collectImages` and `imageFindings` are pure (unit-tested); `measureImages` runs in the browser.
import { trimOf } from './themes.js';

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3] ?? '') : null;
};
const decode = (s) => String(s || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Every image in the manuscript, in reading order: { elId, index, src, alt, width, printed, ebook }. */
export function collectImages(book) {
  const out = [];
  for (const el of book.elements) {
    const tags = String(el.content || '').match(/<img\b[^>]*>/gi) || [];
    tags.forEach((tag, index) => {
      const cls = attr(tag, 'class') || '';
      if (/bk-scene-img/.test(cls)) return;
      out.push({
        elId: el.id, index, title: el.title || '', src: decode(attr(tag, 'src')), alt: decode(attr(tag, 'alt') ?? ''),
        width: attr(tag, 'data-width') || '100', printed: el.include?.print !== false, ebook: el.include?.ebook !== false,
      });
    });
  }
  return out;
}

/** Printed size of an image in inches (width, and height when known). */
export function printedSize(book, img, dims) {
  const f = book.format;
  const { w, h } = trimOf(f);
  if (img.width === 'page') {
    const b = f.bleed ? 2 * (+f.bleedSize || 0.125) : 0;
    return { w: w + b, h: h + b, cover: true };
  }
  const textW = w - f.margins.inside - f.margins.outside;
  const pw = textW * (Math.min(100, +img.width || 100) / 100);
  return { w: pw, h: dims?.w ? pw * (dims.h / dims.w) : 0 };
}

/** Effective pixels per inch at the placed size (full-page images are cropped to cover the page). */
export function effectivePpi(book, img, dims) {
  if (!dims?.w) return 0;
  const s = printedSize(book, img, dims);
  return s.cover ? Math.min(dims.w / s.w, dims.h / s.h) : dims.w / s.w;
}

/**
 * dims: Map src → { w, h, color } (pixel size and whether the image has colour).
 * opts: { print: bool, ebook: bool }
 * @returns [{ level: 'ok'|'warn'|'bad', kind, elId, index, text }]
 */
export function imageFindings(book, images, dims, { print = true, ebook = true } = {}) {
  const out = [];
  const where = (img) => `${img.title || 'Untitled page'}, image ${img.index + 1}`;
  const paper = book.cover?.paper || 'cream';
  let colourWarned = false;
  for (const img of images) {
    const d = dims.get(img.src);
    if (print && img.printed) {
      const ppi = effectivePpi(book, img, d);
      if (ppi && ppi < 150) out.push({ level: 'bad', kind: 'ppi', elId: img.elId, index: img.index, text: `${where(img)}: ${Math.round(ppi)} ppi at its printed size — too low for print (needs 300; under 150 looks blurry). Use a larger image or a smaller width.` });
      else if (ppi && ppi < 300) out.push({ level: 'warn', kind: 'ppi', elId: img.elId, index: img.index, text: `${where(img)}: ${Math.round(ppi)} ppi at its printed size — printers ask for 300 ppi.` });
      if (d?.color && paper !== 'color' && !colourWarned) {
        colourWarned = true;
        const n = images.filter((x) => x.printed && dims.get(x.src)?.color).length;
        out.push({ level: 'warn', kind: 'color', elId: img.elId, index: img.index, text: `${n} colour image${n === 1 ? '' : 's'} on ${paper} (black-and-white) paper — they will print in greyscale. Choose colour paper on the Cover tab if you need colour.` });
      }
      if (img.width === 'page' && !book.format.bleed) out.push({ level: 'warn', kind: 'bleed', elId: img.elId, index: img.index, text: `${where(img)} is a full-page image but bleed is off — expect a thin white edge. Turn on bleed in Format → Trim size & margins.` });
    }
    if (ebook && img.ebook && !img.alt.trim()) out.push({ level: 'bad', kind: 'alt', elId: img.elId, index: img.index, text: `${where(img)} has no alt text — screen-reader users need a short description.` });
  }
  return out;
}

/** True when an RGBA pixel buffer has noticeable colour (not greyscale). */
export function hasColour(data, threshold = 18, share = 0.02) {
  let coloured = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    n++;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > threshold) coloured++;
  }
  return n > 0 && coloured / n > share;
}

/** Load each distinct image and measure it (browser). */
export async function measureImages(images) {
  const dims = new Map();
  await Promise.all([...new Set(images.map((i) => i.src))].map((src) => new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      let color = false;
      try {
        const c = document.createElement('canvas');
        c.width = 48; c.height = 48;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(im, 0, 0, 48, 48);
        color = hasColour(ctx.getImageData(0, 0, 48, 48).data);
      } catch { /* cross-origin image */ }
      dims.set(src, { w: im.naturalWidth, h: im.naturalHeight, color });
      resolve();
    };
    im.onerror = () => resolve();
    im.src = src;
  })));
  return dims;
}
