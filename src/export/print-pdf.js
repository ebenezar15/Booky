// The print interior as a finished PDF: vector in the desktop app (Chromium's printToPDF),
// then boxes, bleed and metadata fixed with pdf-lib, then checked.
import { trimOf } from '../core/themes.js';
import { isRtl, langInfo } from '../core/languages.js';
import { printDocument } from '../render/preview.js';
import { finishInterior, finishCover, pdfMeta } from './pdf-post.js';
import { inspectPdf, checkInterior } from './pdf-check.js';

/** True in the desktop app, where Booky can produce a vector PDF without the print dialog. */
export const canVectorPdf = () => !!globalThis.bookyDesktop?.renderPdf;

/** Books in complex scripts (Tamil, Devanagari, Arabic…) need a vector PDF for correct shaping. */
export const isComplexScript = (lang) => langInfo(lang).script !== 'latin';

/** The settings the finisher and checker need for this book. */
export function interiorSpec(book, platform) {
  const t = trimOf(book.format);
  return {
    trimW: t.w, trimH: t.h, bleed: book.format.bleed ? +book.format.bleedSize || 0.125 : 0,
    rtl: isRtl(book.meta.language), meta: pdfMeta(book),
    minPages: platform?.minPages || 0, maxPages: platform?.maxPages || 0,
  };
}

const toBytes = async (x) => (x instanceof Uint8Array ? x : x instanceof ArrayBuffer ? new Uint8Array(x) : new Uint8Array(await x.arrayBuffer()));

/** Finish and check any interior PDF (built here or dropped in by the author). Returns { bytes, notes, checks }. */
export async function finishAndCheckInterior(input, book, platform) {
  const spec = interiorSpec(book, platform);
  const raw = await toBytes(input);
  const before = checkInterior(await inspectPdf(raw), spec);
  const { bytes, notes } = await finishInterior(raw, spec);
  // Re-check after finishing so size and page count reflect what goes into the package.
  const after = checkInterior(await inspectPdf(bytes), spec);
  // Keep the "odd page count" warning visible if we padded.
  const checks = after.map((c, i) => (i === 1 && before[1]?.ok === 'warn' ? { ...c, text: `${c.text} (one blank page added)` } : c));
  return { bytes, notes, checks };
}

/** Vector interior from the desktop app. */
export async function vectorInterior(book, { onlyId } = {}) {
  if (!canVectorPdf()) throw new Error('Vector PDFs are made by the desktop app.');
  await (await import('../render/book.js')).prepareRender(book);
  const html = printDocument(book, { onlyId, interactive: false }).html;
  return toBytes(await globalThis.bookyDesktop.renderPdf(html));
}

/** Finished cover PDF from a cover image PDF (blob/bytes). */
export async function finishCoverPdf(input, book, coverBleed) {
  return (await finishCover(await toBytes(input), { coverBleed, meta: pdfMeta(book, ' — cover') })).bytes;
}
