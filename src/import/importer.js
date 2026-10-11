// Import manuscripts (DOCX, Markdown, plain text, HTML, Booky backups) and split
// them into chapters automatically.
import { createElement, escapeHtml } from '../core/model.js';
import { normalizeHtml } from '../editor/schema.js';
import { readAsArrayBuffer, readAsText } from '../ui/dom.js';
import { markdownToHtml, textToHtml } from './text.js';

export const IMPORT_ACCEPT = '.docx,.md,.markdown,.txt,.text,.html,.htm,.booky,.json,.fountain,.rtf';

export async function readManuscript(file) {
  const name = file.name.toLowerCase();
  const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  if (name.endsWith('.docx')) {
    const mod = await import('mammoth/mammoth.browser.js');
    const mammoth = mod.default || mod;
    const res = await mammoth.convertToHtml({ arrayBuffer: await readAsArrayBuffer(file) }, {
      styleMap: [
        "p[style-name='Title'] => h1.doc-title:fresh",
        "p[style-name='Subtitle'] => p.ps-subtitle:fresh",
        "p[style-name='Quote'] => blockquote > p:fresh",
        "p[style-name='Intense Quote'] => blockquote > p:fresh",
        "p[style-name='Chapter Title'] => h1:fresh",
        "p[style-name='Chapter Heading'] => h1:fresh",
        "p[style-name='Caption'] => p.ps-caption:fresh",
        "r[style-name='Emphasis'] => em",
        "r[style-name='Strong'] => strong",
        "u => u",
        'strike => s',
      ],
    });
    return { title, html: res.value, warnings: res.messages };
  }
  const text = await readAsText(file);
  if (name.endsWith('.booky') || name.endsWith('.json')) return { title, project: JSON.parse(text) };
  if (name.endsWith('.md') || name.endsWith('.markdown')) return { title, html: markdownToHtml(text) };
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    doc.querySelectorAll('script, style, meta, link, noscript, iframe, object').forEach((n) => n.remove());
    return { title: doc.title || title, html: doc.body.innerHTML };
  }
  if (name.endsWith('.rtf')) return { title, html: textToHtml(rtfToText(text)) };
  return { title, html: textToHtml(text) };
}

function rtfToText(rtf) {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\'([0-9a-f]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

const CHAPTER_RE = /^\s*(chapter|chap\.|part|book|prologue|epilogue|interlude|introduction|preface|foreword|afterword|acknowledg(e)?ments?|about the author|dedication|epigraph|appendix|glossary|bibliography|notes)\b|^\s*([IVXLC]+|\d{1,3})\.?\s*$/i;

const TYPE_BY_TITLE = [
  [/^prologue\b/i, 'prologue'], [/^epilogue\b/i, 'epilogue'], [/^interlude\b/i, 'interlude'], [/^(part|book)\b/i, 'part'],
  [/^introduction\b/i, 'introduction'], [/^preface\b/i, 'preface'], [/^foreword\b/i, 'foreword'], [/^afterword\b/i, 'afterword'],
  [/^acknowledg/i, 'acknowledgments'], [/^about the author/i, 'about-author'], [/^dedication\b/i, 'dedication'], [/^epigraph\b/i, 'epigraph'],
  [/^appendix\b/i, 'appendix'], [/^glossary\b/i, 'glossary'], [/^bibliography\b/i, 'bibliography'], [/^(end)?notes\b/i, 'endnotes'],
  [/^(contents|table of contents)$/i, 'toc'], [/^copyright\b/i, 'copyright'],
];

// "Chapter 3: The Storm" -> "The Storm"; "CHAPTER ONE" -> ""
export function cleanChapterTitle(t) {
  const s = t.replace(/\s+/g, ' ').trim();
  const m = s.match(/^(chapter|chap\.)\s+([\w-]+)\s*[:.\-–—]?\s*(.*)$/i);
  if (m) return m[3].trim();
  if (/^([IVXLC]+|\d{1,3})\.?$/i.test(s)) return '';
  const n = s.match(/^(\d{1,3}|[IVXLC]+)[.:)\-–—]\s+(.+)$/);
  if (n) return n[2];
  return s;
}

