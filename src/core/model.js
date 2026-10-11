// Book data model: element catalogue, defaults and factories.
import { PAGE_TEMPLATES } from './pages.js';
import { defaultFormat } from './themes.js';
import { defaultCover } from './cover-defaults.js';
import { deepMerge } from './util-merge.js';

export { deepMerge };

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const SECTIONS = [
  { id: 'front', label: 'Front Matter' },
  { id: 'body', label: 'Body' },
  { id: 'back', label: 'Back Matter' },
];

// Every kind of page a traditionally published book can contain.
// `generated` pages are rendered from book data (e.g. the table of contents).
export const ELEMENT_TYPES = {
  'half-title':      { label: 'Half Title', section: 'front', icon: 'type', heading: false },
  'series-title':    { label: 'Series Page', section: 'front', icon: 'library', heading: false },
  'also-by':         { label: 'Also By', section: 'front', icon: 'books', heading: true },
  'frontispiece':    { label: 'Frontispiece', section: 'front', icon: 'image', heading: false },
  'title':           { label: 'Title Page', section: 'front', icon: 'book-open', heading: false },
  'copyright':       { label: 'Copyright', section: 'front', icon: 'copyright', heading: false },
  'dedication':      { label: 'Dedication', section: 'front', icon: 'heart', heading: false },
  'epigraph':        { label: 'Epigraph', section: 'front', icon: 'quote', heading: false },
  'toc':             { label: 'Table of Contents', section: 'front', icon: 'list', heading: true, generated: true },
  'list-figures':    { label: 'List of Illustrations', section: 'front', icon: 'images', heading: true },
  'foreword':        { label: 'Foreword', section: 'front', icon: 'file-text', heading: true },
  'preface':         { label: 'Preface', section: 'front', icon: 'file-text', heading: true },
  'acknowledgments': { label: 'Acknowledgments', section: 'back', icon: 'hand-heart', heading: true },
  'introduction':    { label: 'Introduction', section: 'front', icon: 'file-text', heading: true },
  'prologue':        { label: 'Prologue', section: 'body', icon: 'sunrise', heading: true },
  'part':            { label: 'Part', section: 'body', icon: 'layers', heading: true },
  'chapter':         { label: 'Chapter', section: 'body', icon: 'file-pen', heading: true, numbered: true },
  'interlude':       { label: 'Interlude', section: 'body', icon: 'pause', heading: true },
  'epilogue':        { label: 'Epilogue', section: 'body', icon: 'sunset', heading: true },
  'afterword':       { label: 'Afterword', section: 'back', icon: 'file-text', heading: true },
  'appendix':        { label: 'Appendix', section: 'back', icon: 'paperclip', heading: true },
  'glossary':        { label: 'Glossary', section: 'back', icon: 'book-a', heading: true },
  'endnotes':        { label: 'Notes', section: 'back', icon: 'sticky-note', heading: true },
  'bibliography':    { label: 'Bibliography', section: 'back', icon: 'library-big', heading: true },
  'index':           { label: 'Index', section: 'back', icon: 'list-ordered', heading: true },
  'about-author':    { label: 'About the Author', section: 'back', icon: 'user', heading: true },
  'book-club':       { label: 'Reading Group Guide', section: 'back', icon: 'messages-square', heading: true },
  'excerpt':         { label: 'Excerpt / Teaser', section: 'back', icon: 'bookmark', heading: true },
  'newsletter':      { label: 'Newsletter / Call to Action', section: 'back', icon: 'mail', heading: true },
  'colophon':        { label: 'Colophon', section: 'back', icon: 'feather', heading: false },
  'blank':           { label: 'Blank Page', section: 'front', icon: 'square', heading: false },
  'custom':          { label: 'Custom Page', section: 'body', icon: 'file-plus', heading: true },
};

export const STATUSES = [
  { id: 'todo', label: 'To Do', color: '#9ca3af' },
  { id: 'draft', label: 'First Draft', color: '#e0a526' },
  { id: 'revised', label: 'Revised', color: '#3b82f6' },
  { id: 'edited', label: 'Edited', color: '#8b5cf6' },
  { id: 'final', label: 'Final', color: '#2f9e77' },
];

export function createElement(type, overrides = {}) {
  const def = ELEMENT_TYPES[type] || ELEMENT_TYPES.custom;
  const tpl = PAGE_TEMPLATES[type];
  return {
    id: uid('el_'),
    type,
    section: def.section,
    title: tpl?.title ?? (type === 'chapter' ? '' : def.label),
    subtitle: '',
    content: tpl?.content ?? '<p></p>',
    synopsis: '',
    notes: '',
    status: 'todo',
    label: '',
    numbered: !!def.numbered || type === 'part',
    showTitle: def.heading,
    include: { print: true, ebook: type !== 'blank' && type !== 'half-title' && type !== 'frontispiece' },
    startOn: type === 'chapter' || type === 'part' || def.section === 'front' ? 'default' : 'default',
    align: tpl?.align || 'default',       // vertical placement for simple pages
    headingImage: '',
    wordTarget: 0,
    snapshots: [],
    ...overrides,
  };
}

