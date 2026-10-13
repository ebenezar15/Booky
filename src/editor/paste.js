// Clean paste from Word, Google Docs and web pages: keep the structure and meaningful emphasis
// (headings, quotes, bold, italic, underline, small caps, footnotes), drop fonts, colours, sizes and stray spans.
import { cleanHtml } from '../core/typography.js';

const STYLE_FOR_CLASS = [
  [/MsoTitle/i, 'h1'], [/MsoSubtitle/i, 'p.ps-subtitle'], [/Mso(Intense)?Quote/i, 'blockquote'], [/MsoHeading1|Heading1/i, 'h1'], [/MsoHeading2|Heading2/i, 'h2'], [/MsoHeading3|Heading3/i, 'h3'],
];

/** Footnotes: Word (#_ftnN / div#ftnN) and Google Docs (#ftntN) notes become Booky footnotes. */
function convertFootnotes(doc) {
  const notes = new Map();
  doc.querySelectorAll('a[href^="#"]').forEach((a) => {
    const id = a.getAttribute('href').slice(1);
    if (!/^(_?ftn\d+|ftnt\d+|_edn\d+|edn\d+|fn\d+)$/i.test(id)) return;
    const target = doc.getElementById(id) || doc.querySelector(`a[name="${id}"]`)?.closest('div, p') || doc.querySelector(`[id="${id}"]`);
    if (!target) return;
    const holder = target.closest('div') && target.closest('div') !== doc.body ? target.closest('div') : target.closest('p') || target;
    const clone = holder.cloneNode(true);
    clone.querySelectorAll('a[href^="#"]').forEach((x) => x.remove()); // the back-link "[1]"
    const text = clone.textContent.replace(/\s+/g, ' ').replace(/^\s*\[?\d+\]?\s*/, '').trim();
    if (!text) return;
    notes.set(a, text);
    holder.setAttribute('data-booky-note-source', '1');
  });
  for (const [a, text] of notes) {
    const span = doc.createElement('span');
    span.setAttribute('data-type', 'footnote');
    span.setAttribute('data-note', text);
    (a.closest('sup') || a).replaceWith(span);
  }
  doc.querySelectorAll('[data-booky-note-source]').forEach((n) => n.remove());
  // the rule Google Docs and Word draw above the notes is now the last thing left
  if (notes.size) doc.querySelectorAll('hr').forEach((hr) => { if (!hr.nextElementSibling) hr.remove(); });
  // Word puts the notes in a block after a separator
  doc.querySelectorAll('div[style*="mso-element:footnote-list"], div[style*="mso-element: footnote-list"]').forEach((n) => n.remove());
}

function rename(doc, el, tag) {
  const [name, cls] = tag.split('.');
  const n = doc.createElement(name);
  if (cls) n.className = cls;
  while (el.firstChild) n.appendChild(el.firstChild);
  el.replaceWith(n);
  return n;
}

const unwrap = (el) => { const p = el.parentNode; if (!p) return; while (el.firstChild) p.insertBefore(el.firstChild, el); el.remove(); };

/** @returns cleaned HTML ready for the editor. opts: { typography: bool, lang } */
export function cleanPastedHtml(html, { typography = true, lang = 'en' } = {}) {
  const doc = new DOMParser().parseFromString(String(html).replace(/<!--[\s\S]*?-->/g, ''), 'text/html');
  doc.querySelectorAll('style, meta, link, script, title, xml, o\\:p').forEach((n) => n.remove());
  // Google Docs wraps everything in <b style="font-weight:normal" id="docs-internal-guid-…">
  doc.querySelectorAll('b[id^="docs-internal-guid"]').forEach(unwrap);
  convertFootnotes(doc);
  // Word paragraph classes → Booky structure
  doc.querySelectorAll('p[class*="Mso"], p[class*="Heading"]').forEach((p) => {
    const hit = STYLE_FOR_CLASS.find(([re]) => re.test(p.className));
    if (!hit) return;
    if (hit[1] === 'blockquote') { const bq = doc.createElement('blockquote'); p.replaceWith(bq); bq.appendChild(p); p.removeAttribute('class'); } else rename(doc, p, hit[1]);
  });
  doc.querySelectorAll('h5, h6').forEach((x) => rename(doc, x, 'h4'));
  // inline emphasis expressed as CSS (Google Docs) → real marks
  doc.querySelectorAll('[style]').forEach((el) => {
    const st = el.getAttribute('style').toLowerCase();
    const isInline = /^(SPAN|FONT|B|I|A)$/.test(el.tagName);
    if (isInline) {
      let inner = el;
      const wrap = (tag, cls) => { const w = doc.createElement(tag); if (cls) w.className = cls; while (inner.firstChild) w.appendChild(inner.firstChild); inner.appendChild(w); inner = w; };
      if (/font-weight:\s*(bold|[6-9]00)/.test(st) && el.tagName !== 'B') wrap('strong');
      if (/font-style:\s*italic/.test(st)) wrap('em');
      if (/text-decoration[^;]*underline/.test(st) && el.tagName !== 'A') wrap('u');
      if (/text-decoration[^;]*line-through/.test(st)) wrap('s');
      if (/font-variant[^;]*small-caps/.test(st)) wrap('span', 'sc');
      if (/vertical-align:\s*super/.test(st)) wrap('sup');
      if (/vertical-align:\s*sub/.test(st)) wrap('sub');
      if (el.tagName === 'B' && /font-weight:\s*(normal|400)/.test(st)) { el.removeAttribute('style'); unwrap(el); return; }
    }
    // keep paragraph alignment only
    const align = st.match(/text-align:\s*(center|right|justify)/);
    if (align && /^(P|H\d|DIV)$/.test(el.tagName)) el.setAttribute('style', `text-align:${align[1]}`); else el.removeAttribute('style');
  });
  doc.querySelectorAll('font').forEach(unwrap);
  // classes: keep only Booky's own (ps-…, sc)
  doc.querySelectorAll('[class]').forEach((el) => {
    const keep = el.className.split(/\s+/).filter((c) => /^ps-|^sc$/.test(c));
    if (keep.length) el.className = keep.join(' '); else el.removeAttribute('class');
  });
  // spans with nothing left are just noise
  doc.querySelectorAll('span:not([class]):not([data-type])').forEach(unwrap);
  doc.querySelectorAll('[lang], [dir="ltr"], [id]').forEach((el) => { el.removeAttribute('lang'); if (el.getAttribute('dir') === 'ltr') el.removeAttribute('dir'); if (!el.matches('[data-type]')) el.removeAttribute('id'); });
  let out = doc.body.innerHTML.replace(/&nbsp;/g, ' ').replace(/ {2,}/g, ' ');
  if (typography) out = cleanHtml(out, { lang }).html;
  return out;
}
