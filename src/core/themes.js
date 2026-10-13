// Interior formatting: trim sizes, design themes and the default settings.
import { deepMerge } from './util-merge.js';
import { FORMAT_DEFAULTS } from './formatting.js';

export const TRIM_SIZES = [
  { id: '4.25x6.87', label: 'Mass-market paperback', w: 4.25, h: 6.87 },
  { id: '5x8', label: '5 × 8 in — Novella / Fiction', w: 5, h: 8 },
  { id: '5.06x7.81', label: '5.06 × 7.81 in — UK B-format', w: 5.06, h: 7.81 },
  { id: '5.25x8', label: '5.25 × 8 in — Fiction', w: 5.25, h: 8 },
  { id: '5.5x8.5', label: '5.5 × 8.5 in — Digest', w: 5.5, h: 8.5 },
  { id: 'A5', label: 'A5 — 148 × 210 mm', w: 5.827, h: 8.268 },
  { id: '5.83x8.27', label: 'Demy — 5.43 × 8.5 in', w: 5.43, h: 8.5 },
  { id: '6x9', label: '6 × 9 in — US Trade (most popular)', w: 6, h: 9 },
  { id: '6.14x9.21', label: '6.14 × 9.21 in — Royal', w: 6.14, h: 9.21 },
  { id: '6.69x9.61', label: '6.69 × 9.61 in — Pinched crown', w: 6.69, h: 9.61 },
  { id: '7x10', label: '7 × 10 in — Textbook / Workbook', w: 7, h: 10 },
  { id: '7.5x9.25', label: '7.5 × 9.25 in — Executive', w: 7.5, h: 9.25 },
  { id: '8x10', label: '8 × 10 in — Photo / Children', w: 8, h: 10 },
  { id: '8.5x8.5', label: '8.5 × 8.5 in — Square picture book', w: 8.5, h: 8.5 },
  { id: '8.25x6', label: '8.25 × 6 in — Landscape', w: 8.25, h: 6 },
  { id: '8.5x11', label: '8.5 × 11 in — US Letter', w: 8.5, h: 11 },
  { id: 'A4', label: 'A4 — 210 × 297 mm', w: 8.268, h: 11.693 },
  { id: 'custom', label: 'Custom size…', w: 6, h: 9 },
];

export function trimOf(format) {
  if (format.trim === 'custom') return { w: +format.custom.w || 6, h: +format.custom.h || 9 };
  const t = TRIM_SIZES.find((x) => x.id === format.trim) || TRIM_SIZES[7];
  return { w: t.w, h: t.h };
}

export const SCENE_BREAKS = {
  asterism: '⁂',
  stars: '*  *  *',
  dinkus: '• • •',
  fleuron: '❦',
  floral: '❧',
  diamond: '◆',
  tilde: '~',
  line: '',
  blank: '',
};

export const ORNAMENTS = {
  none: '',
  rule: '<span class="orn-rule"></span>',
  'short-rule': '<span class="orn-rule short"></span>',
  'double-rule': '<span class="orn-rule double"></span>',
  diamond: '<span class="orn-glyph">◆</span>',
  fleuron: '<span class="orn-glyph">❦</span>',
  stars: '<span class="orn-glyph">✦ ✦ ✦</span>',
  swirl: '<span class="orn-glyph">⁓ ❧ ⁓</span>',
};

const BASE = {
  theme: 'classic',
  trim: '6x9',
  custom: { w: 6, h: 9 },
  margins: { top: 0.75, bottom: 0.75, inside: 0.875, outside: 0.625 },
  bleed: false,
  bleedSize: 0.125,
  cropMarks: false,
  body: {
    font: 'EB Garamond', size: 11.5, leading: 1.45, align: 'justify', hyphenate: true,
    spacing: 'indent', indent: 1.5, paraGap: 0.7, indentGap: 0, letterSpacing: 0, wordSpacing: 0, color: '#111111',
    keepWithNext: true, hyphenLimit: 2, figures: 'auto', hangPunct: false,
  },
  headings: {
    font: 'EB Garamond', numberFont: '', align: 'center', sink: 1.4, afterSpace: 0.45,
    numberStyle: 'word', numberPrefix: 'Chapter', numberCase: 'upper', numberSize: 11, numberSpacing: 0.18, numberItalic: false, numberPosition: 'above',
    titleSize: 22, titleCase: 'none', titleWeight: 400, titleItalic: false, titleSpacing: 0, titleColor: '#111111',
    subtitleSize: 12.5, subtitleItalic: true,
    ornament: 'short-rule',
    partPrefix: 'Part', partNumberStyle: 'word', partSize: 28,
    h2Size: 15, h3Size: 13, subheadFont: '',
  },
  firstPara: { dropCap: false, dropCapLines: 3, dropCapFont: '', dropCapColor: '', leadIn: 'smallcaps-line', leadWords: 4, indent: false },
  sceneBreak: { style: 'stars', custom: '', noIndentAfter: true },
  header: { show: true, verso: 'author', recto: 'chapter', font: '', size: 8.5, case: 'upper', italic: false, spacing: 0.16, align: 'center' },
  pageNumbers: { position: 'bottom-center', showOnChapterStart: true, frontRoman: true, font: '', size: 9.5, style: 'plain', startAt: 1, color: '' },
  toc: { showNumbers: true, pageNumbers: true, leaders: true, depth: 1, numberStyle: 'smallcaps' },
  layout: { chapterStart: 'right', partStart: 'right', frontStart: 'right', widows: 2, orphans: 2 },
  ebook: { useBookFonts: true, embedFonts: false, justify: false, indent: true, includeToc: true, dropCaps: false, pageList: true },
  ...structuredClone(FORMAT_DEFAULTS),
};