export function createBook(opts = {}) {
  const now = Date.now();
  return {
    id: uid('bk_'),
    version: 1,
    createdAt: now,
    updatedAt: now,
    meta: {
      title: 'Untitled Book',
      subtitle: '',
      author: '',
      series: '',
      seriesNumber: '',
      publisher: '',
      publisherCity: '',
      publisherWebsite: '',
      isbnPrint: '',
      isbnEbook: '',
      edition: 'First Edition',
      year: String(new Date().getFullYear()),
      language: 'en',
      genre: '',
      description: '',
      keywords: '',
      categories: '',
      copyrightHolder: '',
      editor: '',
      illustrator: '',
      coverDesigner: '',
      website: '',
      authorBio: '',
      ...(opts.meta || {}),
    },
    elements: [],
    format: defaultFormat(opts.theme),
    cover: defaultCover(),
    bible: [],
    goals: { target: 80000, deadline: '', daily: 1000, history: {} },
    settings: { writingFont: 'Lora', writingSize: 18, pageWidth: 760 },
    ...(opts.extra || {}),
  };
}

// Make old/partial project files safe to use.
export function normalizeBook(b) {
  const base = createBook();
  const book = { ...base, ...b };
  book.meta = { ...base.meta, ...(b.meta || {}) };
  book.format = deepMerge(base.format, b.format || {});
  book.cover = deepMerge(base.cover, b.cover || {});
  book.goals = { ...base.goals, ...(b.goals || {}) };
  book.settings = { ...base.settings, ...(b.settings || {}) };
  book.bible = Array.isArray(b.bible) ? b.bible : [];
  book.elements = (b.elements || []).map((e) => {
    const fresh = createElement(e.type || 'custom');
    return { ...fresh, ...e, include: { ...fresh.include, ...(e.include || {}) }, snapshots: e.snapshots || [] };
  });
  return book;
}

export function orderedElements(book) {
  const order = { front: 0, body: 1, back: 2 };
  return book.elements
    .map((e, i) => ({ e, i }))
    .sort((x, y) => order[x.e.section] - order[y.e.section] || x.i - y.i)
    .map((x) => x.e);
}

// ---------- numbering ----------
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function numberToWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numberToWords(n % 100) : '');
  return String(n);
}

export function toRoman(n) {
  const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of map) while (n >= v) { s += r; n -= v; }
  return s;
}

export function formatNumber(n, style) {
  switch (style) {
    case 'word': return numberToWords(n).replace(/(^|-|\s)\w/g, (m) => m.toUpperCase());
    case 'roman': return toRoman(n);
    case 'roman-lower': return toRoman(n).toLowerCase();
    case 'padded': return String(n).padStart(2, '0');
    default: return String(n);
  }
}

export function applyCase(text, mode) {
  if (!text) return text;
  if (mode === 'upper') return text.toUpperCase();
  if (mode === 'lower') return text.toLowerCase();
  if (mode === 'title') return text.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
  return text;
}

// Chapter/part numbers keyed by element id.
export function computeNumbers(book) {
  let ch = 0, pt = 0;
  const nums = {};
  for (const e of orderedElements(book)) {
    if (e.type === 'chapter' && e.numbered) nums[e.id] = ++ch;
    if (e.type === 'part' && e.numbered !== false) nums[e.id] = ++pt;
  }
  return nums;
}

export function chapterLabel(book, el, nums) {
  const f = book.format.headings;
  const n = nums[el.id];
  if (!n) return '';
  if (el.type === 'part') {
    return applyCase(`${f.partPrefix ? f.partPrefix + ' ' : ''}${formatNumber(n, f.partNumberStyle)}`.trim(), f.numberCase);
  }
  if (f.numberStyle === 'none') return '';
  return applyCase(`${f.numberPrefix ? f.numberPrefix + ' ' : ''}${formatNumber(n, f.numberStyle)}`.trim(), f.numberCase);
}

export function displayTitle(book, el, nums = computeNumbers(book)) {
  if (el.title) return el.title;
  if (el.type === 'chapter') return nums[el.id] ? `Chapter ${nums[el.id]}` : 'Untitled Chapter';
  return ELEMENT_TYPES[el.type]?.label || 'Untitled';
}

// ---------- text helpers ----------
export function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<\/(p|h\d|li|blockquote|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function countWords(text) {
  const m = text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

export function elementWords(el) {
  if (el.type === 'toc') return 0;
  return countWords(htmlToText(el.content));
}

export function bookWords(book) {
  return book.elements.reduce((s, e) => s + elementWords(e), 0);
}

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Replace {{field}} placeholders inside page templates with book metadata.
export function fillPlaceholders(html, book) {
  const m = book.meta;
  const map = {
    ...m,
    year: m.year || String(new Date().getFullYear()),
    copyrightHolder: m.copyrightHolder || m.author,
    authorUpper: (m.author || '').toUpperCase(),
    titleUpper: (m.title || '').toUpperCase(),
  };
  const sub = (s) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, key) => (key in map ? escapeHtml(map[key] || '') : all));
  // Drop paragraphs whose only dynamic fields are all empty (e.g. no editor named).
  return (html || '').replace(/<(p|li)\b[^>]*>[\s\S]*?<\/\1>/g, (para) => {
    const keys = [...para.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
    if (keys.length && keys.every((k) => k in map && !String(map[k] || '').trim())) return '';
    return sub(para);
  }).replace(/\{\{\s*(\w+)\s*\}\}/g, (all, key) => (key in map ? escapeHtml(map[key] || '') : all));
}

export function fillText(text, book) {
  return (text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (all, key) => (key in book.meta ? book.meta[key] || '' : all));
}