function detectMode(container) {
  const count = (sel) => container.querySelectorAll(sel).length;
  if (count(':scope > h1') >= 2) return 'h1';
  if (count(':scope > h2') >= 2) return 'h2';
  const pattern = [...container.children].filter((n) => /^(P|H\d)$/.test(n.tagName) && n.textContent.length < 80 && CHAPTER_RE.test(n.textContent)).length;
  if (pattern >= 2) return 'pattern';
  return 'none';
}

/**
 * Split HTML into chapter-like chunks.
 * mode: auto | h1 | h2 | pattern | separator | none
 */
export function splitIntoChapters(html, { mode = 'auto', separator = '' } = {}) {
  const container = document.createElement('div');
  container.innerHTML = html;
  // Unwrap common wrappers so headings sit at the top level.
  container.querySelectorAll('section, article, main, body').forEach((n) => n.replaceWith(...n.childNodes));
  if (mode === 'auto') mode = detectMode(container);

  const isBreak = (n) => {
    if (n.nodeType !== 1) return false;
    if (mode === 'h1') return n.tagName === 'H1';
    if (mode === 'h2') return n.tagName === 'H1' || n.tagName === 'H2';
    if (mode === 'pattern') return /^(P|H\d)$/.test(n.tagName) && n.textContent.length < 80 && CHAPTER_RE.test(n.textContent);
    if (mode === 'separator') return separator && n.textContent.trim() === separator.trim();
    return false;
  };

  const chunks = [];
  let cur = { title: '', nodes: [] };
  for (const n of [...container.childNodes]) {
    if (isBreak(n)) {
      if (cur.nodes.some((x) => x.textContent?.trim() || x.querySelector?.('img')) || cur.title) chunks.push(cur);
      cur = { title: mode === 'separator' ? '' : n.textContent.trim(), nodes: [] };
      // A subtitle line immediately after a bare "Chapter 1" heading becomes the title.
      continue;
    }
    cur.nodes.push(n);
  }
  if (cur.nodes.some((x) => x.textContent?.trim() || x.querySelector?.('img')) || cur.title) chunks.push(cur);

  return chunks.map((c, i) => {
    const wrap = document.createElement('div');
    c.nodes.forEach((n) => wrap.appendChild(n));
    let rawTitle = c.title;
    // "CHAPTER 1" followed by a short heading line → use it as the title
    const firstEl = wrap.firstElementChild;
    if (rawTitle && /^(chapter\s+[\w-]+|[IVXLC]+|\d{1,3})\.?$/i.test(rawTitle) && firstEl && /^H\d$/.test(firstEl.tagName)) {
      rawTitle = firstEl.textContent.trim();
      firstEl.remove();
    }
    const typeRule = TYPE_BY_TITLE.find(([re]) => re.test(rawTitle));
    const type = typeRule ? typeRule[1] : 'chapter';
    const title = type === 'chapter' ? cleanChapterTitle(rawTitle) : type === 'part' ? rawTitle.replace(/^(part|book)\s+[\w-]+\s*[:.\-–—]?\s*/i, '') : rawTitle;
    return { type, title, html: wrap.innerHTML, index: i, preface: !c.title && i === 0 && mode !== 'none' };
  });
}

export function chunksToElements(chunks) {
  return chunks.map((c) => {
    const el = createElement(c.type);
    el.title = c.type === 'chapter' || c.title ? c.title : el.title;
    if (c.preface && c.type === 'chapter') el.title = el.title || 'Opening';
    el.content = c.type === 'toc' ? '' : normalizeHtml(c.html || '<p></p>');
    el.status = 'draft';
    return el;
  });
}

export function importSummary(chunks) {
  return chunks.map((c) => ({ type: c.type, title: c.title || (c.type === 'chapter' ? 'Numbered chapter (no title)' : c.type), words: (c.html.replace(/<[^>]+>/g, ' ').match(/\S+/g) || []).length }));
}

export { escapeHtml };
