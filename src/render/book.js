// Turns a Booky project into publication HTML (shared by print preview, PDF, EPUB, DOCX…).
import { collectIndexMarks, buildIndex, markId, parseXrefTarget } from '../core/index-gen.js';
import {
  orderedElements, computeNumbers, chapterLabel, fillPlaceholders, fillText,
  escapeHtml, ELEMENT_TYPES, applyCase,
} from '../core/model.js';
import { SCENE_BREAKS, ORNAMENTS } from '../core/themes.js';
import { isRtl } from '../core/languages.js';
import { linkForPrint, noteMarker, figureLabel, FORMAT_DEFAULTS } from '../core/formatting.js';

// QR codes for links in print are made by a small library loaded only when that option is used.
let qrEncoder = null;
export async function prepareRender(book) {
  if (book.format.printLinks === 'qr' && !qrEncoder) {
    const mod = await import('qrcode-generator');
    const qrcode = mod.default || mod;
    qrEncoder = (text) => { try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 2, margin: 0, scalable: true }); } catch { return ''; } };
  }
}

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

// First user-perceived character, so Indic letters keep their vowel signs (e.g. "கா" not "க").
function firstGrapheme(s) {
  try { return new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next().value?.segment || s[0]; } catch { return s.match(/^.\p{M}*/u)?.[0] || s[0]; }
}

