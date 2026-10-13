// "Export PDF" dialog: typesets the book off-screen, then either downloads a PDF file
// directly or opens the print dialog for a vector PDF.
import { h, btn, clear, modal, toast, downloadBlob, slugify, select, field, add, celebrate } from './dom.js';
import { trimOf } from '../core/themes.js';
import { PrintPreview } from '../render/preview.js';
import { pdfFromPreview, PDF_QUALITY } from '../export/pdf.js';
import { finishAndCheckInterior, vectorInterior, isComplexScript } from '../export/print-pdf.js';
import { langInfo } from '../core/languages.js';
import { icon } from './dom.js';

export async function exportPdfDialog(book, { onlyId = null, quality = 'print' } = {}) {
  const hostEl = h('div', { style: { position: 'fixed', left: '-10000px', top: 0, width: '1200px', height: '900px', overflow: 'hidden' } });
  document.body.appendChild(hostEl);
  const body = h('div', { style: { textAlign: 'center', padding: '10px 0' } }, h('div.spinner-lg'), h('p', 'Typesetting your book… long books can take a minute.'));
  let ctrl = null;
  const m = modal({ title: 'Export PDF', width: 560, body, onClose: () => { ctrl?.abort(); hostEl.remove(); } });
  const pv = new PrintPreview(hostEl);
  pv.spread = false;
  const r = await pv.render(book, { onlyId });
  if (!onlyId) book.cover.lastPageCount = r.pages + (r.pages % 2);
  const t = trimOf(book.format);
  let q = quality;
  const progress = h('div.progress.hidden', h('div', { style: { width: '0%' } }));
  const status = h('p.small.muted');
  const name = `${slugify(book.meta.title)}${onlyId ? '-chapter' : '-interior'}.pdf`;
  const download = btn('Download PDF file', { kind: 'primary', icon: 'download', onClick: async () => {
    download.disabled = true;
    progress.classList.remove('hidden');
    ctrl = new AbortController();
    try {
      const raw = await pdfFromPreview(pv, {
        quality: q, title: book.meta.title, author: book.meta.author, signal: ctrl.signal,
        onProgress: (d, n) => { progress.firstChild.style.width = `${(d / n) * 100}%`; status.textContent = `Rendering page ${d} of ${n}…`; },
      });
      const { bytes } = await finishAndCheckInterior(raw, book);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      downloadBlob(blob, name);
      status.textContent = `Saved ${name} (${(blob.size / 1048576).toFixed(1)} MB).`;
      toast('PDF downloaded', 'success'); celebrate();
    } catch (e) {
      status.textContent = `PDF export stopped: ${e.message}`;
    } finally { download.disabled = false; }
  } });
  clear(body);
  body.style.textAlign = 'left';
  add(body,
    h('p', h('b', `${r.pages} pages typeset at ${t.w} × ${t.h} in${book.format.bleed ? ` + ${book.format.bleedSize} in bleed` : ''}.`)),
    h('div.pdf-option',
      h('h4', '1 · Image-based PDF (proof / fallback)'),
      isComplexScript(book.meta.language) ? h('div.notice.notice-error', icon('triangle-alert', 16), h('span', h('b', `${langInfo(book.meta.language).name} text can come out broken in an image-based PDF. `), 'Use the vector PDF for printing.')) : null,
      h('p.small.muted', 'One click, saves straight to your Downloads folder. Each page is a high-resolution image (image-based PDF) — good for proofs and sharing. For printing, the vector PDF has sharper text' + (globalThis.bookyDesktop ? '.' : ' (option 2).')),
      field('Quality', select(Object.entries(PDF_QUALITY).map(([k, v]) => [k, v.label]), q, (v) => { q = v; })),
      download, progress, status),
    globalThis.bookyDesktop ? h('div.pdf-option.pdf-best',
      h('h4', '★ Save a print-ready vector PDF'),
      h('p.small.muted', 'Sharpest text with embedded fonts, exact trim size — the best file for KDP, IngramSpark and printers. Identical on Windows and Mac.'),
      (() => {
        const st = h('p.small.muted');
        const b = btn('Save vector PDF…', { kind: 'primary', icon: 'file-down', onClick: async () => {
          b.disabled = true; st.textContent = 'Typesetting and saving…';
          try {
            const fin = await finishAndCheckInterior(await vectorInterior(book, { onlyId }), book);
            const res = await globalThis.bookyDesktop.savePdf(fin.bytes, name);
            if (res?.filePath) {
              clear(st); add(st, `Saved ${res.filePath.split(/[\\/]/).pop()} (${(res.bytes / 1048576).toFixed(1)} MB). `, h('a', { href: '#', on: { click: (e) => { e.preventDefault(); globalThis.bookyDesktop.showFile(res.filePath); } } }, 'Show in folder'));
              toast('PDF saved', 'success'); celebrate();
            } else st.textContent = '';
          } catch (e) { st.textContent = `Could not save the PDF: ${e.message}`; }
          b.disabled = false;
        } });
        return [b, st];
      })()) : null,
    h('div.pdf-option',
      h('h4', `${globalThis.bookyDesktop ? '3' : '2'} · Vector PDF via the print dialog`),
      h('p.small.muted', 'Choose “Save as PDF”, Margins: Default, Scale: 100%, and turn on Background graphics. The paper size is set to your trim size and fonts are embedded.'),
      btn('Open print dialog', { icon: 'printer', onClick: () => pv.print() })),
  );
}
