// "Publish to a platform": checks the book against a store's requirements and builds a
// ready-to-upload ZIP (EPUB + cover for ebook stores; interior PDF + cover PDF for printers).
import JSZip from 'jszip';
import { h, icon, btn, clear, add, modal, toast, downloadBlob, slugify, select, field } from './dom.js';
import { touch, setMode, state } from '../core/store.js';
import { PLATFORMS, checkPlatform, gutterFor } from '../core/platforms.js';
import { trimOf } from '../core/themes.js';
import { createElement, bookWords } from '../core/model.js';
import { estimatePages, drawFront, drawWrap, wrapDims } from '../render/cover.js';
import { ensureFontsLoaded } from '../core/fonts.js';
import { PrintPreview } from '../render/preview.js';
import { PDF_QUALITY } from '../export/pdf.js';

export function platformGrid(book) {
  const card = (p) => h('button.platform', { type: 'button', on: { click: () => platformDialog(book, p) } },
    h('span.pl-ic', { style: { background: p.color } }, icon(p.icon, 18)),
    h('span.pl-txt', h('b', p.name), h('small', p.files.join(' · '))));
  return h('div',
    h('div.section-title', icon('tablet', 14), 'Ebook stores'),
    h('div.platform-grid', PLATFORMS.filter((p) => p.kind === 'ebook').map(card)),
    h('div.section-title', { style: { marginTop: '18px' } }, icon('book', 14), 'Print-on-demand'),
    h('div.platform-grid', PLATFORMS.filter((p) => p.kind === 'print').map(card)));
}

function metadataSheet(book, p, extra = {}) {
  const m = book.meta;
  const t = trimOf(book.format);
  const lines = [
    `${p.name} — upload details for “${m.title}”`, ''.padEnd(60, '='), '',
    `Title:        ${m.title}`, m.subtitle ? `Subtitle:     ${m.subtitle}` : '', m.series ? `Series:       ${m.series}${m.seriesNumber ? ' #' + m.seriesNumber : ''}` : '',
    `Author:       ${m.author}`, m.editor ? `Editor:       ${m.editor}` : '', m.illustrator ? `Illustrator:  ${m.illustrator}` : '',
    `Language:     ${m.language}`, `Publisher:    ${m.publisher || '(self-published)'}`, `Edition:      ${m.edition}`,
    p.kind === 'print' ? `ISBN (print): ${m.isbnPrint || '(not set)'}` : `ISBN (ebook): ${m.isbnEbook || '(not required on most stores)'}`,
    `Keywords:     ${m.keywords || ''}`, `Categories:   ${m.categories || ''}`, `Word count:   ${bookWords(book).toLocaleString()}`,
    p.kind === 'print' ? `Trim size:    ${t.w} × ${t.h} in` : '',
    extra.pages ? `Page count:   ${extra.pages}` : '', extra.spine ? `Spine width:  ${extra.spine.toFixed(3)} in (${book.cover.paper} paper)` : '',
    extra.cover ? `Cover size:   ${extra.cover}` : '', '', 'Description:', m.description || '(add a description in Book details → Marketing)', '',
    'Files in this package:', ...p.files.map((f) => `  • ${f}`), '', 'Platform notes:', ...p.notes.map((n) => `  • ${n}`), '',
    'Prepared with Booky.',
  ];
  return lines.filter((l) => l !== '').join('\n').replace(/\nDescription:/, '\n\nDescription:');
}

