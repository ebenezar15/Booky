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

// Lays the book out with Paged.js and reports the index lines, cross-references and where marks landed.
window.printIndex = async (raw) => {
  const { printDocument } = await import('../../src/render/preview.js');
  const book = normalizeBook(raw);
  const token = 'ix' + Math.random().toString(36).slice(2);
  const { html } = printDocument(book, { token, interactive: false });
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:900px;height:900px';
  document.body.appendChild(iframe);
  await new Promise((resolve, reject) => {
    const on = (ev) => { if (ev.data?.token !== token) return; window.removeEventListener('message', on); ev.data.type === 'booky-paged' ? resolve() : reject(new Error(ev.data.message)); };
    window.addEventListener('message', on);
    iframe.srcdoc = html;
  });
  const d = iframe.contentDocument;
  const pageOf = (el) => el?.closest('.pagedjs_page')?.getAttribute('data-page-n') || '';
  const marks = [...d.querySelectorAll('.bk-ix')].map((s) => `${s.id}@${pageOf(s)}`);
  const index = [...d.querySelectorAll('.bk-ix-entry, .bk-ix-sub')].map((p) => `${p.className === 'bk-ix-sub' ? '  ' : ''}${p.textContent}`);
  const xrefs = [...d.querySelectorAll('.bk-xref, .bk-xref-broken')].map((a) => `${a.textContent}${getComputedStyle(a, '::after').content}`);
  const lampRoom = [...d.querySelectorAll('h2')].find((x) => x.textContent === 'The lamp room');
  return { pages: d.querySelectorAll('.pagedjs_page').length, marks, index, xrefs, lampRoomPage: pageOf(lampRoom), ch1Page: pageOf(d.getElementById('s-e4')) };
};

// Lays the book out and runs the Layout check, plus a few measurements for the typography options.
window.layoutProbe = async (raw) => {
  const { printDocument } = await import('../../src/render/preview.js');
  const { readLayout } = await import('../../src/render/layout-read.js');
  const { layoutFindings } = await import('../../src/core/layout-check.js');
  const book = normalizeBook(raw);
  const token = 'lp' + Math.random().toString(36).slice(2);
  const { html } = printDocument(book, { token, interactive: false });
  document.querySelectorAll('iframe.probe').forEach((f) => f.remove());
  const iframe = document.createElement('iframe');
  iframe.className = 'probe';
  iframe.style.cssText = 'width:900px;height:900px';
  document.body.appendChild(iframe);
  const t0 = performance.now();
  await new Promise((resolve, reject) => {
    const on = (ev) => { if (ev.data?.token !== token) return; window.removeEventListener('message', on); ev.data.type === 'booky-paged' ? resolve() : reject(new Error(ev.data.message)); };
    window.addEventListener('message', on);
    iframe.srcdoc = html;
  });
  const renderMs = Math.round(performance.now() - t0);
  const d = iframe.contentDocument;
  const t1 = performance.now();
  const pages = readLayout(d);
  const findings = layoutFindings(pages, { hyphenLimit: book.format.body.hyphenate ? +book.format.body.hyphenLimit || 0 : 0 });
  const checkMs = Math.round(performance.now() - t1);
  const hang = [...d.querySelectorAll('.bk-hang')].slice(0, 3).map((s) => {
    const p = s.closest('p');
    const pr = p.getBoundingClientRect(), sr = s.getBoundingClientRect();
    const r = d.createRange(); const next = s.nextSibling; r.setStart(next, 0); r.setEnd(next, 1);
    const g = d.createRange(); g.selectNodeContents(s);
    return { cls: p.className, indent: getComputedStyle(p).textIndent, boxLeft: Math.round(sr.left - pr.left), glyphLeft: Math.round(g.getBoundingClientRect().left - pr.left), glyphRight: Math.round(g.getBoundingClientRect().right - pr.left), letterLeft: Math.round(r.getBoundingClientRect().left - pr.left) };
  });
  const fig = d.querySelector('.bk-content p');
  const numStyle = fig ? getComputedStyle(fig).fontVariantNumeric : '';
  return { renderMs, checkMs, pages: pages.length, findings, hang, numStyle, supportsLimit: iframe.contentWindow.CSS.supports('hyphenate-limit-lines', '2'),
    headingPages: [...d.querySelectorAll('h2')].map((x) => ({ text: x.textContent, page: x.closest('.pagedjs_page')?.getAttribute('data-page-n'), last: !x.nextElementSibling })) };
};
