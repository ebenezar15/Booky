// Canvas cover renderer: ebook front cover and full print wrap (back + spine + front).
import { fillText, bookWords } from '../core/model.js';
import { trimOf } from '../core/themes.js';

const imgCache = new Map();
export function loadImage(src, onReady) {
  if (!src) return null;
  let rec = imgCache.get(src);
  if (!rec) {
    const img = new Image();
    rec = { img, ready: false, cbs: new Set() };
    img.onload = () => { rec.ready = true; rec.cbs.forEach((cb) => cb()); rec.cbs.clear(); };
    img.src = src;
    imgCache.set(src, rec);
  }
  if (!rec.ready && onReady) rec.cbs.add(onReady);
  return rec.ready ? rec.img : null;
}

function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    out.push(line);
  }
  return out;
}

export function paintBackground(ctx, bg, x, y, w, h, onReady) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (bg.type === 'gradient') {
    const a = ((bg.angle ?? 160) - 90) * Math.PI / 180;
    const cx = x + w / 2, cy = y + h / 2, r = Math.abs(w * Math.cos(a)) / 2 + Math.abs(h * Math.sin(a)) / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.addColorStop(0, bg.color);
    g.addColorStop(1, bg.color2 || bg.color);
    ctx.fillStyle = g;
  } else ctx.fillStyle = bg.color;
  ctx.fillRect(x, y, w, h);
  if (bg.type === 'image' && bg.image) {
    const img = loadImage(bg.image, onReady);
    if (img) {
      const fit = bg.imageFit || 'cover';
      const s = fit === 'contain' ? Math.min(w / img.width, h / img.height) : Math.max(w / img.width, h / img.height);
      const iw = img.width * s, ih = img.height * s;
      const px = (bg.posX ?? 50) / 100, py = (bg.posY ?? 50) / 100;
      ctx.drawImage(img, x + (w - iw) * px, y + (h - ih) * py, iw, ih);
    }
  }
  if (bg.overlay > 0) {
    ctx.globalAlpha = bg.overlay;
    ctx.fillStyle = bg.overlayColor || '#000';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawTextLayer(ctx, layer, book, x, y, w, h) {
  let text = fillText(layer.text || '', book);
  if (!text.trim() || layer.visible === false) return null;
  if (layer.upper) text = text.toUpperCase();
  const size = (layer.size / 100) * w;
  ctx.save();
  ctx.font = `${layer.italic ? 'italic ' : ''}${layer.weight || 400} ${size}px "${layer.font}", Georgia, serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(layer.spacing || 0) * size}px`;
  ctx.fillStyle = layer.color;
  ctx.textAlign = layer.align || 'center';
  ctx.textBaseline = 'middle';
  const maxW = (layer.width / 100) * w;
  const lines = wrapLines(ctx, text, maxW);
  const lh = size * (layer.lineHeight || 1.15);
  const total = lh * lines.length;
  const cx = x + (layer.x / 100) * w;
  let cy = y + (layer.y / 100) * h - total / 2 + lh / 2;
  const ax = layer.align === 'left' ? cx - maxW / 2 : layer.align === 'right' ? cx + maxW / 2 : cx;
  if (layer.shadow) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = size * 0.18; ctx.shadowOffsetY = size * 0.04; }
  if (layer.outline) { ctx.strokeStyle = layer.outlineColor || '#000'; ctx.lineWidth = size * 0.05; }
  for (const line of lines) {
    if (layer.outline) ctx.strokeText(line, ax, cy);
    ctx.fillText(line, ax, cy);
    cy += lh;
  }
  ctx.restore();
  return { x: cx - maxW / 2, y: y + (layer.y / 100) * h - total / 2, w: maxW, h: total };
}