export async function platformDialog(book, p) {
  const body = h('div');
  const m = modal({ title: p.name, width: 640, body, onClose: () => hostEl?.remove() });
  let hostEl = null, pv = null, pages = estimatePages(book);
  if (p.kind === 'print') {
    add(body, h('div', { style: { textAlign: 'center', padding: '16px' } }, h('div.spinner-lg'), h('p', 'Typesetting to measure the exact page count…')));
    hostEl = h('div', { style: { position: 'fixed', left: '-10000px', top: 0, width: '1200px', height: '900px', overflow: 'hidden' } });
    document.body.appendChild(hostEl);
    pv = new PrintPreview(hostEl);
    pv.spread = false;
    const r = await pv.render(book);
    pages = r.pages + (r.pages % 2);
    book.cover.lastPageCount = pages;
  }
  let quality = 'print';
  const draw = () => {
    clear(body);
    const checks = checkPlatform(p, book, pages);
    const fixes = {
      gutter: () => { book.format.margins.inside = Math.max(book.format.margins.inside, gutterFor(pages) + 0.125); },
      margins: () => { const mg = book.format.margins; mg.outside = Math.max(mg.outside, 0.5); mg.top = Math.max(mg.top, 0.5); mg.bottom = Math.max(mg.bottom, 0.5); },
      toc: () => { const i = book.elements.findIndex((e) => e.section !== 'front'); book.elements.splice(Math.max(0, i), 0, createElement('toc')); },
    };
    const status = h('p.small.muted');
    const progress = h('div.progress.hidden', h('div', { style: { width: '0%' } }));
    const blocking = checks.some((c) => c.ok === false);
    const build = btn(p.kind === 'print' ? 'Build print package (.zip)' : 'Build ebook package (.zip)', { kind: 'primary', icon: 'package', onClick: async () => {
      build.disabled = true;
      progress.classList.remove('hidden');
      try {
        await buildPackage(book, p, { pv, pages, quality, onProgress: (pct, msg) => { progress.firstChild.style.width = `${pct}%`; status.textContent = msg; } });
        status.textContent = 'Package downloaded. Unzip it and upload the files to the platform.';
      } catch (e) { console.error(e); status.textContent = `Could not build the package: ${e.message}`; }
      build.disabled = false;
    } });
    add(body,
      h('div.pl-checks', checks.map((c) => h(`div.check-item.${c.ok === true ? 'ok' : c.ok === 'warn' ? 'warn' : 'bad'}`,
        icon(c.ok === true ? 'circle-check' : 'triangle-alert', 17), h('div', h('b', c.text)),
        c.ok !== true && fixes[c.fix] ? btn('Fix', { cls: 'btn-sm', onClick: () => { fixes[c.fix](); touch('format'); touch('elements'); toast('Fixed', 'success'); if (pv && c.fix !== 'toc') { pv.render(book).then((r) => { pages = r.pages + (r.pages % 2); draw(); }); } else draw(); } }) : null))),
      h('div.section-title', { style: { marginTop: '14px' } }, 'The package contains'),
      h('ul.small', { style: { margin: '0 0 10px', paddingLeft: '18px', lineHeight: 1.7 } }, p.files.map((f) => h('li', f)), h('li', 'metadata.txt — title, description, keywords and specs to copy into the upload form')),
      p.kind === 'print' ? field('Interior PDF quality', select(Object.entries(PDF_QUALITY).map(([k, v]) => [k, v.label]), quality, (v) => { quality = v; })) : null,
      h('div.section-title', 'Platform notes'),
      h('ul.small.muted', { style: { margin: '0 0 12px', paddingLeft: '18px', lineHeight: 1.6 } }, p.notes.map((n) => h('li', n))),
      blocking ? h('p.small', { style: { color: 'var(--danger)' } }, 'Some requirements are not met yet — you can still build the package, but the platform may reject it.') : null,
      h('div.row', { style: { flexWrap: 'wrap' } }, build, p.kind === 'print' ? btn('Adjust design', { kind: 'ghost', onClick: () => { m.close(); setMode('format'); } }) : null),
      progress, status);
  };
  draw();
}

async function buildPackage(book, p, { pv, pages, quality, onProgress }) {
  const zip = new JSZip();
  const base = slugify(book.meta.title);
  const extra = { pages: p.kind === 'print' ? pages : 0 };
  await ensureFontsLoaded([...book.cover.layers.map((l) => l.font), book.cover.spine.font, book.cover.back.font]);
  if (p.kind === 'ebook') {
    onProgress(10, 'Building EPUB…');
    const { buildEpub } = await import('../export/epub.js');
    zip.file(`${base}.epub`, await buildEpub(book));
    onProgress(55, 'Rendering cover…');
    const cv = document.createElement('canvas');
    cv.width = p.cover.w; cv.height = p.cover.h;
    drawFront(cv.getContext('2d'), book, 0, 0, cv.width, cv.height);
    zip.file(`${base}-cover-${p.cover.w}x${p.cover.h}.jpg`, await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.93)));
    extra.cover = `${p.cover.w} × ${p.cover.h} px`;
    if (p.docx) {
      onProgress(75, 'Building DOCX…');
      const { buildDocx } = await import('../export/docx.js');
      zip.file(`${base}.docx`, await buildDocx(book));
    }
  } else {
    const { pdfFromPreview, pdfFromCanvas } = await import('../export/pdf.js');
    const interior = await pdfFromPreview(pv, { quality, title: book.meta.title, author: book.meta.author, onProgress: (d, n) => onProgress(Math.round((d / n) * 80), `Rendering interior page ${d} of ${n}…`) });
    zip.file(`${base}-interior.pdf`, interior);
    onProgress(85, 'Rendering cover…');
    const opts = { paper: p.paper, wrap: p.wrap || 0 };
    const d = wrapDims(book, opts);
    const dpi = 300;
    const cv = document.createElement('canvas');
    cv.width = Math.round(d.totalW * dpi); cv.height = Math.round(d.totalH * dpi);
    drawWrap(cv.getContext('2d'), book, dpi, undefined, opts);
    zip.file(`${base}-cover.pdf`, await pdfFromCanvas(cv, d.totalW, d.totalH, { title: `${book.meta.title} — cover` }));
    extra.spine = d.spine;
    extra.cover = `${d.totalW.toFixed(3)} × ${d.totalH.toFixed(3)} in including ${d.bleed} in bleed`;
  }
  zip.file('metadata.txt', metadataSheet(book, p, extra));
  onProgress(95, 'Zipping…');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  downloadBlob(blob, `${base}-${p.id}.zip`);
  onProgress(100, 'Done');
  toast(`${p.name} package ready`, 'success');
}

