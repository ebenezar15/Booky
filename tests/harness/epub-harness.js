// Builds EPUBs from fixture books inside a real browser (DOM, canvas and fonts are needed).
import { installFonts } from '../../src/core/fonts.js';
import { normalizeBook } from '../../src/core/model.js';
import { applyLanguageDesign, isEnglish } from '../../src/core/languages.js';
import { buildEpub } from '../../src/export/epub.js';
import { pageListIfWanted } from '../../src/export/page-map.js';

installFonts();

window.makeEpub = async (raw) => {
  const book = normalizeBook(raw);
  if (!isEnglish(book.meta.language)) applyLanguageDesign(book, book.meta.language);
  const pageList = await pageListIfWanted(book);
  const blob = await buildEpub(book, { pageList });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { b64: btoa(bin), pages: pageList?.length || 0 };
};
window.harnessReady = true;