function applyDropCap(p, doc) {
  for (const t of textNodes(p)) {
    const lead = t.data.match(/^(\s*)([“"‘'(\[]*)(?=[\p{L}\p{N}])/u);
    const m = lead && [lead[0] + firstGrapheme(t.data.slice(lead[0].length)), lead[1], lead[2] + firstGrapheme(t.data.slice(lead[0].length))];
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

  // Print-only / ebook-only blocks (DOCX counts as print)
  root.querySelectorAll('[data-only]').forEach((n) => { if (n.getAttribute('data-only') !== (target === 'ebook' ? 'ebook' : 'print')) n.remove(); });
  // Tracking override on one paragraph (print layout fixes; reflowable ebooks don't need them)
  root.querySelectorAll('[data-tracking]').forEach((n) => { const t = +n.getAttribute('data-tracking'); if (t && target === 'print') n.style.letterSpacing = `${(t / 1000).toFixed(3)}em`; });
  // Custom paragraph styles also carry their base style's class
  for (const c of fmt.customParaStyles || []) root.querySelectorAll(`.ps-${c.id}`).forEach((n) => { if (c.basedOn) n.classList.add(`ps-${c.basedOn}`); });
  // Links in print: plain text, URL in a note, URL in brackets, or a QR code. The ebook keeps live links.
  if (target === 'print') {
    root.querySelectorAll('a[href]').forEach((a) => {
      if (a.closest('.bk-fnref') || a.classList.contains('bk-xref')) return;
      const r = linkForPrint(a.getAttribute('href'), a.innerHTML, fmt.printLinks || 'footnote', qrEncoder);
      const span = doc.createElement('span');
      span.innerHTML = r.html;
      if (r.note) { const fn = doc.createElement('span'); fn.setAttribute('data-type', 'footnote'); fn.setAttribute('data-note', r.note); span.appendChild(fn); }
      a.replaceWith(...span.childNodes);
    });
  }

  // Page breaks
  root.querySelectorAll('[data-type="page-break"]').forEach((n) => {
    const d = doc.createElement('div');
    d.className = 'bk-pagebreak';
    n.replaceWith(d);
  });

  // Notes to self are never printed or exported
  root.querySelectorAll('[data-type="authornote"]').forEach((n) => n.remove());

  // Index marks → anchors; cross-references → placeholders resolved in renderSections
  root.querySelectorAll('[data-type="index"]').forEach((n, k) => {
    const a = doc.createElement('span');
    a.className = 'bk-ix';
    a.id = `ix-${markId(el.id, n.getAttribute('data-id'), k)}`;
    n.replaceWith(a);
  });
  root.querySelectorAll('[data-type="xref"]').forEach((n) => {
    const a = doc.createElement('a');
    a.className = 'bk-xref';
    a.setAttribute('data-xref', n.getAttribute('data-target') || '');
    a.textContent = n.getAttribute('data-label') || '';
    n.replaceWith(a);
  });

  // Images → figures (numbered when the next paragraph is a caption)
  const ctx = opts.ctx || { bookFig: 0, figList: [] };
  const caps = { ...FORMAT_DEFAULTS.captions, ...(fmt.captions || {}) };
  let figN = 0, capN = 0;
  root.querySelectorAll('img').forEach((img) => {
    if (img.classList.contains('bk-scene-img')) return;
    const figId = `${el.id}-f${figN++}`;
    const w = img.getAttribute('data-width');
    const align = img.getAttribute('data-align') || 'center';
    img.removeAttribute('width');
    img.removeAttribute('height');
    if (w && w !== 'page') img.setAttribute('style', `width:${w}%`);
    if (!img.getAttribute('alt')) img.setAttribute('alt', img.getAttribute('title') || '');
    if (img.parentNode === root || img.parentNode?.tagName === 'DIV') {
      const fig = doc.createElement('figure');
      fig.className = w === 'page' ? 'bk-figure bk-fullpage' : `bk-figure bk-align-${align}`;
      fig.id = figId;
      img.replaceWith(fig);
      fig.appendChild(img);
    }
    const holder = img.closest('figure') || img.closest('p') || img;
    const cap = holder.nextElementSibling;
    if (cap && cap.classList?.contains('ps-caption')) {
      capN++; ctx.bookFig++;
      const label = figureLabel(caps, opts.chapterNo, capN, ctx.bookFig);
      if (label) cap.insertAdjacentHTML('afterbegin', `<span class="bk-fig-label">${escapeHtml(label)}</span> `);
      (holder.tagName === 'FIGURE' ? holder : img).setAttribute('data-label', label);
      if (holder.tagName !== 'FIGURE' && !img.id) img.id = figId;
      ctx.figList.push({ id: holder.tagName === 'FIGURE' ? holder.id : img.id, label, caption: cap.textContent.replace(label, '').trim(), elId: el.id });
    }
  });

  // Footnotes: at the foot of the page, at the end of the chapter, or collected at the back (print);
  // pop-up notes with back-links in the ebook in every case.
  const nopt = { ...FORMAT_DEFAULTS.notes, ...(fmt.notes || {}) };
  const notes = [];
  root.querySelectorAll('[data-type="footnote"]').forEach((n) => {
    const i = notes.length + 1;
    const num = nopt.numbering === 'continuous' ? (ctx.noteN = (ctx.noteN || 0) + 1) : i;
    const mark = noteMarker(num, nopt.marker);
    const id = `fn-${el.id}-${i}`;
    const text = n.getAttribute('data-note') || n.textContent || '';
    notes.push({ id, text, mark });
    if (target === 'print' && nopt.placement === 'page') {
      const sup = doc.createElement('sup');
      sup.className = 'bk-fnref';
      sup.textContent = mark;
      const fn = doc.createElement('span');
      fn.className = 'bk-footnote';
      fn.innerHTML = `<span class="bk-fn-mark">${escapeHtml(mark)}</span> ${escapeHtml(text)}`;
      n.replaceWith(sup, fn);
      return;
    }
    const sup = doc.createElement('sup');
    sup.className = 'bk-fnref';
    sup.innerHTML = target === 'ebook'
      ? `<a epub:type="noteref" href="#${id}" id="ref-${id}">${escapeHtml(mark)}</a>`
      : `<a href="#${id}" id="ref-${id}">${escapeHtml(mark)}</a>`;
    n.replaceWith(sup);
  });
  if (target === 'print' && nopt.placement === 'book' && notes.length) (ctx.bookNotes ||= []).push({ elId: el.id, notes });

  // Subheads get anchors for navigation
  const subheads = [];
  const headings = [];
  root.querySelectorAll('h1, h2, h3, h4').forEach((h, i) => {
    const id = `${el.id}-h${i}`;
    h.id = id;
    headings.push({ id, text: h.textContent.trim(), level: +h.tagName[1] });
    if (h.tagName === 'H2' || h.tagName === 'H3') subheads.push({ id, text: h.textContent, level: +h.tagName[1] });
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

  // Hanging punctuation (print): wrap an opening quote that starts a paragraph; CSS hangs it in flush-left paragraphs.
  if (target === 'print' && fmt.body.hangPunct && !isRtl(book.meta.language)) {
    root.querySelectorAll('p').forEach((p) => {
      if (/ps-(centered|epigraph|attribution|caption|signature|display|subtitle|author)|bk-scene|has-dropcap/.test(p.className) || /text-align:\s*(center|right)/.test(p.getAttribute('style') || '')) return;
      const t = textNodes(p).find((n) => n.data.trim());
      const m = t && t.data.match(/^(\s*)([“"‘'«„‚(\[])/);
      if (!m || t.parentNode.closest?.('sup, a')) return;
      const span = doc.createElement('span');
      span.className = 'bk-hang';
      span.textContent = m[2];
      const rest = t.data.slice(m[0].length);
      t.data = '';
      t.parentNode.insertBefore(span, t.nextSibling);
      span.parentNode.insertBefore(doc.createTextNode(rest), span.nextSibling);
      t.remove();
    });
  }

  // Verse: each line its own box (turnover lines hang), optional line numbers, short stanzas kept together
  const verse = { ...FORMAT_DEFAULTS.verse, ...(fmt.verse || {}) };
  let vline = 0;
  root.querySelectorAll('p.ps-verse').forEach((p) => {
    const lines = p.innerHTML.split(/<br\s*\/?>/i);
    p.innerHTML = lines.map((l) => {
      vline++;
      const num = verse.lineNumbers && vline % verse.lineNumbers === 0 && target === 'print' ? `<span class="bk-vnum" aria-hidden="true">${vline}</span>` : '';
      return `<span class="bk-vline">${num}${l || '&#8203;'}</span>`;
    }).join('');
    if (verse.keepStanzas && lines.length <= 8) p.classList.add('bk-keep');
  });

  // Number the top-level blocks so print pages can be mapped to ebook positions (EPUB page-list).
  [...root.children].forEach((n, i) => n.setAttribute('data-b', String(i)));

  let html = '';
  const wrap = doc.createElement('div');
  wrap.appendChild(root);
  html = wrap.innerHTML;
  if (notes.length && !(target === 'print' && nopt.placement !== 'chapter')) {
    html += target === 'ebook'
      ? `<section class="bk-notes"><h3 class="bk-notes-title">Notes</h3>${notes.map((n, i) => `<aside epub:type="footnote" id="${n.id}" class="bk-note"><p><a href="#ref-${n.id}">${escapeHtml(n.mark)}</a> ${escapeHtml(n.text)}</p></aside>`).join('')}</section>`
      : `<section class="bk-notes"><h3 class="bk-notes-title">Notes</h3><ol class="bk-notelist">${notes.map((n) => `<li id="${n.id}"><span class="bk-note-n">${escapeHtml(n.mark)}</span> ${escapeHtml(n.text)}</li>`).join('')}</ol></section>`;
  }
  return { html, subheads, headings, figures: figN };
}

function headingHtml(book, el, nums) {
  const key = openerKey(book, el);
  const variant = key ? book.format.openers[key] : null;
  const f = variant ? { ...book.format.headings, ...Object.fromEntries(Object.entries(variant).filter(([, v]) => v !== '' && v != null)) } : book.format.headings;
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

const XREF_WORD = { en: 'see page' };

// Cross-references: "see page N" in print (Paged.js target-counter), a titled link in the ebook.
function resolveXrefs(book, sections, html, target) {
  const lang = String(book.meta.language || 'en').split('-')[0];
  return html.replace(/<a class="bk-xref" data-xref="([^"]*)">([\s\S]*?)<\/a>/g, (all, raw, label) => {
    const t = parseXrefTarget(raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
    const s = sections.find((x) => x.el.id === t.elId);
    let id = null, title = '';
    if (s && t.kind === 'section') { id = s.anchor; title = s.nav || s.title; }
    if (s && t.kind === 'heading') { const hd = s.headings.find((x) => x.text === t.text); if (hd) { id = hd.id; title = hd.text; } }
    if (s && t.kind === 'figure' && t.index < s.figures) { id = `${s.el.id}-f${t.index}`; title = label || `figure ${t.index + 1}`; }
    if (!id) return `<span class="bk-xref-broken">${label}</span>`;
    if (target === 'ebook') return `<a class="bk-xref" href="${s.file}#${id}">${label.trim() ? label : escapeHtml(title)}</a>`;
    return `<a class="bk-xref" href="#${id}">${XREF_WORD[lang] ? `${XREF_WORD[lang]} ` : '→ '}</a>`;
  });
}

// The Index page, generated from the index marks.
function indexHtml(book, sections, marks, target) {
  const lang = book.meta.language || 'en';
  const groups = buildIndex(marks, lang);
  const secOf = new Map();
  for (const m of marks) secOf.set(m.id, sections.find((s) => s.el.id === m.elId));
  const refs = (ids) => {
    if (!ids.length) return '';
    if (target === 'ebook') {
      const seen = new Set();
      return ids.map((id) => { const s = secOf.get(id); if (!s || seen.has(s.anchor)) return ''; seen.add(s.anchor); return `<a href="${s.file}#ix-${id}">${escapeHtml(s.nav || s.title || 'page')}</a>`; }).filter(Boolean).join(', ');
    }
    return `<span class="bk-ix-refs">${ids.map((id) => `<a class="bk-ix-ref" href="#ix-${id}"></a>`).join('<span class="bk-ix-sep">, </span>')}</span>`;
  };
  const line = (e, cls) => {
    const parts = [`<span class="bk-ix-term">${escapeHtml(e.term)}</span>`];
    if (e.refs.length) parts.push(`, ${refs(e.refs)}`);
    if (e.see) parts.push(e.refs.length ? `; <em>see</em> ${escapeHtml(e.see)}` : `. <em>See</em> ${escapeHtml(e.see)}`);
    if (e.seeAlso.length) parts.push(`; <em>see also</em> ${e.seeAlso.map(escapeHtml).join('; ')}`);
    return `<p class="${cls}">${parts.join('')}</p>`;
  };
  return `<div class="bk-index"${target === 'ebook' ? ' epub:type="index"' : ''}>${groups.map((g) => `<h2 class="bk-ix-letter">${escapeHtml(g.letter)}</h2>${g.entries.map((e) => line(e, 'bk-ix-entry') + e.subs.map((sub) => line(sub, 'bk-ix-sub')).join('')).join('')}`).join('')}</div>`;
}

// List of illustrations: every captioned figure with its number, and its page in print.
function figureListHtml(sections, figs, target) {
  return `<nav class="bk-toc bk-figlist"><ol>${figs.map((f) => {
    const s = sections.find((x) => x.el.id === f.elId);
    const href = `${target === 'ebook' ? s?.file || '' : ''}#${f.id}`;
    return `<li class="bk-toc-item"><a href="${href}">${f.label ? `<span class="bk-toc-num">${escapeHtml(f.label)}</span>` : ''}<span class="bk-toc-text">${escapeHtml(f.caption)}</span>${target === 'print' ? '<span class="bk-toc-dots"></span>' : ''}</a></li>`;
  }).join('')}</ol></nav>`;
}

/** Which opener variant a page uses: its own "special" flag, or its type (prologue, epilogue, interlude, part). */
export function openerKey(book, el) {
  const o = book.format.openers || {};
  if (el.opener === 'special' && o.special) return 'special';
  return o[el.type] ? el.type : '';
}

function tocHtml(book, sections, target) {
  const t = book.format.toc || {};
  const items = sections.filter((s) => s.inToc);
  const li = (s) => {
    const sub = (t.depth || 1) > 1 && s.subheads.length
      ? `<ol class="bk-toc-sub">${s.subheads.filter((h) => h.level <= t.depth).map((h) => `<li class="bk-toc-item lvl-${h.level}"><a href="#${h.id}"><span class="bk-toc-text">${escapeHtml(h.text)}</span>${target === 'print' ? '<span class="bk-toc-dots"></span>' : ''}</a></li>`).join('')}</ol>`
      : '';
    // Untitled chapters show just their number; titled ones get the number as a prefix.
    const label = s.label && s.title && t.showNumbers !== false ? `<span class="bk-toc-num">${escapeHtml(s.label)}</span>` : '';
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

  const ctx = { bookFig: 0, noteN: 0, figList: [], bookNotes: [] };
  const sections = els.map((el, i) => {
    const simple = SIMPLE_PAGES.has(el.type);
    const { html, subheads, headings = [], figures = 0 } = el.type === 'toc' ? { html: '', subheads: [] } : processContent(book, el, target, { ctx, chapterNo: nums[el.id] });
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
      headings,
      figures,
      inToc: el.type !== 'toc' && !simple && el.type !== 'also-by' && i > tocIdx && (el.title || label),
    };
  });

  const firstBody = sections.find((s) => !s.front);
  const marks = collectIndexMarks(els);
  // Notes collected at the back of the book (print): the Notes page, or a generated one at the end
  if (ctx.bookNotes.length) {
    let notesSec = sections.find((s) => s.kind === 'endnotes');
    if (!notesSec) {
      const el = { id: 'gen-notes', type: 'endnotes', section: 'back', title: 'Notes', content: '' };
      notesSec = { el, anchor: 's-gen-notes', file: '', kind: 'endnotes', section: 'back', front: false, simple: false, head: `<header class="bk-chap-head"><h1 class="bk-chap-title">${escapeHtml(applyCase('Notes', book.format.headings.titleCase))}</h1></header>`, body: '', title: 'Notes', label: '', nav: 'Notes', subheads: [], headings: [], figures: 0, inToc: true };
      sections.push(notesSec);
    }
    notesSec.body = ctx.bookNotes.map((g) => {
      const s = sections.find((x) => x.el.id === g.elId);
      return `<h2 class="bk-notes-chapter">${escapeHtml(s?.nav || s?.title || '')}</h2><ol class="bk-notelist">${g.notes.map((n) => `<li id="${n.id}"><span class="bk-note-n">${escapeHtml(n.mark)}</span> ${escapeHtml(n.text)}</li>`).join('')}</ol>`;
    }).join('') + (notesSec.body && !/^\s*(<p>\s*<\/p>)?\s*$/.test(notesSec.body) ? notesSec.body : '');
  }
  for (const s of sections) {
    if (s.kind === 'toc') s.body = tocHtml(book, sections, target);
    if (s.kind === 'list-figures' && ctx.figList.length) s.body = figureListHtml(sections, ctx.figList, target);
    if (s.kind === 'index' && marks.length) s.body = indexHtml(book, sections, marks, target);
    if (s.body.includes('data-xref')) s.body = resolveXrefs(book, sections, s.body, target);
    const v = (s.el.align && s.el.align !== 'default' ? ` bk-valign-${s.el.align}` : '') + (openerKey(book, s.el) ? ` bk-opener-${openerKey(book, s.el)}` : '') + (s.body.includes('ps-verse') ? ' bk-has-verse' : '');
    s.html = `<section class="bk-sec bk-${s.kind}${s.simple ? ' bk-simple' : ''}${s.front ? ' bk-front' : ''}${v}" id="${s.anchor}" data-el="${s.el.id}"${s === firstBody ? ' data-body-start="1"' : ''}${target === 'print' && +s.el.tracking ? ` style="letter-spacing:${(+s.el.tracking / 1000).toFixed(3)}em"` : ''}>${s.head}<div class="bk-content">${s.body}</div></section>`;
  }
  return sections;
}
