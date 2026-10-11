// Cover designer: front cover for ebooks and full print wrap (back · spine · front).
import { h, icon, btn, iconBtn, clear, field, input, textarea, select, toggle, slider, color, segmented, pickFile, compressImage, downloadBlob, slugify, toast, debounce, add } from './dom.js';
import { state, touch } from '../core/store.js';
import { allFonts, fontStack, ensureFontsLoaded } from '../core/fonts.js';
import { uid } from '../core/model.js';
import { drawFront, drawWrap, drawGuides, wrapDims } from '../render/cover.js';
import { COVER_TEMPLATES, coverText as T } from '../core/cover-templates.js';

let selectedLayer = 'title';

export function renderCover(host) {
  const book = state.book;
  const c = () => book.cover;
  const split = h('div.split');
  const pane = h('aside.settings-pane', { 'aria-label': 'Cover settings' });
  const right = h('section.preview-pane');
  add(split, pane, right);
  host.appendChild(split);

  let view = 'front';
  let guides = true;
  const canvas = h('canvas', { 'aria-label': 'Cover preview' });
  const stage = h('div.cover-stage', canvas);
  const info = h('span.pv-pages');
  const bar = h('div.preview-bar',
    segmented([['front', 'Front cover (ebook)'], ['wrap', 'Full print wrap']], view, (v) => { view = v; draw(); }),
    h('label.row.small', h('input', { type: 'checkbox', checked: guides, on: { change: (e) => { guides = e.target.checked; draw(); } } }), 'Guides'),
    h('span.grow'), info,
    btn('Download ebook cover', { icon: 'download', cls: 'btn-sm', onClick: () => exportFront() }),
    btn('Print cover (PDF)', { icon: 'file-down', kind: 'primary', cls: 'btn-sm', onClick: () => exportWrapPdf() }),
  );
  add(right, bar, stage);

  let boxes = {};
  let scale = 1;
  function draw() {
    const cov = c();
    const ctx = canvas.getContext('2d');
    if (view === 'front') {
      const W = 800, H = Math.round(W * (cov.ebookSize.h / cov.ebookSize.w));
      canvas.width = W; canvas.height = H;
      boxes = drawFront(ctx, book, 0, 0, W, H, draw);
      scale = 1;
      if (guides && boxes[selectedLayer]) {
        const b = boxes[selectedLayer];
        ctx.save(); ctx.strokeStyle = 'rgba(91,79,214,.9)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8); ctx.restore();
      }
      info.textContent = `${cov.ebookSize.w} × ${cov.ebookSize.h} px · drag text to move it`;
      canvas.style.cursor = 'move';
    } else {
      const d = wrapDims(book);
      const dpi = Math.min(110, 1500 / d.totalW);
      canvas.width = Math.round(d.totalW * dpi); canvas.height = Math.round(d.totalH * dpi);
      drawWrap(ctx, book, dpi, draw);
      if (guides) drawGuides(ctx, d, dpi);
      info.textContent = `${d.totalW.toFixed(3)} × ${d.totalH.toFixed(3)} in · spine ${d.spine.toFixed(3)} in (${d.pages} pages, ${cov.paper} paper)`;
      canvas.style.cursor = 'default';
    }
  }

  // drag text layers on the front cover
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (view !== 'front') return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width), y = (e.clientY - r.top) * (canvas.height / r.height);
    const hit = Object.entries(boxes).reverse().find(([, b]) => x >= b.x - 8 && x <= b.x + b.w + 8 && y >= b.y - 8 && y <= b.y + b.h + 8);
    if (!hit) return;
    selectedLayer = hit[0];
    const layer = c().layers.find((l) => l.id === hit[0]);
    drag = { layer, sx: x, sy: y, lx: layer.x, ly: layer.y };
    canvas.setPointerCapture(e.pointerId);
    drawPane();
    draw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width), y = (e.clientY - r.top) * (canvas.height / r.height);
    drag.layer.x = Math.round(Math.max(0, Math.min(100, drag.lx + ((x - drag.sx) / canvas.width) * 100)) * 2) / 2;
    drag.layer.y = Math.round(Math.max(0, Math.min(100, drag.ly + ((y - drag.sy) / canvas.height) * 100)) * 2) / 2;
    draw();
  });
  canvas.addEventListener('pointerup', () => { if (drag) { drag = null; touch('cover'); drawPane(); } });

  const change = (redraw = false) => { touch('cover'); draw(); if (redraw) drawPane(); };
  const fonts = () => allFonts().map((n) => ({ value: n, label: n, style: `font-family:${fontStack(n)}` }));

  function acc(id, ic, title, content, open = false) {
    const sec = h(`div.acc${open ? '.open' : ''}`);
    const head = h('button.acc-head', { type: 'button', on: { click: () => sec.classList.toggle('open') } }, icon(ic, 17), title, icon('chevron-right', 16, 'chev'));
    add(sec, head, h('div.acc-body', content));
    return sec;
  }

  const opened = new Set(['templates', 'text']);
  function drawPane() {
    const scroll = pane.scrollTop;
    const openNow = new Set([...pane.querySelectorAll('.acc.open')].map((n) => n.dataset.id));
    if (openNow.size) { opened.clear(); openNow.forEach((x) => opened.add(x)); }
    clear(pane);
    const cov = c();
    const bg = cov.background;
    const layer = cov.layers.find((l) => l.id === selectedLayer) || cov.layers[0];
    const sections = [
      ['templates', 'layout-template', 'Templates', [
        h('div.cover-tpls', Object.entries(COVER_TEMPLATES).map(([id, t]) => {
          const cv = h('canvas', { width: 120, height: 180 });
          const tmp = { ...book, cover: JSON.parse(JSON.stringify(cov)) };
          t.apply(tmp.cover);
          tmp.cover.background.image = cov.background.type === 'image' ? '' : tmp.cover.background.image;
          const paint = () => drawFront(cv.getContext('2d'), tmp, 0, 0, 120, 180, paint);
          paint();
          return h(`button.cover-tpl${cov.template === id ? '.on' : ''}`, { type: 'button', title: t.label, on: { click: () => {
            const keepImg = cov.background.type === 'image' ? cov.background.image : '';
            const keepBlurb = cov.back.blurb, keepTagline = cov.layers.find((l) => l.id === 'tagline')?.text;
            t.apply(cov);
            cov.template = id;
            if (keepImg) Object.assign(cov.background, { type: 'image', image: keepImg, overlay: Math.max(0.2, cov.background.overlay) });
            cov.back.blurb = keepBlurb;
            if (keepTagline) { const tl = cov.layers.find((l) => l.id === 'tagline'); if (tl) tl.text = keepTagline; }
            ensureFontsLoaded(cov.layers.map((l) => l.font)).then(() => draw());
            change(true);
          } } }, cv);
        })),
        h('p.hint', { style: { marginTop: '10px' } }, 'Templates restyle the text and background; your uploaded artwork is kept.'),
      ]],
      ['background', 'image', 'Background & artwork', [
        field('Type', segmented([['solid', 'Colour'], ['gradient', 'Gradient'], ['image', 'Image']], bg.type, (v) => { bg.type = v; change(true); })),
        bg.type === 'image'
          ? h('div',
            bg.image ? h('img', { src: bg.image, style: { width: '100%', maxHeight: '140px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' } }) : null,
            btn(bg.image ? 'Replace image' : 'Upload artwork', { icon: 'upload', cls: 'btn-sm', onClick: async () => { const f = await pickFile('image/*'); if (f) { bg.image = await compressImage(f, 3200, 0.92); change(true); } } }),
            h('p.hint', 'Use artwork you own or have licensed. For print: at least 1800 × 2700 px (300 DPI at 6 × 9 in).'),
            field('Fit', segmented([['cover', 'Fill'], ['contain', 'Fit']], bg.imageFit || 'cover', (v) => { bg.imageFit = v; change(); })),
            field('Horizontal position', slider(bg.posX ?? 50, 0, 100, 1, (v) => { bg.posX = v; change(); }, (v) => `${v}%`)),
            field('Vertical position', slider(bg.posY ?? 50, 0, 100, 1, (v) => { bg.posY = v; change(); }, (v) => `${v}%`)))
          : null,
        h('div.row', { style: { marginBottom: '12px' } }, color(bg.color, (v) => { bg.color = v; change(); }), h('span.small', bg.type === 'gradient' ? 'From' : 'Colour'),
          bg.type === 'gradient' ? [color(bg.color2, (v) => { bg.color2 = v; change(); }), h('span.small', 'To')] : null),
        bg.type === 'gradient' ? field('Angle', slider(bg.angle, 0, 360, 5, (v) => { bg.angle = v; change(); }, (v) => `${v}°`)) : null,
        field('Darken / tint overlay', slider(bg.overlay, 0, 0.9, 0.05, (v) => { bg.overlay = v; change(); }, (v) => `${Math.round(v * 100)}%`)),
        h('div.row', color(bg.overlayColor || '#000000', (v) => { bg.overlayColor = v; change(); }), h('span.small', 'Overlay colour')),
      ]],
      ['text', 'type', 'Text', [
        ...cov.layers.map((l) => h(`div.layer-row${l.id === layer?.id ? '.on' : ''}`, { on: { click: () => { selectedLayer = l.id; drawPane(); draw(); } } },
          icon(l.kind === 'image' ? 'image' : 'type', 15), h('span', l.kind === 'image' ? 'Image' : (l.text || `(${l.id})`)),
          iconBtn(l.visible === false ? 'eye-off' : 'eye', 'Show / hide', (e) => { e.stopPropagation(); l.visible = l.visible === false; change(true); }, { size: 15 }),
          !['title', 'subtitle', 'author', 'tagline'].includes(l.id) ? iconBtn('trash', 'Delete layer', (e) => { e.stopPropagation(); cov.layers = cov.layers.filter((x) => x !== l); change(true); }, { size: 15 }) : null)),
        h('div.row', { style: { gap: '6px', margin: '4px 0 14px' } },
          btn('Text', { icon: 'plus', cls: 'btn-sm', onClick: () => { const n = T(uid('tx_'), 'New text', { y: 70 }); cov.layers.push(n); selectedLayer = n.id; change(true); } }),
          btn('Image / logo', { icon: 'image-plus', cls: 'btn-sm', onClick: async () => { const f = await pickFile('image/*'); if (!f) return; const n = { id: uid('im_'), kind: 'image', src: await compressImage(f, 1600), x: 50, y: 70, width: 40, visible: true }; cov.layers.push(n); selectedLayer = n.id; change(true); } })),
        layer && layer.kind === 'text' ? h('div.card', { style: { padding: '12px' } },
          field('Text', textarea(layer.text, (v) => { layer.text = v; change(); }, { rows: 2 }), 'Use {{title}}, {{subtitle}}, {{author}}, {{series}} to pull from Book details.'),
          field('Font', select(fonts(), layer.font, (v) => { layer.font = v; ensureFontsLoaded([v]).then(draw); change(); })),
          h('div.grid-2', field('Size', slider(layer.size, 1, 25, 0.1, (v) => { layer.size = v; change(); }, (v) => v.toFixed(1))), field('Line height', slider(layer.lineHeight || 1.15, 0.8, 2, 0.05, (v) => { layer.lineHeight = v; change(); }, (v) => v.toFixed(2)))),
          h('div.row', { style: { gap: '12px', flexWrap: 'wrap', marginBottom: '12px' } },
            color(layer.color, (v) => { layer.color = v; change(); }),
            segmented([['left', 'L'], ['center', 'C'], ['right', 'R']], layer.align, (v) => { layer.align = v; change(); }),
            toggle(layer.weight >= 700, (v) => { layer.weight = v ? 700 : 400; change(); }, 'Bold'),
            toggle(layer.italic, (v) => { layer.italic = v; change(); }, 'Italic')),
          h('div.row', { style: { gap: '12px', flexWrap: 'wrap', marginBottom: '12px' } },
            toggle(layer.upper, (v) => { layer.upper = v; change(); }, 'Caps'),
            toggle(layer.shadow, (v) => { layer.shadow = v; change(); }, 'Shadow'),
            toggle(layer.outline, (v) => { layer.outline = v; change(); }, 'Outline')),
          field('Letter spacing', slider(layer.spacing || 0, 0, 0.6, 0.01, (v) => { layer.spacing = v; change(); }, (v) => v.toFixed(2))),
          field('Text box width', slider(layer.width, 20, 100, 1, (v) => { layer.width = v; change(); }, (v) => `${v}%`)),
          h('div.grid-2', field('X', slider(layer.x, 0, 100, 0.5, (v) => { layer.x = v; change(); }, (v) => `${v}%`)), field('Y', slider(layer.y, 0, 100, 0.5, (v) => { layer.y = v; change(); }, (v) => `${v}%`)))) : null,
        layer && layer.kind === 'image' ? h('div.card', { style: { padding: '12px' } },
          field('Width', slider(layer.width, 5, 100, 1, (v) => { layer.width = v; change(); }, (v) => `${v}%`)),
          h('div.grid-2', field('X', slider(layer.x, 0, 100, 0.5, (v) => { layer.x = v; change(); }, (v) => `${v}%`)), field('Y', slider(layer.y, 0, 100, 0.5, (v) => { layer.y = v; change(); }, (v) => `${v}%`)))) : null,
      ]],
      ['ornament', 'sparkles', 'Ornament', [
        h('div.col', { style: { gap: '10px', marginBottom: '12px' } }, toggle(cov.ornament.show, (v) => { cov.ornament.show = v; change(); }, 'Show ornament')),
        field('Style', select([['line', 'Line'], ['diamond', 'Line with diamond'], ['dots', 'Dots'], ['frame', 'Double frame'], ['band', 'Colour band']], cov.ornament.style, (v) => { cov.ornament.style = v; change(); })),
        h('div.row', { style: { marginBottom: '12px' } }, color(cov.ornament.color, (v) => { cov.ornament.color = v; change(); }), h('span.small', 'Colour')),
        field('Vertical position', slider(cov.ornament.y, 0, 100, 0.5, (v) => { cov.ornament.y = v; change(); }, (v) => `${v}%`)),
      ]],
      ['back', 'book', 'Back cover & spine (print)', [
        field('Back cover blurb', textarea(cov.back.blurb, (v) => { cov.back.blurb = v; change(); }, { rows: 6, placeholder: book.meta.description || 'The text on the back of your book…' }), 'Leave empty to use the description from Book details.'),
        h('div.grid-2', field('Blurb font', select(fonts(), cov.back.font, (v) => { cov.back.font = v; change(); })), field('Size (pt)', input(cov.back.size, (v) => { if (v) { cov.back.size = v; change(); } }, { type: 'number', min: 7, max: 20 }))),
        h('div.row', { style: { gap: '12px', marginBottom: '12px', flexWrap: 'wrap' } },
          h('span.row', color(cov.back.color || cov.background.color, (v) => { cov.back.color = v; change(); }), h('span.small', 'Back colour')),
          h('span.row', color(cov.back.textColor, (v) => { cov.back.textColor = v; change(); }), h('span.small', 'Text'))),
        h('div.col', { style: { gap: '10px', marginBottom: '12px' } }, toggle(cov.back.showBarcodeBox, (v) => { cov.back.showBarcodeBox = v; change(); }, 'Reserve barcode area (2 × 1.2 in)')),
        field('Price (optional)', input(cov.back.price, (v) => { cov.back.price = v; change(); }, { placeholder: '$16.99' })),
        h('div.section-title', 'Spine'),
        h('div.col', { style: { gap: '10px', marginBottom: '12px' } }, toggle(cov.spine.show, (v) => { cov.spine.show = v; change(); }, 'Spine text (needs 80+ pages)')),
        h('div.grid-2', field('Spine font', select(fonts(), cov.spine.font, (v) => { cov.spine.font = v; change(); })), h('div.row', { style: { paddingTop: '20px' } }, color(cov.spine.color, (v) => { cov.spine.color = v; change(); }), h('span.small', 'Text'))),
        field('Spine background', h('div.row', color(cov.spine.color2 || cov.back.color || cov.background.color, (v) => { cov.spine.color2 = v; change(); }), btn('Match back', { cls: 'btn-sm', kind: 'ghost', onClick: () => { cov.spine.color2 = ''; change(true); } }))),
        h('div.section-title', 'Spine width calculator'),
        field('Paper', segmented([['white', 'White'], ['cream', 'Cream'], ['color', 'Colour']], cov.paper, (v) => { cov.paper = v; change(); })),
        field('Page count', input(cov.pageCountOverride || '', (v) => { cov.pageCountOverride = +v || 0; change(); }, { type: 'number', placeholder: `Auto: ${wrapDims(book).pages}` }), 'Auto uses the page count from the last full print preview (Format tab), or an estimate.'),
      ]],
      ['export', 'download', 'Export sizes', [
        field('Ebook cover size', select([['1600x2560', '1600 × 2560 (Kindle recommended)'], ['1563x2500', '1563 × 2500'], ['2048x3072', '2048 × 3072 (high-res)'], ['1400x2100', '1400 × 2100 (2:3)'], ['3000x3000', '3000 × 3000 (audiobook square)']], `${cov.ebookSize.w}x${cov.ebookSize.h}`, (v) => { const [w, hh] = v.split('x').map(Number); cov.ebookSize = { w, h: hh }; change(); })),
        btn('Download print wrap as PNG (300 DPI)', { icon: 'download', cls: 'btn-sm', onClick: () => exportWrapPng() }),
      ]],
    ];
    sections.forEach(([id, ic, title, content]) => { const s = acc(id, ic, title, content, opened.has(id)); s.dataset.id = id; pane.appendChild(s); });
    pane.scrollTop = scroll;
  }

  async function exportFront() {
    const cov = c();
    await ensureFontsLoaded(cov.layers.map((l) => l.font));
    const cv = document.createElement('canvas');
    cv.width = cov.ebookSize.w; cv.height = cov.ebookSize.h;
    drawFront(cv.getContext('2d'), book, 0, 0, cv.width, cv.height);
    cv.toBlob((b) => downloadBlob(b, `${slugify(book.meta.title)}-cover.jpg`), 'image/jpeg', 0.93);
    toast('Ebook cover downloaded', 'success');
  }

  async function wrapCanvas(dpi = 300) {
    const cov = c();
    await ensureFontsLoaded([...cov.layers.map((l) => l.font), cov.back.font, cov.spine.font]);
    const d = wrapDims(book);
    const cv = document.createElement('canvas');
    cv.width = Math.round(d.totalW * dpi); cv.height = Math.round(d.totalH * dpi);
    drawWrap(cv.getContext('2d'), book, dpi);
    return { cv, d };
  }

  async function exportWrapPng() {
    toast('Rendering print cover…');
    const { cv } = await wrapCanvas(300);
    cv.toBlob((b) => downloadBlob(b, `${slugify(book.meta.title)}-print-cover.png`), 'image/png');
  }

  async function exportWrapPdf() {
    toast('Preparing print cover PDF…');
    const { cv, d } = await wrapCanvas(300);
    const { pdfFromCanvas } = await import('../export/pdf.js');
    downloadBlob(await pdfFromCanvas(cv, d.totalW, d.totalH, { title: `${book.meta.title} — cover` }), `${slugify(book.meta.title)}-print-cover.pdf`);
    toast('Print cover PDF downloaded', 'success');
  }

  drawPane();
  ensureFontsLoaded([...c().layers.map((l) => l.font), c().spine.font, c().back.font]).then(draw);
  draw();
  const onResize = debounce(draw, 200);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}
