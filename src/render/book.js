// Turns a Booky project into publication HTML (shared by print preview, PDF, EPUB, DOCX…).
import {
  orderedElements, computeNumbers, chapterLabel, fillPlaceholders, fillText,
  escapeHtml, ELEMENT_TYPES, applyCase,
} from '../core/model.js';
import { SCENE_BREAKS, ORNAMENTS } from '../core/themes.js';

// Pages printed without running heads or folios, usually vertically placed.
export const SIMPLE_PAGES = new Set(['half-title', 'series-title', 'frontispiece', 'title', 'copyright', 'dedication', 'epigraph', 'blank', 'colophon']);
const STORY_TYPES = new Set(['chapter', 'prologue', 'epilogue', 'interlude']);

export function includedElements(book, target) {
  return orderedElements(book).filter((e) => (target === 'ebook' ? e.include.ebook : e.include.print));
}

function sceneBreakHtml(fmt) {
  const sb = fmt.sceneBreak;
  if (sb.style === 'line') return '<hr class="bk-scene-line" />';
  if (sb.style === 'blank') return '<p class="bk-scene bk-scene-blank">&#160;</p>';
  if (sb.style === 'image' && sb.image) return `<p class="bk-scene"><img class="bk-scene-img" src="${sb.image}" alt="" /></p>`;
  const sym = sb.style === 'custom' ? sb.custom || '* * *' : SCENE_BREAKS[sb.style] || '* * *';
  return `<p class="bk-scene">${escapeHtml(sym)}</p>`;
}

// Walks text nodes in order (for drop caps and lead-ins that span inline tags).
function textNodes(root) {
  const out = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) out.push(c);
      else if (c.nodeType === 1 && !c.classList?.contains('bk-fnref')) walk(c);
    }
  };
  walk(root);
  return out;
}

