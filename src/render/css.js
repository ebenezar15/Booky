// Generates the book stylesheet from the format settings, for print (Paged.js /
// PDF) and for ebooks (EPUB/HTML). Print uses absolute units; ebooks use ems so
// reader font-size controls still work.
import { fontStack as baseStack } from '../core/fonts.js';
import { langInfo } from '../core/languages.js';
import { trimOf } from '../core/themes.js';

const cssStr = (s) => `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

export function typographyCss(book, target) {
  const L = langInfo(book.meta.language);
  const fontStack = (n) => baseStack(n, L.script !== 'latin' ? L.body : '');
  const f = book.format;
  const b = f.body, h = f.headings, fp = f.firstPara;
  const print = target === 'print';
  const u = (pt) => (print ? `${pt}pt` : `${(pt / b.size).toFixed(3)}em`);
  const headFont = fontStack(h.font);
  const numFont = fontStack(h.numberFont || h.font);
  const subFont = fontStack(h.subheadFont || h.font);
  const bodyFont = target === 'ebook' && !f.ebook.useBookFonts ? 'serif' : fontStack(b.font);
  const justify = print ? b.align : f.ebook.justify ? 'justify' : 'left';
  const indent = b.spacing === 'indent' && (print || f.ebook.indent);
  const sink = print ? `${h.sink}in` : `${(h.sink * 2.2).toFixed(2)}em`;
  const after = print ? `${h.afterSpace}in` : `${(h.afterSpace * 3).toFixed(2)}em`;
  const lines = fp.dropCapLines || 3;

  return `
.bk-sec { font-family: ${bodyFont}; font-size: ${print ? b.size + 'pt' : '1em'}; line-height: ${b.leading}; color: ${print ? b.color : 'inherit'};
  text-align: ${justify}; ${b.hyphenate ? 'hyphens: auto; -webkit-hyphens: auto;' : 'hyphens: manual;'} widows: ${f.layout.widows}; orphans: ${f.layout.orphans};
  font-kerning: normal; font-variant-ligatures: common-ligatures; text-rendering: optimizeLegibility; letter-spacing: ${b.letterSpacing || 0}em; word-spacing: ${b.wordSpacing || 0}em; }
