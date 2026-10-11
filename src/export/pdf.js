// Direct PDF file export (no print dialog): every typeset Paged.js page is rendered
// to an image at the chosen resolution and placed on a page of exactly the trim size.
// For vector text, use the print dialog route (PrintPreview.print → Save as PDF).

export const PDF_QUALITY = {
  draft: { label: 'Draft (150 DPI, small file)', dpi: 150, jpeg: 0.85 },
  standard: { label: 'Standard (220 DPI)', dpi: 220, jpeg: 0.9 },
  print: { label: 'Print (300 DPI, required by most printers)', dpi: 300, jpeg: 0.92 },
};

async function libs() {
  const [{ jsPDF }, h2c] = await Promise.all([import('jspdf'), import('html2canvas')]);
  return { jsPDF, html2canvas: h2c.default || h2c };
}

/**
 * @param preview PrintPreview that has finished rendering
 * @param opts { quality, title, author, onProgress(done, total), signal }
 * @returns Blob
 */
export async function pdfFromPreview(preview, { quality = 'standard', title = '', author = '', onProgress, signal } = {}) {
  const { jsPDF, html2canvas } = await libs();
  const q = PDF_QUALITY[quality] || PDF_QUALITY.standard;
  const doc = preview.doc;
  const saved = { spread: preview.spread, zoom: preview.zoom, guides: preview.guides };
  preview.spread = false; preview.zoom = 1; preview.guides = false;
  preview.applyView();
  doc.body.classList.add('pdf-export');
  await doc.fonts?.ready;
  const pages = [...doc.querySelectorAll('.pagedjs_page')];
  let pdf = null;
  try {
    for (let i = 0; i < pages.length; i++) {
      if (signal?.aborted) throw new Error('Cancelled');
      const el = pages[i];
      const wIn = el.offsetWidth / 96, hIn = el.offsetHeight / 96;
      if (!pdf) pdf = new jsPDF({ unit: 'in', format: [wIn, hIn], orientation: wIn > hIn ? 'landscape' : 'portrait', compress: true });
      else pdf.addPage([wIn, hIn], wIn > hIn ? 'landscape' : 'portrait');
      const canvas = await html2canvas(el, {
        scale: q.dpi / 96, backgroundColor: '#ffffff', logging: false, useCORS: true,
        windowWidth: doc.documentElement.scrollWidth, windowHeight: doc.documentElement.scrollHeight,
        scrollX: 0, scrollY: 0,
      });
      pdf.addImage(canvas.toDataURL('image/jpeg', q.jpeg), 'JPEG', 0, 0, wIn, hIn, undefined, 'FAST');
      canvas.width = canvas.height = 0;
      onProgress?.(i + 1, pages.length);
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    doc.body.classList.remove('pdf-export');
    Object.assign(preview, saved);
    preview.applyView();
  }
  pdf.setProperties({ title, author, creator: 'Booky' });
  return pdf.output('blob');
}

// A single image (e.g. a print cover wrap) as a one-page PDF of exact physical size.
export async function pdfFromCanvas(canvas, wIn, hIn, { title = '' } = {}) {
  const { jsPDF } = await libs();
  const pdf = new jsPDF({ unit: 'in', format: [wIn, hIn], orientation: wIn > hIn ? 'landscape' : 'portrait', compress: true });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, wIn, hIn, undefined, 'FAST');
  pdf.setProperties({ title, creator: 'Booky' });
  return pdf.output('blob');
}
