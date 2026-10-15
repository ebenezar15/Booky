// "Publish to a platform": checks the book against a store's requirements and builds a
// ready-to-upload ZIP (EPUB + cover for ebook stores; interior PDF + cover PDF for printers).
import JSZip from 'jszip';
import { h, icon, btn, clear, add, modal, toast, downloadBlob, slugify, select, field, celebrate, pickFile } from './dom.js';
import { touch, setMode, state } from '../core/store.js';
import { PLATFORMS, checkPlatform, gutterFor, isbnKey } from '../core/platforms.js';
import { parseIsbn } from '../core/isbn.js';
import { keywordReport, contributorList, KDP_KEYWORD_LIMIT, KEYWORD_MAX_CHARS } from '../core/metadata.js';
import { trimOf } from '../core/themes.js';
import { createElement, bookWords } from '../core/model.js';
import { estimatePages, drawFront, drawWrap, wrapDims, preloadCover } from '../render/cover.js';
import { ensureFontsLoaded } from '../core/fonts.js';
import { PrintPreview } from '../render/preview.js';
import { PDF_QUALITY } from '../export/pdf.js';
import { canVectorPdf, isComplexScript, finishAndCheckInterior, vectorInterior, finishCoverPdf } from '../export/print-pdf.js';
import { langInfo } from '../core/languages.js';
import { inspectPdf } from '../export/pdf-check.js';
import { collectImages, imageFindings, measureImages } from '../core/image-check.js';
import { goToImage } from './feedback-actions.js';

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