export const THEMES = {
  classic: { label: 'Classic', desc: 'Timeless Garamond with small-caps openings', o: {} },
  literary: {
    label: 'Literary', desc: 'Elegant Cormorant, airy chapter openings',
    o: {
      body: { font: 'Cormorant Garamond', size: 12.5, leading: 1.4 },
      headings: { font: 'Cormorant Garamond', numberStyle: 'numeral', numberPrefix: '', numberSize: 34, titleSize: 18, titleCase: 'upper', titleSpacing: 0.2, ornament: 'none', sink: 1.8 },
      firstPara: { dropCap: false, leadIn: 'smallcaps-words' },
      sceneBreak: { style: 'fleuron' },
    },
  },
  modern: {
    label: 'Modern', desc: 'Clean sans headings over a crisp serif',
    o: {
      body: { font: 'Source Serif 4', size: 10.5, leading: 1.5 },
      headings: { font: 'Montserrat', numberStyle: 'padded', numberPrefix: '', numberSize: 40, numberCase: 'none', titleSize: 16, titleCase: 'upper', titleWeight: 700, titleSpacing: 0.12, align: 'left', ornament: 'rule', sink: 1.2 },
      header: { font: 'Montserrat', size: 7.5, spacing: 0.25 },
      pageNumbers: { position: 'bottom-outside', font: 'Montserrat' },
      firstPara: { leadIn: 'none' },
      sceneBreak: { style: 'dinkus' },
    },
  },
  romance: {
    label: 'Romance', desc: 'Script-inspired flourishes and drop caps',
    o: {
      body: { font: 'Lora', size: 11, leading: 1.5 },
      headings: { font: 'Great Vibes', numberFont: 'Lora', numberStyle: 'word', numberPrefix: 'Chapter', numberCase: 'upper', numberSize: 10, titleSize: 30, ornament: 'swirl' },
      firstPara: { dropCap: true, dropCapLines: 3, dropCapFont: 'Playfair Display', leadIn: 'none' },
      sceneBreak: { style: 'floral' },
    },
  },
  fantasy: {
    label: 'Fantasy', desc: 'Epic Cinzel capitals and ornate breaks',
    o: {
      body: { font: 'Alegreya', size: 11.5, leading: 1.45 },
      headings: { font: 'Cinzel', numberStyle: 'roman', numberPrefix: '', numberSize: 26, titleSize: 19, titleCase: 'upper', titleSpacing: 0.08, ornament: 'diamond', sink: 1.6 },
      firstPara: { dropCap: true, dropCapLines: 3, dropCapFont: 'Cinzel', leadIn: 'smallcaps-line' },
      header: { font: 'Cinzel' },
      sceneBreak: { style: 'asterism' },
    },
  },
  thriller: {
    label: 'Thriller', desc: 'Bold, punchy and condensed',
    o: {
      body: { font: 'Crimson Pro', size: 11.5, leading: 1.4 },
      headings: { font: 'Oswald', numberStyle: 'numeral', numberPrefix: '', numberSize: 54, numberCase: 'upper', titleSize: 15, titleCase: 'upper', titleWeight: 700, titleSpacing: 0.15, ornament: 'none', align: 'left', sink: 1.0 },
      header: { font: 'Oswald', size: 8, spacing: 0.2 },
      firstPara: { leadIn: 'smallcaps-words', leadWords: 3 },
      sceneBreak: { style: 'line' },
    },
  },
  mystery: {
    label: 'Mystery', desc: 'Baskerville with typewriter accents',
    o: {
      body: { font: 'Libre Baskerville', size: 10, leading: 1.55 },
      headings: { font: 'Courier Prime', numberFont: 'Courier Prime', numberStyle: 'padded', numberPrefix: 'No.', numberCase: 'upper', numberSize: 12, titleSize: 18, titleCase: 'upper', titleWeight: 700, ornament: 'double-rule' },
      header: { font: 'Courier Prime' },
      sceneBreak: { style: 'diamond' },
    },
  },
  nonfiction: {
    label: 'Non-fiction', desc: 'Readable, structured, with block paragraphs',
    o: {
      body: { font: 'Merriweather', size: 10, leading: 1.6, align: 'left', hyphenate: false, spacing: 'block', paraGap: 0.8 },
      headings: { font: 'Lato', numberStyle: 'numeral', numberPrefix: 'Chapter', numberCase: 'upper', numberSize: 11, titleSize: 24, titleWeight: 700, align: 'left', ornament: 'rule', sink: 1.0, h2Size: 15, h3Size: 12.5 },
      header: { font: 'Lato', case: 'none', italic: true, spacing: 0 },
      pageNumbers: { position: 'top-outside', font: 'Lato' },
      firstPara: { leadIn: 'none' },
      sceneBreak: { style: 'line' },
    },
  },
  memoir: {
    label: 'Memoir', desc: 'Warm Spectral type with italic headings',
    o: {
      body: { font: 'Spectral', size: 11, leading: 1.5 },
      headings: { font: 'Spectral', numberStyle: 'word', numberPrefix: '', numberCase: 'none', numberItalic: true, numberSize: 14, titleSize: 20, titleItalic: true, ornament: 'fleuron' },
      firstPara: { leadIn: 'smallcaps-words', leadWords: 3 },
      sceneBreak: { style: 'fleuron' },
    },
  },
  children: {
    label: "Children's", desc: 'Large friendly type, generous spacing',
    o: {
      trim: '8x10',
      margins: { top: 0.75, bottom: 0.75, inside: 0.75, outside: 0.75 },
      body: { font: 'Lato', size: 16, leading: 1.6, align: 'left', hyphenate: false },
      headings: { font: 'Abril Fatface', numberStyle: 'numeral', numberPrefix: 'Chapter', numberCase: 'none', numberSize: 16, titleSize: 34, ornament: 'stars' },
      firstPara: { dropCap: true, dropCapFont: 'Abril Fatface', leadIn: 'none' },
      header: { show: false },
      sceneBreak: { style: 'stars' },
    },
  },
  poetry: {
    label: 'Poetry', desc: 'Left-aligned verse with respectful white space',
    o: {
      trim: '5.5x8.5',
      body: { font: 'Cormorant Garamond', size: 12, leading: 1.5, align: 'left', hyphenate: false, spacing: 'block', paraGap: 0.3, indent: 0 },
      headings: { font: 'Cormorant Garamond', numberStyle: 'none', titleSize: 18, titleItalic: true, align: 'left', ornament: 'none', sink: 1.0 },
      firstPara: { leadIn: 'none' },
      layout: { chapterStart: 'any' },
      sceneBreak: { style: 'blank' },
    },
  },
  academic: {
    label: 'Academic', desc: 'Formal, numbered, left-aligned headings',
    o: {
      trim: '7x10',
      body: { font: 'Source Serif 4', size: 10.5, leading: 1.5 },
      headings: { font: 'Source Serif 4', numberStyle: 'numeral', numberPrefix: '', numberCase: 'none', numberSize: 22, numberPosition: 'inline', titleSize: 20, titleWeight: 700, align: 'left', ornament: 'none', sink: 0.6 },
      header: { case: 'none', italic: true, spacing: 0 },
      pageNumbers: { position: 'top-outside' },
      firstPara: { leadIn: 'none' },
    },
  },
};

export function defaultFormat(theme = 'classic') {
  return applyTheme(structuredClone(BASE), theme);
}

export function applyTheme(format, theme) {
  const t = THEMES[theme] || THEMES.classic;
  // Start from the base design, keep the user's trim/margins unless the theme sets them.
  const keep = { trim: format.trim, custom: format.custom, margins: format.margins, bleed: format.bleed, bleedSize: format.bleedSize, cropMarks: format.cropMarks };
  // The author's own styles are referenced by the text, so they survive a theme change.
  const own = Object.fromEntries(['charStyles', 'customParaStyles', 'customCss', 'printLinks', 'captions', 'notes', 'verse'].filter((k) => format[k] !== undefined).map((k) => [k, structuredClone(format[k])]));
  const out = deepMerge(structuredClone(BASE), t.o);
  if (!t.o.trim) Object.assign(out, { trim: keep.trim, custom: keep.custom });
  if (!t.o.margins) out.margins = keep.margins;
  out.bleed = keep.bleed; out.bleedSize = keep.bleedSize; out.cropMarks = keep.cropMarks;
  out.theme = theme in THEMES ? theme : 'classic';
  Object.assign(out, own);
  return out;
}