.bk-content p { margin: 0; text-indent: ${indent ? b.indent + 'em' : '0'}; margin-bottom: ${indent ? (b.indentGap || 0) : b.paraGap}em; }
.bk-content > p:first-child, .bk-content p.bk-first, .bk-content p.bk-after-break, .bk-content p.ps-noindent,
.bk-content h2 + p, .bk-content h3 + p, .bk-content h4 + p, .bk-content figure + p, .bk-content blockquote + p,
.bk-content ul + p, .bk-content ol + p, .bk-content .bk-scene + p, .bk-content .bk-scene-line + p, .bk-content .ps-verse + p:not(.ps-verse) { text-indent: 0; }
.bk-simple .bk-content p, .bk-front .bk-content p { hyphens: manual; }
.bk-content strong { font-weight: 700; }
.bk-content a { color: inherit; text-decoration: none; }
.bk-content mark { background: none; color: inherit; }
.bk-content sup, .bk-content sub { font-size: 0.7em; line-height: 0; }
.bk-content h2 { font-family: ${subFont}; font-size: ${u(h.h2Size)}; font-weight: 700; line-height: 1.25; margin: 1.3em 0 0.5em; text-indent: 0; hyphens: manual; break-after: avoid; page-break-after: avoid; text-align: ${h.align === 'center' ? 'center' : 'left'}; }
.bk-content h3 { font-family: ${subFont}; font-size: ${u(h.h3Size)}; font-weight: 700; font-style: italic; line-height: 1.3; margin: 1.1em 0 0.4em; text-indent: 0; hyphens: manual; break-after: avoid; page-break-after: avoid; }
.bk-content h4 { font-family: ${subFont}; font-size: 1em; font-variant: small-caps; letter-spacing: .05em; margin: 1em 0 .3em; text-indent: 0; break-after: avoid; }
.bk-content blockquote { margin: 0.9em 1.6em; font-size: 0.95em; }
.bk-content blockquote p { text-indent: 0; margin-bottom: .4em; }
.bk-content ul, .bk-content ol { margin: 0.6em 0 0.6em 1.4em; padding: 0; }
.bk-content li p { text-indent: 0; margin: 0 0 .25em; }
.ps-display { font-family: ${headFont}; font-size: 2.6em; line-height: 1.12; text-indent: 0 !important; margin-bottom: .35em !important; hyphens: manual; text-align: center; }
.ps-subtitle { font-family: ${headFont}; font-size: 1.3em; font-style: italic; line-height: 1.3; text-indent: 0 !important; margin-bottom: .4em !important; text-align: center; }
.ps-author { font-family: ${headFont}; font-size: 1.35em; letter-spacing: .12em; text-transform: uppercase; text-indent: 0 !important; text-align: center; }
.ps-small { font-size: 0.78em; line-height: 1.45; text-indent: 0 !important; margin-bottom: .7em !important; text-align: left; hyphens: manual; }
.ps-spacer { height: 2.4em; text-indent: 0 !important; }
.ps-verse { text-align: left !important; text-indent: 0 !important; margin: 0 0 1em 0 !important; hyphens: manual; }
.ps-epigraph { font-size: 1.05em; text-indent: 0 !important; margin: 0 1.5em .4em !important; text-align: center; }
.ps-attribution { text-align: right; text-indent: 0 !important; font-size: .9em; margin: 0 1.5em 1em !important; }
.ps-caption { text-align: center; font-size: .85em; font-style: italic; text-indent: 0 !important; margin: .3em 0 1em !important; }
.ps-letter { font-style: italic; margin: 0 1.5em !important; text-indent: 0 !important; }
.ps-signature { text-align: right; text-indent: 0 !important; font-style: italic; margin-bottom: 1em !important; }
.ps-hanging { padding-left: 1.6em; text-indent: -1.6em !important; text-align: left; margin-bottom: .4em !important; }
.ps-callout { border: 0.75pt solid currentColor; padding: .7em .9em; margin: 1em 0 !important; text-indent: 0 !important; border-radius: 3pt; }
.ps-smallcaps { font-variant: small-caps; letter-spacing: .04em; }
.ps-centered { text-align: center; text-indent: 0 !important; }
.bk-scene { text-align: center !important; text-indent: 0 !important; margin: 0.9em 0 !important; letter-spacing: .2em; hyphens: manual; break-after: avoid; }
.bk-scene-img { height: 1.2em; width: auto; }
.bk-scene-line { border: none; border-top: 0.6pt solid currentColor; width: 22%; margin: 1.2em auto; }
.bk-figure { margin: 1em 0; text-align: center; break-inside: avoid; page-break-inside: avoid; text-indent: 0; }
.bk-figure img { max-width: 100%; height: auto; }
.bk-figure.bk-align-left { text-align: left; } .bk-figure.bk-align-right { text-align: right; }
.bk-pagebreak { break-after: page; page-break-after: always; height: 0; }
.bk-fnref a { color: inherit; text-decoration: none; }
.bk-notes { margin-top: 2em; font-size: .82em; line-height: 1.4; border-top: 0.5pt solid currentColor; padding-top: .6em; text-align: left; }
.bk-notes-title { font-size: 1em; font-variant: small-caps; letter-spacing: .08em; margin: 0 0 .4em; }
.bk-notes ol { margin: 0 0 0 1.4em; padding: 0; }
.bk-note p { text-indent: 0; margin: 0 0 .3em; }
.bk-dropcap { font-family: ${fontStack(fp.dropCapFont || h.font)}; ${fp.dropCapColor ? `color: ${fp.dropCapColor};` : ''} }
.has-dropcap .bk-dropcap { float: left; font-size: ${(((lines - 1) * b.leading + 0.72) / 0.7).toFixed(2)}em; line-height: 0.78; margin: 0.035em 0.07em 0 0; padding: 0; }
.bk-lead { font-variant: small-caps; letter-spacing: .05em; }
.bk-leadline::first-line { font-variant: small-caps; letter-spacing: .04em; }
.bk-chap-head { padding-top: ${sink}; margin-bottom: ${after}; text-align: ${h.align}; hyphens: manual; text-indent: 0; break-after: avoid; page-break-after: avoid; }
.bk-chap-num { font-family: ${numFont}; font-size: ${u(h.numberSize)}; letter-spacing: ${h.numberSpacing}em; ${h.numberItalic ? 'font-style: italic;' : ''} line-height: 1.1; margin-bottom: 0.45em; }
.bk-chap-title, .bk-part-title { font-family: ${headFont}; font-weight: ${h.titleWeight}; ${h.titleItalic ? 'font-style: italic;' : ''} letter-spacing: ${h.titleSpacing}em; line-height: 1.2; margin: 0; color: ${print ? h.titleColor : 'inherit'}; }
.bk-chap-title { font-size: ${u(h.titleSize)}; }
.bk-chap-num-inline { margin-right: .35em; }
.bk-chap-sub { font-family: ${headFont}; font-size: ${u(h.subtitleSize)}; ${h.subtitleItalic ? 'font-style: italic;' : ''} margin: .45em 0 0; text-indent: 0; }
.bk-orn { margin-top: .9em; line-height: 1; }
.orn-rule { display: inline-block; width: 100%; border-top: 0.6pt solid currentColor; vertical-align: middle; }
.orn-rule.short { width: 1.1in; } .orn-rule.double { border-top: 2.4pt double currentColor; width: 1.4in; }
.orn-glyph { font-size: 1.05em; letter-spacing: .3em; }
.bk-head-img { margin-bottom: .8em; } .bk-head-img img { max-width: 70%; max-height: ${print ? '1.7in' : '8em'}; }
.bk-part-head { text-align: center; hyphens: manual; ${print ? '' : 'margin-top: 30%;'} }
.bk-part-num { font-family: ${numFont}; font-size: ${u(h.numberSize + 1)}; letter-spacing: .2em; text-transform: uppercase; margin-bottom: .6em; }
.bk-part-title { font-size: ${u(h.partSize)}; }
.bk-content .bk-index { font-size: .92em; }
.bk-content .bk-index h2.bk-ix-letter { font-size: 1.05em; text-align: left; margin: 1.1em 0 .3em; }
.bk-content .bk-index h2.bk-ix-letter:first-child { margin-top: 0; }
.bk-content .bk-index p.bk-ix-entry, .bk-content .bk-index p.bk-ix-sub { margin: 0 0 .15em; text-indent: -1.2em; padding-left: 1.2em; text-align: left; hyphens: manual; break-inside: avoid; }
.bk-content .bk-index p.bk-ix-sub { padding-left: 2.4em; }
.bk-toc ol { list-style: none; padding: 0; margin: 0; }
.bk-toc-item { margin: .38em 0; text-indent: 0; text-align: left; hyphens: manual; }
.bk-toc-item a { display: flex; align-items: baseline; color: inherit; text-decoration: none; }
.bk-toc-num { margin-right: .5em; ${(f.toc?.numberStyle || 'smallcaps') === 'smallcaps' ? 'font-variant: small-caps; letter-spacing: .04em;' : ''} }
.bk-toc-text { flex: 0 1 auto; }
.bk-toc-dots { flex: 1 1 auto; margin: 0 .35em; ${f.toc?.leaders === false ? '' : 'border-bottom: 1pt dotted currentColor;'} transform: translateY(-.28em); min-width: 1em; }
.bk-toc-item.kind-part { margin-top: .9em; font-variant: small-caps; letter-spacing: .06em; }
.bk-toc-sub { padding-left: 1.3em !important; font-size: .92em; }
.bk-simple .bk-content { text-align: center; }
.bk-copyright .bk-content, .bk-copyright .bk-content p { text-align: left; }
`;
}

function pageBoxes(book, s, side, frontRoman, first) {
  const f = book.format;
  const hd = f.header, pn = f.pageNumbers;
  const boxes = {};
  const add = (box, part) => { (boxes[box] = boxes[box] || []).push(part); };
  // Folios are computed after pagination (see preview.js) and exposed as --bk-folio.
  const counter = 'var(--bk-folio)';
  const isBodyLike = !s.front && s.kind !== 'part';
  const runningText = (which) => {
    const m = book.meta;
    if (which === 'author') return m.author;
    if (which === 'title') return m.title;
    if (which === 'chapter') return s.title || s.label || m.title;
    return '';
  };
  if (s.simple || s.kind === 'part' || s.kind === 'blank' || s.kind === 'also-by') return boxes;
  // Running heads (never on opening pages or front matter)
  if (hd.show && isBodyLike && !first) {
    const txt = runningText(side === 'left' ? hd.verso : hd.recto);
    if (txt) add(hd.align === 'outside' ? (side === 'left' ? 'top-left' : 'top-right') : 'top-center', cssStr(txt));
  }
  // Folios
  if (pn.position !== 'none' && (!first || pn.showOnChapterStart)) {
    let pos = pn.position;
    if (first && pos.startsWith('top')) pos = 'bottom-center'; // opening pages carry the folio at the foot
    const box = {
      'bottom-center': 'bottom-center', 'top-center': 'top-center',
      'bottom-outside': side === 'left' ? 'bottom-left' : 'bottom-right',
      'top-outside': side === 'left' ? 'top-left' : 'top-right',
    }[pos] || 'bottom-center';
    if (box in boxes) boxes[box] = side === 'left' ? [counter, '"\\2003\\2003"', ...boxes[box]] : [...boxes[box], '"\\2003\\2003"', counter];
    else add(box, counter);
  }
  return boxes;
}

export function printCss(book, sections) {
  const L = langInfo(book.meta.language);
  const fontStack = (n) => baseStack(n, L.script !== 'latin' ? L.body : '');
  const f = book.format;
  const { w, h } = trimOf(f);
  const m = f.margins;
  const hd = f.header, pn = f.pageNumbers;
  const contentH = h - m.top - m.bottom - 0.04;
  const boxStyle = (box) => {
    const isHead = box.startsWith('top');
    const font = fontStack((isHead ? hd.font : pn.font) || f.headings.font || f.body.font);
    return `font-family: ${font}; font-size: ${isHead ? hd.size : pn.size}pt; ${isHead ? `letter-spacing: ${hd.spacing}em; text-transform: ${hd.case === 'upper' ? 'uppercase' : hd.case === 'smallcaps' ? 'none' : 'none'}; ${hd.case === 'smallcaps' ? 'font-variant: small-caps;' : ''} ${hd.italic ? 'font-style: italic;' : ''} vertical-align: middle;` : 'vertical-align: middle;'} color: ${(!isHead && pn.color) || f.body.color};`;
  };
  const ALL = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
  const boxRules = (boxes) => ALL.map((b) => (boxes[b] ? `@${b} { content: ${boxes[b].join(' ')}; ${boxStyle(b)} }` : `@${b} { content: none; }`)).join(' ');

  let css = `
