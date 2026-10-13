// Web page, Markdown, plain-text and print-ready HTML exports.
import { renderSections, includedElements } from '../render/book.js';
import { xrefsToText } from '../core/index-gen.js';
import { ebookCss } from '../render/css.js';
import { fontFaceCss, fontsUsedBy } from '../core/fonts.js';
import { isRtl } from '../core/languages.js';
import { escapeHtml, fillPlaceholders, fillText, htmlToText, computeNumbers, chapterLabel, ELEMENT_TYPES } from '../core/model.js';
import { htmlToMarkdown } from '../import/text.js';
import { printDocument } from '../render/preview.js';
import { frontCoverDataURL } from '../render/cover.js';

export function buildHtml(book) {
  const sections = renderSections(book, 'ebook').map((s) => ({ ...s, html: s.html.replace(/href="s\d+\.xhtml#/g, 'href="#') }));
  const nav = sections.filter((s) => s.inToc).map((s) => `<li><a href="#${s.anchor}">${escapeHtml(s.nav)}</a></li>`).join('');
  return `<!doctype html>
<html lang="${escapeHtml(book.meta.language || 'en')}" dir="${isRtl(book.meta.language) ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(book.meta.title)}</title>
<meta name="author" content="${escapeHtml(book.meta.author)}">
<meta name="description" content="${escapeHtml(book.meta.description)}">
<style>${fontFaceCss(fontsUsedBy(book))}</style>
<style>
${ebookCss(book)}
body { max-width: 38em; margin: 0 auto; padding: 3em 1.4em 6em; font-size: 18px; background: #fffdf9; color: #1d1b22; }
.bk-sec { margin: 0 0 4em; }
.bk-cover-img { display: block; max-width: 100%; margin: 0 auto 4em; box-shadow: 0 10px 40px rgba(0,0,0,.2); }
nav.site-toc { border: 1px solid #e6e0d6; border-radius: 10px; padding: 1em 1.4em; margin-bottom: 4em; }
nav.site-toc ol { margin: 0; padding-left: 1.2em; }
@media (prefers-color-scheme: dark) { body { background: #17161f; color: #e7e5ef; } nav.site-toc { border-color: #333; } }
</style>
</head>
<body>
<img class="bk-cover-img" src="${frontCoverDataURL(book)}" alt="${escapeHtml(book.meta.title)} cover">
${nav ? `<nav class="site-toc"><strong>Contents</strong><ol>${nav}</ol></nav>` : ''}
${sections.filter((s) => s.kind !== 'toc').map((s) => s.html).join('\n')}
</body>
</html>`;
}

export function buildMarkdown(book) {
  const nums = computeNumbers(book);
  const m = book.meta;
  let out = `---\ntitle: "${(m.title || '').replace(/"/g, '\\"')}"\n${m.subtitle ? `subtitle: "${m.subtitle.replace(/"/g, '\\"')}"\n` : ''}author: "${(m.author || '').replace(/"/g, '\\"')}"\nlang: ${m.language || 'en'}\n---\n\n`;
  for (const el of includedElements(book, 'ebook')) {
    if (el.type === 'toc') continue;
    const def = ELEMENT_TYPES[el.type] || {};
    const label = el.type === 'chapter' || el.type === 'part' ? chapterLabel(book, el, nums) : '';
    const title = fillText(el.title, book);
    if (def.heading && el.showTitle !== false && (label || title)) out += `${el.type === 'part' ? '#' : '##'} ${[label, title].filter(Boolean).join(': ')}\n\n`;
    out += htmlToMarkdown(xrefsToText(fillPlaceholders(el.content, book)).replace(/<h1/g, '<h3').replace(/<\/h1>/g, '</h3>')) + '\n\n';
  }
  return out.replace(/\n{3,}/g, '\n\n');
}

export function buildText(book) {
  const nums = computeNumbers(book);
  let out = `${book.meta.title}\n${book.meta.author ? `by ${book.meta.author}\n` : ''}\n\n`;
  for (const el of includedElements(book, 'ebook')) {
    if (el.type === 'toc') continue;
    const label = el.type === 'chapter' || el.type === 'part' ? chapterLabel(book, el, nums) : '';
    const title = fillText(el.title, book);
    if (label || title) out += `\n\n${[label, title].filter(Boolean).join(': ').toUpperCase()}\n\n`;
    out += htmlToText(xrefsToText(fillPlaceholders(el.content, book)).replace(/<div data-type="scene-break"[^>]*><\/div>/g, '<p>* * *</p>')).replace(/\n{3,}/g, '\n\n');
  }
  return out.trim() + '\n';
}

// A standalone, print-ready HTML file (open in Chrome/Edge → Print → Save as PDF).
export function buildPrintHtml(book) {
  return printDocument(book, { interactive: false }).html;
}
