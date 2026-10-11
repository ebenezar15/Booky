// Builds the encrypted, self-contained review copy (one HTML file per reviewer).
import viewerJs from './viewer-runtime.js?raw';
import viewerCss from './viewer.css?raw';
import { renderSections } from '../render/book.js';
import { ebookCss } from '../render/css.js';
import { fontFaceCss, fontsUsedBy } from '../core/fonts.js';
import { escapeHtml, uid } from '../core/model.js';
import { encryptJson } from './crypto.js';
import { isRtl } from '../core/languages.js';

// Only embed the fonts the book actually uses (keeps the file small enough to email).
function usedFontCss(book) {
  const used = fontsUsedBy(book);
  for (const l of book.cover?.layers || []) used.delete(l.font);
  const f = book.format;
  [f.body.font, f.headings.font, f.headings.numberFont, f.headings.subheadFont, f.firstPara.dropCapFont].forEach((n) => n && used.add(n));
  return fontFaceCss(used);
}

const safeScript = (code) => code.replace(/<\/script/gi, '<\\/script');

/**
 * @param reviewer { id, name, email, color }
 * @param opts { passcode, authorEmail, authorName, expiresDays, message }
 * @returns { html, roundId, box } — box is the encrypted book, also used for online copies
 */
export async function buildReviewHtml(book, reviewer, opts) {
  const roundId = opts.roundId || uid('rd_');
  const sections = renderSections(book, 'ebook')
    .filter((s) => s.kind !== 'toc')
    .map((s) => ({
      id: s.el.id, anchor: s.anchor, title: s.nav || s.title || '',
      html: s.html.replace('<section ', `<section data-title="${escapeHtml(s.nav || s.title || '')}" `),
    }));
  const payload = {
    bookId: book.id, bookTitle: book.meta.title, author: book.meta.author, authorName: opts.authorName || book.meta.author,
    authorEmail: opts.authorEmail || '', roundId, reviewer: { id: reviewer.id, name: reviewer.name, email: reviewer.email, color: reviewer.color },
    message: opts.message || '', expiresAt: opts.expiresDays ? Date.now() + opts.expiresDays * 86400000 : 0,
    css: ebookCss(book), fontsCss: usedFontCss(book), sections,
  };
  const box = await encryptJson(payload, reviewer.email, opts.passcode);
  const pub = { title: book.meta.title, author: book.meta.author, box };
  const html = `<!doctype html>
<html lang="${escapeHtml(book.meta.language || 'en')}" dir="${isRtl(book.meta.language) ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(book.meta.title)} — private review copy</title>
<style>${viewerCss}</style>
</head><body>
<script>window.__BOOKY_REVIEW__ = ${JSON.stringify(pub).replace(/</g, '\\u003c')};</script>
<script>${safeScript(viewerJs)}</script>
</body></html>`;
  return { html, roundId, box };
}