@page { size: ${w}in ${h}in; margin: ${m.top}in ${m.outside}in ${m.bottom}in ${m.inside}in; ${f.bleed ? `bleed: ${f.bleedSize}in;` : ''} ${f.cropMarks ? 'marks: crop cross;' : ''} }
@page :left { margin-left: ${m.outside}in; margin-right: ${m.inside}in; }
@page :right { margin-left: ${m.inside}in; margin-right: ${m.outside}in; }
@page :blank { ${boxRules({})} }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; }
.bk-valign-center { min-height: ${contentH}in; display: flex; flex-direction: column; justify-content: center; }
.bk-valign-third { padding-top: ${(contentH * 0.2).toFixed(2)}in; }
.bk-valign-bottom { min-height: ${contentH}in; display: flex; flex-direction: column; justify-content: flex-end; }
.bk-part { min-height: ${contentH}in; display: flex; flex-direction: column; justify-content: center; }
.bk-toc-item > a::after { content: ${f.toc?.pageNumbers === false ? 'none' : 'target-counter(attr(href), page)'}; flex: none; }
.bk-toc-item.is-front > a::after { content: ${f.toc?.pageNumbers === false ? 'none' : `target-counter(attr(href), page${pn.frontRoman ? ', lower-roman' : ''})`}; }
${f.toc?.pageNumbers === false ? '.bk-toc-dots { border: none !important; }' : ''}
/* cross-references and the index: page numbers come from the target's page */
.bk-xref { color: inherit; text-decoration: none; }
.bk-xref::after { content: target-counter(attr(href), page); }
.bk-ix-ref::after { content: target-counter(attr(href), page); }
.bk-xref.is-resolved::after, .bk-ix-refs.is-merged .bk-ix-ref::after { content: none; }
.bk-ix-ref { color: inherit; text-decoration: none; }
/* full-page images: a page of their own with no margins, running into the bleed when bleed is on */
@page bkfull { margin: 0; ${boxRules({})} }
.bk-fullpage { page: bkfull; break-before: page; break-after: page; margin: 0 !important; width: ${w}in; height: ${h}in; overflow: visible; }
.bk-fullpage img { display: block; max-width: none; object-fit: cover; width: ${(w + (f.bleed ? 2 * f.bleedSize : 0)).toFixed(4)}in; height: ${(h + (f.bleed ? 2 * f.bleedSize : 0)).toFixed(4)}in; ${f.bleed ? `margin: -${f.bleedSize}in;` : ''} }
`;

  const firstBody = sections.find((s) => !s.front);
  const breakFor = (s, i) => {
    if (i === 0) return 'auto';
    const so = s.el.startOn;
    if (so && so !== 'default') return so === 'continue' ? 'auto' : so;
    const L = f.layout;
    if (s.front) {
      if (['copyright', 'also-by', 'series-title', 'frontispiece', 'blank'].includes(s.kind)) return 'page';
      return L.frontStart === 'right' ? 'right' : 'page';
    }
    if (s.kind === 'part') return L.partStart === 'right' ? 'right' : 'page';
    if (s === firstBody) return 'right';
    return L.chapterStart === 'right' ? 'right' : L.chapterStart === 'left' ? 'left' : 'page';
  };

  sections.forEach((s, i) => {
    const name = `pg${i}`;
    css += `#${s.anchor} { page: ${name}; break-before: ${breakFor(s, i)}; ${s === firstBody && pn.frontRoman ? 'counter-reset: page 1;' : ''} }\n`;
    css += `@page ${name}:left { ${boxRules(pageBoxes(book, s, 'left', pn.frontRoman))} }\n`;
    css += `@page ${name}:right { ${boxRules(pageBoxes(book, s, 'right', pn.frontRoman))} }\n`;
    css += `@page ${name}:first { ${boxRules(pageBoxes(book, s, 'right', pn.frontRoman, true))} }\n`;
  });
  return css;
}