function drawOrnament(ctx, orn, x, y, w, h) {
  if (!orn?.show) return;
  const cy = y + (orn.y / 100) * h;
  const cx = x + w / 2;
  ctx.save();
  ctx.strokeStyle = orn.color;
  ctx.fillStyle = orn.color;
  ctx.lineWidth = Math.max(1, w * 0.002);
  if (orn.style === 'line') {
    ctx.beginPath(); ctx.moveTo(cx - w * 0.14, cy); ctx.lineTo(cx + w * 0.14, cy); ctx.stroke();
  } else if (orn.style === 'diamond') {
    ctx.beginPath(); ctx.moveTo(cx - w * 0.2, cy); ctx.lineTo(cx - w * 0.03, cy); ctx.moveTo(cx + w * 0.03, cy); ctx.lineTo(cx + w * 0.2, cy); ctx.stroke();
    const d = w * 0.014;
    ctx.beginPath(); ctx.moveTo(cx, cy - d); ctx.lineTo(cx + d, cy); ctx.lineTo(cx, cy + d); ctx.lineTo(cx - d, cy); ctx.closePath(); ctx.fill();
  } else if (orn.style === 'frame') {
    const m = w * 0.05;
    ctx.lineWidth = Math.max(1, w * 0.004);
    ctx.strokeRect(x + m, y + m, w - 2 * m, h - 2 * m);
    ctx.lineWidth = Math.max(1, w * 0.0015);
    ctx.strokeRect(x + m * 1.35, y + m * 1.35, w - 2.7 * m, h - 2.7 * m);
  } else if (orn.style === 'band') {
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, cy - h * 0.09, w, h * 0.18);
  } else if (orn.style === 'dots') {
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(cx + i * w * 0.03, cy, w * 0.006, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

/** Draws the front cover into rect (x,y,w,h). Returns layer hit-boxes. */
export function drawFront(ctx, book, x, y, w, h, onReady) {
  const c = book.cover;
  paintBackground(ctx, c.background, x, y, w, h, onReady);
  if (c.ornament?.style === 'band') drawOrnament(ctx, c.ornament, x, y, w, h);
  const boxes = {};
  for (const l of c.layers) {
    if (l.kind === 'image' && l.src) {
      const img = loadImage(l.src, onReady);
      if (img) {
        const iw = (l.width / 100) * w, ih = iw * (img.height / img.width);
        const ix = x + (l.x / 100) * w - iw / 2, iy = y + (l.y / 100) * h - ih / 2;
        ctx.drawImage(img, ix, iy, iw, ih);
        boxes[l.id] = { x: ix, y: iy, w: iw, h: ih };
      }
      continue;
    }
    const b = drawTextLayer(ctx, l, book, x, y, w, h);
    if (b) boxes[l.id] = b;
  }
  if (c.ornament?.style !== 'band') drawOrnament(ctx, c.ornament, x, y, w, h);
  return boxes;
}

export const PAPER = { white: 0.002252, cream: 0.0025, color: 0.002347 };

export function estimatePages(book) {
  if (book.cover.pageCountOverride > 0) return book.cover.pageCountOverride;
  if (book.cover.lastPageCount > 0) return book.cover.lastPageCount;
  const { w, h } = trimOf(book.format);
  const m = book.format.margins;
  const fs = book.format.body.size, lead = book.format.body.leading;
  const charsPerLine = ((w - m.inside - m.outside) * 72) / (fs * 0.47);
  const linesPerPage = ((h - m.top - m.bottom) * 72) / (fs * lead);
  const wordsPerPage = Math.max(80, (charsPerLine * linesPerPage) / 6.2);
  const pages = Math.ceil(bookWords(book) / wordsPerPage) + book.elements.length * 1.5;
  return Math.max(24, Math.ceil(pages / 2) * 2);
}

export function wrapDims(book) {
  const { w, h } = trimOf(book.format);
  const pages = estimatePages(book);
  const spine = Math.max(0.06, pages * (PAPER[book.cover.paper] || PAPER.cream));
  const bleed = 0.125;
  return { trimW: w, trimH: h, spine, bleed, pages, totalW: bleed * 2 + w * 2 + spine, totalH: h + bleed * 2 };
}

export function drawWrap(ctx, book, dpi, onReady) {
  const d = wrapDims(book);
  const c = book.cover;
  const px = (inch) => inch * dpi;
  const W = px(d.totalW), H = px(d.totalH);
  const backColor = c.back.color || c.background.color;
  ctx.fillStyle = backColor;
  ctx.fillRect(0, 0, W, H);
  // Front panel (right side) including its bleed.
  const frontX = px(d.bleed + d.trimW + d.spine);
  drawFront(ctx, book, frontX, 0, W - frontX, H, onReady);
  // Spine
  const sx = px(d.bleed + d.trimW), sw = px(d.spine);
  ctx.fillStyle = c.spine.color2 || backColor;
  ctx.fillRect(sx, 0, sw, H);
  if (c.spine.show && d.pages >= 80) {
    ctx.save();
    ctx.translate(sx + sw / 2, H / 2);
    ctx.rotate(Math.PI / 2);
    const fs = Math.min(sw * 0.5, px(0.22));
    ctx.font = `700 ${fs}px "${c.spine.font}", sans-serif`;
    ctx.fillStyle = c.spine.color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const title = c.spine.textOverride || book.meta.title;
    ctx.fillText(title.toUpperCase(), -H / 2 + px(0.6), 0);
    ctx.textAlign = 'right';
    ctx.font = `400 ${fs * 0.8}px "${c.spine.font}", sans-serif`;
    ctx.fillText((book.meta.author || '').toUpperCase(), H / 2 - px(0.6), 0);
    ctx.restore();
  }
  // Back panel blurb
  const bx = px(d.bleed + 0.6), by = px(d.bleed + 0.8), bw = px(d.trimW - 1.2);
  ctx.save();
  ctx.fillStyle = c.back.textColor;
  const bfs = px(c.back.size / 72);
  ctx.font = `400 ${bfs}px "${c.back.font}", Georgia, serif`;
  ctx.textBaseline = 'top';
  const blurb = c.back.blurb || book.meta.description || '';
  let yy = by;
  for (const line of wrapLines(ctx, blurb, bw)) { ctx.fillText(line, bx, yy); yy += bfs * 1.45; }
  ctx.restore();
  if (c.back.showBarcodeBox) {
    const bw2 = px(2), bh2 = px(1.2);
    const x2 = px(d.bleed + d.trimW - 0.35) - bw2, y2 = H - px(d.bleed + 0.35) - bh2;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x2, y2, bw2, bh2);
    ctx.fillStyle = '#999';
    ctx.font = `${px(0.1)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(book.meta.isbnPrint ? `ISBN ${book.meta.isbnPrint}` : 'ISBN barcode area', x2 + bw2 / 2, y2 + bh2 / 2);
    if (c.back.price) ctx.fillText(c.back.price, x2 + bw2 / 2, y2 + bh2 - px(0.12));
  }
  return { W, H, d };
}

export function drawGuides(ctx, d, dpi) {
  const px = (i) => i * dpi;
  ctx.save();
  ctx.setLineDash([px(0.05), px(0.05)]);
  ctx.lineWidth = Math.max(1, dpi / 100);
  ctx.strokeStyle = 'rgba(255,0,80,.8)';
  ctx.strokeRect(px(d.bleed), px(d.bleed), px(d.totalW - 2 * d.bleed), px(d.trimH));
  ctx.strokeStyle = 'rgba(0,160,255,.9)';
  const s1 = px(d.bleed + d.trimW), s2 = s1 + px(d.spine);
  [s1, s2].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, px(d.totalH)); ctx.stroke(); });
  ctx.strokeStyle = 'rgba(0,200,120,.8)';
  ctx.strokeRect(px(d.bleed + 0.25), px(d.bleed + 0.25), px(d.trimW - 0.5), px(d.trimH - 0.5));
  ctx.strokeRect(s2 + px(0.25), px(d.bleed + 0.25), px(d.trimW - 0.5), px(d.trimH - 0.5));
  ctx.restore();
}

export function coverThumbnail(book, w = 300) {
  const h = Math.round(w * 1.5);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const redraw = () => drawFront(ctx, book, 0, 0, w, h, redraw);
  redraw();
  return c;
}

export function frontCoverDataURL(book, type = 'image/jpeg') {
  const { w, h } = book.cover.ebookSize;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  drawFront(c.getContext('2d'), book, 0, 0, w, h);
  return c.toDataURL(type, 0.92);
}