function applyDropCap(p, doc) {
  for (const t of textNodes(p)) {
    const m = t.data.match(/^(\s*)([“"‘'(\[]*\p{L}|\p{N})/u);
    if (!m) { if (t.data.trim()) return; continue; }
    const span = doc.createElement('span');
    span.className = 'bk-dropcap';
    span.textContent = m[2];
    const rest = t.data.slice(m[0].length);
    t.data = m[1];
    t.parentNode.insertBefore(span, t.nextSibling);
    if (rest) span.parentNode.insertBefore(doc.createTextNode(rest), span.nextSibling);
    return;
  }
}

function applyLeadIn(p, doc, words) {
  let remaining = words;
  for (const t of textNodes(p)) {
    if (remaining <= 0) break;
    if (t.parentNode?.classList?.contains('bk-dropcap')) continue;
    const re = /\S+\s*/g;
    let end = 0, m;
    while (remaining > 0 && (m = re.exec(t.data))) { end = m.index + m[0].length; remaining--; }
    if (!end) continue;
    const span = doc.createElement('span');
    span.className = 'bk-lead';
    span.textContent = t.data.slice(0, end).replace(/\s+$/, '');
    const trailing = t.data.slice(0, end).match(/\s+$/)?.[0] || '';
    const rest = t.data.slice(end);
    t.data = '';
    t.parentNode.insertBefore(span, t.nextSibling);
    span.parentNode.insertBefore(doc.createTextNode(trailing + rest), span.nextSibling);
  }
}

function processContent(book, el, target, opts = {}) {
  const fmt = book.format;
  const tpl = document.createElement('template');
  tpl.innerHTML = fillPlaceholders(el.content || '', book);
  const root = tpl.content;
  const doc = document;

  // Scene breaks
  root.querySelectorAll('[data-type="scene-break"], hr').forEach((n) => {
    const holder = doc.createElement('div');
    holder.innerHTML = sceneBreakHtml(fmt);
    const brk = holder.firstChild;
    n.replaceWith(brk);
    let next = brk.nextElementSibling;
    if (next && next.tagName === 'P' && fmt.sceneBreak.noIndentAfter) next.classList.add('bk-after-break');
  });

  // Page breaks
  root.querySelectorAll('[data-type="page-break"]').forEach((n) => {
    const d = doc.createElement('div');
    d.className = 'bk-pagebreak';
    n.replaceWith(d);
  });

  // Images → figures
  root.querySelectorAll('img').forEach((img) => {
    if (img.classList.contains('bk-scene-img')) return;
    const w = img.getAttribute('data-width');
    const align = img.getAttribute('data-align') || 'center';
    img.removeAttribute('width');
    img.removeAttribute('height');
    if (w) img.setAttribute('style', `width:${w}%`);
    if (!img.getAttribute('alt')) img.setAttribute('alt', img.getAttribute('title') || '');
    if (img.parentNode === root || img.parentNode?.tagName === 'DIV') {
      const fig = doc.createElement('figure');
      fig.className = `bk-figure bk-align-${align}`;
      img.replaceWith(fig);
      fig.appendChild(img);
    }
  });

  // Footnotes → numbered notes at the end of the section
  const notes = [];
  root.querySelectorAll('[data-type="footnote"]').forEach((n) => {
    const i = notes.length + 1;
    const id = `fn-${el.id}-${i}`;
    notes.push({ id, text: n.getAttribute('data-note') || n.textContent || '' });
    const sup = doc.createElement('sup');
    sup.className = 'bk-fnref';
    sup.innerHTML = target === 'ebook'
      ? `<a epub:type="noteref" href="#${id}" id="ref-${id}">${i}</a>`
      : `<a href="#${id}" id="ref-${id}">${i}</a>`;
    n.replaceWith(sup);
  });

  // Subheads get anchors for navigation
  const subheads = [];
  root.querySelectorAll('h2, h3').forEach((h, i) => {
    const id = `${el.id}-h${i}`;
    h.id = id;
    subheads.push({ id, text: h.textContent, level: +h.tagName[1] });
  });

  // Opening paragraph treatment
  if (STORY_TYPES.has(el.type) || opts.forceOpening) {
    const first = [...root.children].find((n) => n.tagName === 'P' && n.textContent.trim() && !/ps-(verse|epigraph|attribution|caption)/.test(n.className));
    if (first && first === [...root.children].find((n) => n.textContent.trim())) {
      first.classList.add('bk-first');
      const useDrop = target === 'ebook' ? fmt.ebook.dropCaps && fmt.firstPara.dropCap : fmt.firstPara.dropCap;
      if (useDrop) { applyDropCap(first, doc); first.classList.add('has-dropcap'); }
      if (fmt.firstPara.leadIn === 'smallcaps-words') applyLeadIn(first, doc, fmt.firstPara.leadWords || 3);
      if (fmt.firstPara.leadIn === 'smallcaps-line') first.classList.add('bk-leadline');
    }
  }

  let html = '';
  const wrap = doc.createElement('div');
  wrap.appendChild(root);
  html = wrap.innerHTML;
  if (notes.length) {
    html += target === 'ebook'
      ? `<section class="bk-notes"><h3 class="bk-notes-title">Notes</h3>${notes.map((n, i) => `<aside epub:type="footnote" id="${n.id}" class="bk-note"><p><a href="#ref-${n.id}">${i + 1}.</a> ${escapeHtml(n.text)}</p></aside>`).join('')}</section>`
      : `<section class="bk-notes"><h3 class="bk-notes-title">Notes</h3><ol>${notes.map((n) => `<li id="${n.id}">${escapeHtml(n.text)}</li>`).join('')}</ol></section>`;
  }
  return { html, subheads };
}

function headingHtml(book, el, nums) {
  const f = book.format.headings;
  const type = el.type;
  const def = ELEMENT_TYPES[type] || {};
  if (!def.heading || el.showTitle === false) return '';
  const label = type === 'chapter' || type === 'part' ? chapterLabel(book, el, nums) : '';
  const title = fillText(el.title, book);
  const img = el.headingImage || (type === 'chapter' && f.image) || '';
  const orn = ORNAMENTS[f.ornament] || '';
  const titleText = applyCase(title, f.titleCase);
  if (type === 'part') {
    return `<header class="bk-part-head">${img ? `<div class="bk-head-img"><img src="${img}" alt="" /></div>` : ''}${label ? `<div class="bk-part-num">${escapeHtml(label)}</div>` : ''}${title ? `<h1 class="bk-part-title">${escapeHtml(titleText)}</h1>` : ''}${orn ? `<div class="bk-orn">${orn}</div>` : ''}${el.subtitle ? `<p class="bk-chap-sub">${escapeHtml(el.subtitle)}</p>` : ''}</header>`;
  }
  const inline = f.numberPosition === 'inline' && label && title;
  return `<header class="bk-chap-head">${img ? `<div class="bk-head-img"><img src="${img}" alt="" /></div>` : ''}${
    inline
      ? `<h1 class="bk-chap-title"><span class="bk-chap-num-inline">${escapeHtml(label)}</span> ${escapeHtml(titleText)}</h1>`
      : `${label ? `<div class="bk-chap-num">${escapeHtml(label)}</div>` : ''}${title ? `<h1 class="bk-chap-title">${escapeHtml(titleText)}</h1>` : ''}`
  }${el.subtitle ? `<p class="bk-chap-sub">${escapeHtml(el.subtitle)}</p>` : ''}${orn ? `<div class="bk-orn">${orn}</div>` : ''}</header>`;
}

export function navTitle(book, el, nums) {
  const label = el.type === 'chapter' ? chapterLabel(book, el, nums) : '';
  const title = fillText(el.title, book);
  if (label && title) return `${label}: ${title}`;
  return title || label || ELEMENT_TYPES[el.type]?.label || '';
}

function tocHtml(book, sections, target) {
  const t = book.format.toc || {};
  const items = sections.filter((s) => s.inToc);
  const li = (s) => {
    const sub = (t.depth || 1) > 1 && s.subheads.length
      ? `<ol class="bk-toc-sub">${s.subheads.filter((h) => h.level <= t.depth).map((h) => `<li class="bk-toc-item lvl-${h.level}"><a href="#${h.id}"><span class="bk-toc-text">${escapeHtml(h.text)}</span>${target === 'print' ? '<span class="bk-toc-dots"></span>' : ''}</a></li>`).join('')}</ol>`
      : '';
    const label = s.label && t.showNumbers !== false ? `<span class="bk-toc-num">${escapeHtml(s.label)}</span>` : '';
    return `<li class="bk-toc-item kind-${s.kind}${s.front ? ' is-front' : ''}"><a href="${target === 'ebook' ? s.file : ''}#${s.anchor}">${label}<span class="bk-toc-text">${escapeHtml(s.title || s.label)}</span>${target === 'print' ? '<span class="bk-toc-dots"></span>' : ''}</a>${sub}</li>`;
  };
  return `<nav class="bk-toc"><ol>${items.map(li).join('')}</ol></nav>`;
}

/**
 * Build all sections of the book.
 * @returns {Array<{el, anchor, kind, simple, html, title, label, subheads, inToc, front}>}
 */
export function renderSections(book, target = 'print', { onlyId } = {}) {
  const nums = computeNumbers(book);
  let els = includedElements(book, target);
  if (onlyId) els = els.filter((e) => e.id === onlyId);
  const tocIdx = els.findIndex((e) => e.type === 'toc');

  const sections = els.map((el, i) => {
    const simple = SIMPLE_PAGES.has(el.type);
    const { html, subheads } = el.type === 'toc' ? { html: '', subheads: [] } : processContent(book, el, target);
    const head = headingHtml(book, el, nums);
    const label = el.type === 'chapter' || el.type === 'part' ? chapterLabel(book, el, nums) : '';
    return {
      el,
      anchor: `s-${el.id}`,
      file: `s${String(i + 1).padStart(3, '0')}.xhtml`,
      kind: el.type,
      section: el.section,
      front: el.section === 'front',
      simple,
      head,
      body: html,
      title: fillText(el.title, book) || (el.type === 'chapter' ? '' : ELEMENT_TYPES[el.type]?.label),
      label,
      nav: navTitle(book, el, nums),
      subheads,
      inToc: el.type !== 'toc' && !simple && el.type !== 'also-by' && i > tocIdx && (el.title || label),
    };
  });

  const firstBody = sections.find((s) => !s.front);
  for (const s of sections) {
    if (s.kind === 'toc') s.body = tocHtml(book, sections, target);
    const v = s.el.align && s.el.align !== 'default' ? ` bk-valign-${s.el.align}` : '';
    s.html = `<section class="bk-sec bk-${s.kind}${s.simple ? ' bk-simple' : ''}${s.front ? ' bk-front' : ''}${v}" id="${s.anchor}" data-el="${s.el.id}"${s === firstBody ? ' data-body-start="1"' : ''}>${s.head}<div class="bk-content">${s.body}</div></section>`;
  }
  return sections;
}