export function metadataSheet(book, p, extra = {}) {
  const m = book.meta;
  const t = trimOf(book.format);
  const isbn = (k) => { const r = parseIsbn(m[k]); return r.empty ? '(not set)' : r.ok ? r.formatted : `${m[k]}  ⚠ ${r.message}`; };
  const kw = keywordReport(m.keywords);
  const bisac = String(m.bisac || '').split(/[,;\s]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
  const age = m.ageMin || m.ageMax ? `${m.ageMin || '?'}–${m.ageMax || '?'} years` : '';
  const pad = (label) => `${label}:`.padEnd(17);
  const lines = [
    `${p.name} — upload details for “${m.title}”`, ''.padEnd(60, '='), '',
    `${pad('Title')}${m.title}`, m.subtitle ? `${pad('Subtitle')}${m.subtitle}` : '',
    m.series ? `${pad('Series')}${m.series}${m.seriesNumber ? `, book ${m.seriesNumber}` : ''}` : '',
    `${pad('Edition')}${m.edition || ''}`,
    'Contributors:', ...contributorList(m).map(([role, name]) => `  • ${name} (${role})`),
    `${pad('Language')}${m.language}`, `${pad('Publisher')}${m.publisher || '(self-published)'}`,
    `${pad('ISBN paperback')}${isbn('isbnPrint')}`, m.isbnHardcover ? `${pad('ISBN hardcover')}${isbn('isbnHardcover')}` : '', `${pad('ISBN ebook')}${isbn('isbnEbook')}`,
    `${pad('BISAC codes')}${bisac.length ? bisac.join(', ') : '(add up to 3 in Book details → Marketing)'}${bisac.length > 3 ? '  ⚠ most platforms take 3 at most' : ''}`,
    `${pad('Categories')}${m.categories || ''}`,
    age ? `${pad('Reading age')}${age}` : '',
    `Keywords (${kw.list.length}${p.id.startsWith('kdp') || p.id === 'kindle' ? ` — KDP allows ${KDP_KEYWORD_LIMIT}` : ''}):`,
    ...kw.list.map((k, i) => `  ${i + 1}. ${k}${k.length > KEYWORD_MAX_CHARS ? `  ⚠ ${k.length} characters (50 max on KDP)` : ''}${(p.id.startsWith('kdp') || p.id === 'kindle') && i >= KDP_KEYWORD_LIMIT ? '  ⚠ over KDP’s limit' : ''}`),
    `${pad('Word count')}${bookWords(book).toLocaleString()}`,
    p.kind === 'print' ? `${pad('Trim size')}${t.w} × ${t.h} in` : '',
    extra.pages ? `${pad('Page count')}${extra.pages}` : '', extra.interior ? `${pad('Interior')}${extra.interior}` : '',
    extra.spine ? `${pad('Spine width')}${extra.spine.toFixed(3)} in (${book.cover.paper} paper)` : '',
    extra.cover ? `${pad('Cover size')}${extra.cover}` : '', '', 'Description:', m.description || '(add a description in Book details → Marketing)', '',
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
  // Image checks for this kind of platform (resolution, colour and bleed for print; alt text for ebooks).
  let imgChecks = [];
  (async () => {
    const images = collectImages(book);
    if (!images.length) return;
    const found = imageFindings(book, images, await measureImages(images), { print: p.kind === 'print', ebook: p.kind === 'ebook' });
    imgChecks = found.map((f) => ({ ok: f.level === 'bad' ? false : 'warn', text: f.text, image: f }));
    if (!imgChecks.length) imgChecks = [{ ok: true, text: p.kind === 'print' ? `All ${images.length} images are at least 300 ppi at their printed size` : `All ${images.length} images have alt text` }];
    draw();
  })();
  // Where the interior PDF comes from: the desktop app makes a vector PDF itself; in the
  // browser the author saves one from the print dialog and drops it in; the image-based
  // PDF stays available as a proof / fallback.
  let interiorMode = canVectorPdf() ? 'vector' : 'dropped';
  let dropped = null; // { name, bytes, notes, checks }
  const checkList = (checks) => h('div.pl-checks', checks.map((c) => h(`div.check-item.${c.ok === true ? 'ok' : c.ok === 'warn' ? 'warn' : 'bad'}`,
    icon(c.ok === true ? 'circle-check' : 'triangle-alert', 17), h('div', h('b', c.text)))));

  async function takePdf(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { toast('Please choose a PDF file', 'warn'); return; }
    toast('Checking the PDF…', 'info', 1500);
    try {
      dropped = { name: file.name, ...(await finishAndCheckInterior(file, book, p)) };
    } catch (e) { console.error(e); toast(`Could not read this PDF: ${e.message}`, 'error', 6000); dropped = null; }
    draw();
  }

  const interiorSection = () => {
    if (p.kind !== 'print') return null;
    const complex = isComplexScript(book.meta.language);
    const opt = (id, title, desc) => h(`label.pdf-choice${interiorMode === id ? '.on' : ''}`,
      h('input', { type: 'radio', name: 'interior', checked: interiorMode === id, on: { change: () => { interiorMode = id; draw(); } } }),
      h('div', h('b', title), h('div.small.muted', desc)));
    const choices = [
      canVectorPdf() ? opt('vector', 'Vector PDF (recommended)', 'Sharp, real text with embedded fonts, made by the Booky app. The best file for printers.') : null,
      canVectorPdf() ? null : opt('dropped', 'Vector PDF from the print dialog (recommended)', 'Real text with embedded fonts. Save it with your browser’s print dialog, then add it here — Booky checks it and puts it in the package.'),
      opt('raster', 'Image-based PDF (proof / fallback)', 'Each page is a picture. Larger files and softer text — fine for proofs.'),
    ];
    let detail = null;
    if (interiorMode === 'dropped') {
      const zone = h('div.dropzone.pdf-drop', { tabindex: '0', on: {
        click: async () => takePdf(await pickFile('.pdf,application/pdf')),
        dragover: (e) => { e.preventDefault(); zone.classList.add('over'); },
        dragleave: () => zone.classList.remove('over'),
        drop: (e) => { e.preventDefault(); zone.classList.remove('over'); takePdf(e.dataTransfer.files[0]); },
      } }, icon('file-up', 22), h('b', dropped ? `✓ ${dropped.name} — drop another to replace` : 'Drop the saved PDF here, or click to choose it'));
      detail = h('div.col', { style: { gap: '8px' } },
        h('ol.small', { style: { margin: 0, paddingLeft: '18px', lineHeight: 1.7 } },
          h('li', btn('Open print dialog', { icon: 'printer', cls: 'btn-sm', onClick: () => pv.print() })),
          h('li', 'Destination: ', h('b', 'Save as PDF'), ' · Margins: ', h('b', 'Default'), ' (or None) · Scale: ', h('b', '100%'), ' · tick ', h('b', 'Background graphics'), '.'),
          h('li', 'Save, then drop the PDF below.')),
        zone,
        dropped ? h('div', h('div.section-title', 'Interior PDF check'), checkList(dropped.checks), dropped.notes.length ? h('p.small.muted', dropped.notes.join(' ')) : null) : h('p.small.muted', 'No PDF yet — the package will still contain the cover, metadata and these instructions.'));
    }
    if (interiorMode === 'raster') {
      detail = h('div.col', { style: { gap: '8px' } },
        complex ? h('div.notice.notice-error', icon('triangle-alert', 16), h('span', h('b', `${langInfo(book.meta.language).name} text may render incorrectly in an image-based PDF. `), 'Letters that join or change shape (conjuncts, vowel signs, ligatures) can come out broken or misplaced. Use the vector PDF for anything you will print or upload.')) : null,
        field('Image quality', select(Object.entries(PDF_QUALITY).map(([k, v]) => [k, v.label]), quality, (v) => { quality = v; })));
    }
    return h('div', h('div.section-title', { style: { marginTop: '14px' } }, 'Interior PDF'), h('div.col', { style: { gap: '6px' } }, choices), detail);
  };

  const draw = () => {
    clear(body);
    const checks = [...checkPlatform(p, book, pages), ...imgChecks];
    const fixes = {
      gutter: () => { book.format.margins.inside = Math.max(book.format.margins.inside, gutterFor(pages) + 0.125); },
      margins: () => { const mg = book.format.margins; mg.outside = Math.max(mg.outside, 0.5); mg.top = Math.max(mg.top, 0.5); mg.bottom = Math.max(mg.bottom, 0.5); },
      toc: () => { const i = book.elements.findIndex((e) => e.section !== 'front'); book.elements.splice(Math.max(0, i), 0, createElement('toc')); },
    };
    const status = h('p.small.muted');
    const progress = h('div.progress.hidden', h('div', { style: { width: '0%' } }));
    const results = h('div');
    const blocking = checks.some((c) => c.ok === false);
    const build = btn(p.kind === 'print' ? 'Build print package (.zip)' : 'Build ebook package (.zip)', { kind: 'primary', icon: 'package', onClick: async () => {
      if (!(await (await import('./writing-tools.js')).confirmNoPlaceholders(book))) return;
      build.disabled = true;
      progress.classList.remove('hidden');
      clear(results);
      try {
        const res = await buildPackage(book, p, { pv, pages, quality, interiorMode, dropped, onProgress: (pct, msg) => { progress.firstChild.style.width = `${pct}%`; status.textContent = msg; } });
        status.textContent = 'Package downloaded. Unzip it and upload the files to the platform.';
        if (res?.checks) add(results, h('div.section-title', 'Interior PDF check'), checkList(res.checks), res.notes?.length ? h('p.small.muted', res.notes.join(' ')) : null);
      } catch (e) { console.error(e); status.textContent = `Could not build the package: ${e.message}`; }
      build.disabled = false;
    } });
    add(body,
      h('div.pl-checks', checks.map((c) => h(`div.check-item.${c.ok === true ? 'ok' : c.ok === 'warn' ? 'warn' : 'bad'}`,
        icon(c.ok === true ? 'circle-check' : 'triangle-alert', 17), h('div', h('b', c.text)),
        c.image ? btn(c.image.kind === 'alt' ? 'Add alt text' : 'Show', { cls: 'btn-sm', onClick: () => { m.close(); goToImage(c.image.elId, c.image.index, { editAlt: c.image.kind === 'alt' }); } }) : null,
        c.ok !== true && fixes[c.fix] ? btn('Fix', { cls: 'btn-sm', onClick: () => { fixes[c.fix](); touch('format'); touch('elements'); toast('Fixed', 'success'); if (pv && c.fix !== 'toc') { pv.render(book).then((r) => { pages = r.pages + (r.pages % 2); draw(); }); } else draw(); } }) : null))),
      interiorSection(),
      h('div.section-title', { style: { marginTop: '14px' } }, 'The package contains'),
      h('ul.small', { style: { margin: '0 0 10px', paddingLeft: '18px', lineHeight: 1.7 } }, p.files.map((f) => h('li', f)), h('li', 'metadata.txt — title, description, keywords and specs to copy into the upload form')),
      h('div.section-title', 'Platform notes'),
      h('ul.small.muted', { style: { margin: '0 0 12px', paddingLeft: '18px', lineHeight: 1.6 } }, p.notes.map((n) => h('li', n))),
      blocking ? h('p.small', { style: { color: 'var(--danger)' } }, 'Some requirements are not met yet — you can still build the package, but the platform may reject it.') : null,
      h('div.row', { style: { flexWrap: 'wrap' } }, build, p.kind === 'print' ? btn('Adjust design', { kind: 'ghost', onClick: () => { m.close(); setMode('format'); } }) : null),
      progress, status, results);
  };
  draw();
}

async function buildPackage(book, p, { pv, pages, quality, interiorMode = 'raster', dropped = null, onProgress }) {
  const zip = new JSZip();
  const result = {};
  const base = slugify(book.meta.title);
  const extra = { pages: p.kind === 'print' ? pages : 0 };
  await ensureFontsLoaded([...book.cover.layers.map((l) => l.font), book.cover.spine.font, book.cover.back.font]);
  if (p.kind === 'ebook') {
    onProgress(10, 'Building EPUB…');
    const { buildEpub } = await import('../export/epub.js');
    const { pageListIfWanted } = await import('../export/page-map.js');
    onProgress(5, 'Matching print page numbers…');
    zip.file(`${base}.epub`, await buildEpub(book, { pageList: await pageListIfWanted(book) }));
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
    let interior = null;
    if (interiorMode === 'vector') {
      onProgress(10, 'Typesetting the vector interior…');
      interior = await finishAndCheckInterior(await vectorInterior(book), book, p);
    } else if (interiorMode === 'raster') {
      const blob = await pdfFromPreview(pv, { quality, title: book.meta.title, author: book.meta.author, onProgress: (d, n) => onProgress(Math.round((d / n) * 70), `Rendering interior page ${d} of ${n}…`) });
      onProgress(72, 'Checking the interior…');
      interior = await finishAndCheckInterior(blob, book, p);
    } else if (dropped) {
      interior = dropped;
    }
    if (interior) {
      zip.file(`${base}-interior.pdf`, interior.bytes);
      extra.pages = (await inspectPdf(interior.bytes)).pages.length;
      extra.interior = interiorMode === 'raster' ? 'image-based PDF (proof / fallback)' : 'vector PDF, fonts embedded';
    } else {
      zip.file('HOW-TO-ADD-THE-INTERIOR.txt', [
        'This package has the cover and the upload details. Add the interior PDF like this:', '',
        '1. In Booky, open Publish → this platform → Interior PDF → “Open print dialog”.',
        '2. Destination: Save as PDF · Margins: Default (or None) · Scale: 100% · tick Background graphics.',
        '3. Drop the saved PDF into the same dialog — Booky checks page size, page count and fonts,',
        '   fixes the page boxes and adds it to a new package.',
      ].join('\n'));
    }
    onProgress(85, 'Rendering cover…');
    await preloadCover(book);
    const opts = { paper: p.paper, wrap: p.wrap || 0, isbn: book.meta[isbnKey(p, book.meta)] };
    const d = wrapDims(book, opts);
    const dpi = 300;
    const cv = document.createElement('canvas');
    cv.width = Math.round(d.totalW * dpi); cv.height = Math.round(d.totalH * dpi);
    drawWrap(cv.getContext('2d'), book, dpi, undefined, opts);
    const coverPdf = await pdfFromCanvas(cv, d.totalW, d.totalH, { title: `${book.meta.title} — cover` });
    zip.file(`${base}-cover.pdf`, await finishCoverPdf(coverPdf, book, d.bleed));
    extra.spine = d.spine;
    extra.cover = `${d.totalW.toFixed(3)} × ${d.totalH.toFixed(3)} in including ${d.bleed} in bleed`;
    result.checks = interior?.checks;
    result.notes = interior?.notes;
  }
  zip.file('metadata.txt', metadataSheet(book, p, extra));
  onProgress(95, 'Zipping…');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  downloadBlob(blob, `${base}-${p.id}.zip`);
  onProgress(100, 'Done');
  toast(`${p.name} package ready`, 'success'); celebrate();
  return result;
}