// Screen-only chrome for the paginated preview (kept out of Paged.js processing).
export function previewChromeCss() {
  return `
@media screen {
  html { background: #e9e6df; }
  body { margin: 0; }
  .pagedjs_pages { display: flex; flex-direction: column; align-items: center; padding: 24px 0 60px; }
  .pagedjs_page { background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 8px 24px rgba(0,0,0,.10); margin: 0 0 24px; }
  body.spread .pagedjs_pages { display: grid; grid-template-columns: repeat(2, max-content); justify-content: center; row-gap: 24px; }
  body.spread .pagedjs_page { margin: 0; }
  body.spread .pagedjs_first_page { grid-column: 2; }
  body.spread .pagedjs_left_page { box-shadow: inset -10px 0 14px -12px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.10); }
  body.spread .pagedjs_right_page { box-shadow: inset 10px 0 14px -12px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.10); }
  body.guides .pagedjs_area { outline: 1px dashed rgba(91, 79, 214, .55); }
  body.guides .pagedjs_page { outline: 1px solid rgba(224, 122, 95, .35); }
  .pagedjs_page.bk-flash { outline: 3px solid #e07a5f; }
  body.pdf-export .pagedjs_page { box-shadow: none !important; outline: none !important; margin: 0 !important; }
  body.pdf-export .pagedjs_area { outline: none !important; }
}
@media print { html, body { background: #fff !important; } .pagedjs_page { box-shadow: none !important; margin: 0 !important; } .pagedjs_pages { display: block !important; zoom: 1 !important; } }
`;
}

export function ebookCss(book) {
  const f = book.format;
  return `
html, body { margin: 0; padding: 0; }
body { ${f.ebook.useBookFonts ? '' : 'font-family: serif;'} }
.bk-sec { padding: 0; }
.bk-valign-center, .bk-valign-third { margin-top: 18%; }
.bk-valign-bottom { margin-top: 30%; }
.bk-pagebreak { page-break-after: always; }
.bk-toc-item a { display: block; }
.bk-toc-dots { display: none; }
.bk-note { display: block; }
${typographyCss(book, 'ebook')}
`;
}
