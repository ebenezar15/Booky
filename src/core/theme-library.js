// The design library: more than a hundred interior designs, grouped by genre. Each one is a set of overrides on
// Booky's base design (see themes.js), so everything stays editable in Format after it is applied.
//
// D(id, label, category, description, [body font, size, leading], [heading font, number style, number prefix, title size, title case], extras)
// extras: nfont number font · ncase number case · nsize number size · npos number position · nital italic number
//         tw title weight · ti italic title · ts title letter-spacing · al heading alignment · orn ornament · sink chapter sink
//         scene scene break · drop drop cap (dropFont) · lead lead-in (lw words) · hfont/hcase/hital running head · noHeader
//         pn page-number position (pnfont) · trim · block block paragraphs · left ragged-right body · color title colour · sub subhead font
//         h2/h3 subhead sizes · m margins

const D = (id, label, cat, desc, [bf, bs, bl], [hf, ns, pre, size, tc], x = {}) => {
  const o = {
    body: { font: bf, size: bs, leading: bl },
    headings: { font: hf, numberStyle: ns, numberPrefix: pre, titleSize: size, titleCase: tc || 'none' },
    firstPara: {}, sceneBreak: {}, header: {}, pageNumbers: {},
  };
  const H = o.headings;
  if (x.nfont) H.numberFont = x.nfont;
  if (x.ncase) H.numberCase = x.ncase;
  if (x.nsize) H.numberSize = x.nsize;
  if (x.npos) H.numberPosition = x.npos;
  if (x.nital) H.numberItalic = true;
  if (x.tw) H.titleWeight = x.tw;
  if (x.ti) H.titleItalic = true;
  if (x.ts != null) H.titleSpacing = x.ts;
  if (x.al) H.align = x.al;
  if (x.orn) H.ornament = x.orn;
  if (x.sink) H.sink = x.sink;
  if (x.color) H.titleColor = x.color;
  if (x.sub) H.subheadFont = x.sub;
  if (x.h2) H.h2Size = x.h2;
  if (x.h3) H.h3Size = x.h3;
  if (x.scene) o.sceneBreak.style = x.scene;
  if (x.drop) Object.assign(o.firstPara, { dropCap: true, dropCapLines: x.dropLines || 3, dropCapFont: x.dropFont || '' });
  if (x.lead) o.firstPara.leadIn = x.lead;
  if (x.lw) o.firstPara.leadWords = x.lw;
  if (x.hfont) o.header.font = x.hfont;
  if (x.hcase) o.header.case = x.hcase;
  if (x.hital) o.header.italic = true;
  if (x.noHeader) o.header.show = false;
  if (x.pn) o.pageNumbers.position = x.pn;
  if (x.pnfont) o.pageNumbers.font = x.pnfont;
  if (x.trim) o.trim = x.trim;
  if (x.m) o.margins = x.m;
  if (x.block) Object.assign(o.body, { spacing: 'block', paraGap: 0.75 });
  if (x.left) Object.assign(o.body, { align: 'left', hyphenate: false });
  return [id, { label, cat, desc, o }];
};

export const THEME_CATEGORIES = ['Literary', 'Romance', 'Fantasy & Sci-fi', 'Thriller & Mystery', 'Historical', 'Young adult', 'Children', 'Non-fiction', 'Business', 'Self-help', 'Memoir', 'Poetry', 'Academic', 'Faith', 'Cookbook & Lifestyle', 'Classic reprint', 'Modern minimal'];

export const THEME_LIBRARY = Object.fromEntries([
  // ---------- Literary ----------
  D('lit-caslon', 'Caslon House', 'Literary', 'Old-style Caslon, small-caps chapter words', ['Libre Caslon Text', 10.5, 1.5], ['Libre Caslon Text', 'word', 'Chapter', 18], { ncase: 'upper', nsize: 9.5, ts: 0.04, orn: 'short-rule', lead: 'smallcaps-line', scene: 'asterism' }),
  D('lit-quiet', 'Quiet Margins', 'Literary', 'Understated Crimson with numerals and air', ['Crimson Pro', 12, 1.45], ['Crimson Pro', 'numeral', '', 16], { nsize: 30, orn: 'none', sink: 2, lead: 'smallcaps-words', lw: 3, scene: 'blank' }),
  D('lit-goudy', 'Goudy Press', 'Literary', 'Warm private-press texture', ['Sorts Mill Goudy', 11.5, 1.45], ['Sorts Mill Goudy', 'word', '', 20], { ncase: 'none', nital: true, nsize: 14, orn: 'fleuron', lead: 'smallcaps-line', scene: 'fleuron' }),
  D('lit-newsreader', 'Newsreader Novel', 'Literary', 'Contemporary serif, left-set titles', ['Newsreader', 11, 1.5], ['Newsreader', 'numeral', '', 20], { al: 'left', nsize: 26, orn: 'rule', ti: true, lead: 'none', scene: 'dinkus' }),
  D('lit-spectral-caps', 'Spectral Capitals', 'Literary', 'Wide-spaced capitals over Spectral', ['Spectral', 10.5, 1.5], ['Spectral', 'roman', '', 15, 'upper'], { ts: 0.25, nsize: 20, orn: 'short-rule', lead: 'smallcaps-words', scene: 'stars' }),
  D('lit-instrument', 'Instrument', 'Literary', 'Elegant display italics, modern restraint', ['Literata', 10.5, 1.5], ['Instrument Serif', 'numeral', '', 30], { ti: true, nfont: 'Literata', nsize: 11, orn: 'none', lead: 'smallcaps-line', scene: 'dinkus' }),
  D('lit-vollkorn', 'Vollkorn Story', 'Literary', 'Sturdy, dark and highly readable', ['Vollkorn', 11, 1.45], ['Vollkorn', 'word', 'Chapter', 19], { ncase: 'upper', nsize: 10, orn: 'diamond', lead: 'smallcaps-line', scene: 'diamond' }),
  D('lit-gentium', 'Gentium Book', 'Literary', 'Calligraphic serif with a soft rhythm', ['Gentium Book Plus', 11, 1.5], ['Gentium Book Plus', 'word', '', 18], { ncase: 'none', ti: true, orn: 'swirl', scene: 'floral', lead: 'smallcaps-words', lw: 4 }),

  // ---------- Romance ----------
  D('rom-vibes', 'Love Letters', 'Romance', 'Great Vibes titles, Lora text', ['Lora', 11, 1.5], ['Great Vibes', 'word', 'Chapter', 34], { nfont: 'Lora', ncase: 'upper', nsize: 9, orn: 'swirl', drop: true, dropFont: 'Great Vibes', lead: 'none', scene: 'floral' }),
  D('rom-blush', 'Blush', 'Romance', 'Soft Playfair italics and hearts of white space', ['Crimson Text', 11.5, 1.45], ['Playfair Display', 'word', '', 26], { ti: true, ncase: 'none', nsize: 12, nital: true, orn: 'fleuron', drop: true, dropFont: 'Playfair Display', scene: 'fleuron', color: '#7a2848' }),
  D('rom-regency', 'Regency', 'Romance', 'Bodoni glamour for historical romance', ['Libre Baskerville', 10, 1.55], ['Bodoni Moda', 'word', 'Chapter', 24, 'upper'], { ts: 0.12, nsize: 10, orn: 'double-rule', drop: true, dropFont: 'Bodoni Moda', scene: 'diamond' }),
  D('rom-satisfy', 'Sweet Script', 'Romance', 'Breezy script numbers, airy body', ['Lato', 11, 1.55], ['Satisfy', 'numeral', 'Chapter', 30], { nfont: 'Lato', nsize: 10, ncase: 'upper', orn: 'stars', scene: 'stars', lead: 'none', left: true }),
  D('rom-dm', 'Modern Romance', 'Romance', 'DM Serif display with clean sans heads', ['Lora', 11, 1.5], ['DM Serif Display', 'numeral', '', 30], { nfont: 'Montserrat', nsize: 11, orn: 'short-rule', hfont: 'Montserrat', drop: true, dropFont: 'DM Serif Display', scene: 'dinkus' }),
  D('rom-dancing', 'Dancing Hearts', 'Romance', 'Playful script titles for rom-coms', ['Nunito', 11, 1.55], ['Dancing Script', 'word', 'Chapter', 30], { nfont: 'Nunito', ncase: 'upper', nsize: 9, tw: 700, orn: 'swirl', scene: 'floral', left: true }),
  D('rom-gilda', 'Gilded', 'Romance', 'Gilda Display capitals, champagne elegance', ['Cormorant Garamond', 13, 1.35], ['Gilda Display', 'roman', '', 20, 'upper'], { ts: 0.18, nsize: 18, orn: 'diamond', drop: true, dropFont: 'Gilda Display', scene: 'asterism' }),

  // ---------- Fantasy & Sci-fi ----------
  D('fan-marcellus', 'Stone Gate', 'Fantasy & Sci-fi', 'Roman inscriptional capitals', ['Alegreya', 11.5, 1.45], ['Marcellus', 'roman', 'Chapter', 20, 'upper'], { ts: 0.12, nsize: 11, ncase: 'upper', orn: 'diamond', drop: true, dropFont: 'Marcellus', hfont: 'Marcellus', scene: 'asterism' }),
  D('fan-cardo', 'Old Tongue', 'Fantasy & Sci-fi', 'Cardo for epics with glossaries and runes', ['Cardo', 11, 1.5], ['Cinzel', 'word', '', 18, 'upper'], { ts: 0.1, nsize: 12, nfont: 'Cardo', nital: true, ncase: 'none', orn: 'swirl', drop: true, dropFont: 'Cinzel', scene: 'fleuron' }),
  D('fan-fraunces', 'Fable', 'Fantasy & Sci-fi', 'Soft wonky Fraunces for cosy fantasy', ['Literata', 11, 1.5], ['Fraunces', 'word', 'Chapter', 26], { ncase: 'upper', nsize: 10, ti: true, orn: 'stars', drop: true, dropFont: 'Fraunces', scene: 'stars' }),
  D('fan-starship', 'Starship', 'Fantasy & Sci-fi', 'Wide geometric heads for space opera', ['IBM Plex Serif', 10.5, 1.5], ['Outfit', 'padded', '', 18, 'upper'], { ts: 0.3, nsize: 44, tw: 700, al: 'left', orn: 'rule', hfont: 'Outfit', pnfont: 'Outfit', pn: 'bottom-outside', lead: 'none', scene: 'line' }),
  D('fan-cyber', 'Neon City', 'Fantasy & Sci-fi', 'Mono numbering for cyberpunk', ['Source Serif 4', 10.5, 1.5], ['Spline Sans', 'padded', '//', 17, 'upper'], { nfont: 'JetBrains Mono', ts: 0.15, nsize: 14, al: 'left', tw: 700, orn: 'none', hfont: 'JetBrains Mono', pnfont: 'JetBrains Mono', lead: 'none', scene: 'line' }),
  D('fan-saga', 'Saga', 'Fantasy & Sci-fi', 'Heavy roman numerals, chronicle feel', ['EB Garamond', 12, 1.42], ['Cinzel', 'roman', '', 22, 'upper'], { nsize: 40, ts: 0.05, orn: 'double-rule', drop: true, dropLines: 4, dropFont: 'Cinzel', hfont: 'Cinzel', scene: 'diamond' }),
  D('fan-fairy', 'Fairy Court', 'Fantasy & Sci-fi', 'Delicate Cormorant with flourishes', ['Cormorant Garamond', 13, 1.35], ['Cormorant Garamond', 'word', '', 26], { ti: true, ncase: 'upper', nsize: 10, orn: 'swirl', drop: true, dropFont: 'Great Vibes', scene: 'floral' }),
  D('fan-dystopia', 'Dystopia', 'Fantasy & Sci-fi', 'Stark Bebas numbers, cold sans', ['PT Serif', 10.5, 1.5], ['Bebas Neue', 'padded', '', 30], { nsize: 64, al: 'left', ts: 0.06, orn: 'none', hfont: 'Bebas Neue', hcase: 'upper', lead: 'none', scene: 'line' }),

  // ---------- Thriller & Mystery ----------
  D('thr-anton', 'Pulse', 'Thriller & Mystery', 'Anton numerals that hit hard', ['Crimson Pro', 11.5, 1.4], ['Anton', 'numeral', '', 16, 'upper'], { nsize: 72, ts: 0.1, al: 'left', orn: 'none', hfont: 'Oswald', lead: 'smallcaps-words', lw: 3, scene: 'line' }),
  D('thr-dossier', 'Dossier', 'Thriller & Mystery', 'Typewritten case-file headings', ['PT Serif', 10.5, 1.5], ['Special Elite', 'padded', 'File', 16, 'upper'], { nfont: 'Special Elite', nsize: 12, al: 'left', orn: 'rule', hfont: 'Special Elite', lead: 'none', scene: 'diamond' }),
  D('thr-noir', 'Noir', 'Thriller & Mystery', 'Bodoni contrast for crime fiction', ['Libre Bodoni', 10.5, 1.5], ['Bodoni Moda', 'numeral', '', 22, 'upper'], { nsize: 48, ts: 0.08, orn: 'short-rule', lead: 'smallcaps-line', scene: 'stars' }),
  D('thr-cozy', 'Cosy Mystery', 'Thriller & Mystery', 'Friendly serifs for village whodunnits', ['Gelasio', 11, 1.5], ['Young Serif', 'word', 'Chapter', 22], { ncase: 'upper', nsize: 10, orn: 'fleuron', drop: true, dropFont: 'Young Serif', scene: 'fleuron' }),
  D('thr-legal', 'Courtroom', 'Thriller & Mystery', 'Sober Franklin heads over Charter-like serif', ['Merriweather', 10, 1.55], ['Libre Franklin', 'numeral', '', 18, 'upper'], { tw: 700, ts: 0.08, nsize: 36, al: 'left', orn: 'rule', hfont: 'Libre Franklin', lead: 'none', scene: 'dinkus' }),
  D('thr-spy', 'Cipher', 'Thriller & Mystery', 'Condensed and clipped, built for pace', ['Tinos', 11, 1.4], ['Oswald', 'padded', '', 20, 'upper'], { nfont: 'Courier Prime', nsize: 14, tw: 700, ts: 0.2, orn: 'double-rule', hfont: 'Oswald', pn: 'bottom-outside', scene: 'line' }),
  D('thr-gothic', 'Gothic', 'Thriller & Mystery', 'Dark, ornate, old-world horror', ['Cormorant Garamond', 12.5, 1.4], ['Cinzel', 'roman', '', 20], { nsize: 30, orn: 'diamond', drop: true, dropFont: 'Cinzel', ti: false, lead: 'smallcaps-line', scene: 'asterism', color: '#3a0d0d' }),

  // ---------- Historical ----------
  D('his-baskerville', 'Baskerville 1757', 'Historical', 'Georgian elegance', ['Libre Baskerville', 10, 1.55], ['Libre Baskerville', 'roman', 'Chapter', 17], { ncase: 'upper', nsize: 10, ti: true, orn: 'double-rule', lead: 'smallcaps-line', scene: 'asterism' }),
  D('his-oldstandard', 'Victorian', 'Historical', 'Old Standard with period flourishes', ['Old Standard TT', 10.5, 1.5], ['Old Standard TT', 'roman', 'Chapter', 18, 'upper'], { nsize: 11, ncase: 'upper', ts: 0.08, orn: 'swirl', drop: true, dropFont: 'Old Standard TT', scene: 'fleuron' }),
  D('his-unna', 'Ledger', 'Historical', 'Unna serif and inscriptional heads', ['Unna', 12, 1.45], ['Marcellus', 'word', '', 18, 'upper'], { ts: 0.1, nsize: 11, ncase: 'upper', orn: 'short-rule', lead: 'smallcaps-words', scene: 'diamond' }),
  D('his-war', 'Dispatches', 'Historical', 'Wartime typewriter and stencil feel', ['Crimson Text', 11.5, 1.45], ['Courier Prime', 'numeral', '', 18, 'upper'], { nsize: 30, al: 'left', orn: 'rule', hfont: 'Courier Prime', scene: 'line' }),
  D('his-saga', 'Family Saga', 'Historical', 'Generous Garamond with dated parts', ['EB Garamond', 12, 1.45], ['Playfair Display', 'word', '', 22], { ncase: 'upper', nsize: 10, ti: true, orn: 'fleuron', drop: true, dropFont: 'Playfair Display', scene: 'floral' }),
  D('his-prata', 'Belle Époque', 'Historical', 'Didone headings, Parisian poise', ['Libre Bodoni', 10.5, 1.5], ['Prata', 'roman', '', 22], { nsize: 16, orn: 'diamond', drop: true, dropFont: 'Prata', scene: 'asterism' }),

  // ---------- Young adult ----------
  D('ya-poppins', 'Bold Voice', 'Young adult', 'Poppins headings, modern and loud', ['Lora', 11, 1.5], ['Poppins', 'numeral', '', 20, 'upper'], { tw: 700, ts: 0.05, nsize: 50, al: 'left', orn: 'none', hfont: 'Poppins', pnfont: 'Poppins', lead: 'none', scene: 'dinkus' }),
  D('ya-diary', 'Diary', 'Young adult', 'Handwritten chapter titles', ['Nunito', 11, 1.6], ['Caveat', 'numeral', 'Day', 32], { nfont: 'Caveat', nsize: 18, ncase: 'none', al: 'left', orn: 'none', lead: 'none', left: true, scene: 'stars' }),
  D('ya-outfit', 'Neon', 'Young adult', 'Rounded geometric heads, bright energy', ['Source Serif 4', 10.5, 1.55], ['Outfit', 'padded', '', 22], { tw: 700, nsize: 40, orn: 'short-rule', hfont: 'Outfit', drop: true, dropFont: 'Outfit', scene: 'dinkus', color: '#4c1d95' }),
  D('ya-academy', 'Academy', 'Young adult', 'Magic-school crest styling', ['Alegreya', 11, 1.5], ['Cinzel', 'word', 'Chapter', 18, 'upper'], { nsize: 10, ncase: 'upper', ts: 0.1, orn: 'stars', drop: true, dropFont: 'Cinzel', scene: 'stars' }),
  D('ya-josefin', 'Polaroid', 'Young adult', 'Josefin Sans, light and nostalgic', ['Crimson Pro', 12, 1.45], ['Josefin Sans', 'numeral', '', 22, 'upper'], { ts: 0.2, nsize: 34, orn: 'rule', hfont: 'Josefin Sans', lead: 'smallcaps-words', scene: 'dinkus' }),
  D('ya-verse', 'Verse Novel', 'Young adult', 'Left-set lines for novels in verse', ['Literata', 11, 1.55], ['Figtree', 'numeral', '', 18], { al: 'left', tw: 700, nsize: 20, orn: 'none', left: true, block: true, lead: 'none', scene: 'blank' }),

  // ---------- Children ----------
  D('kid-quicksand', 'Bedtime', 'Children', 'Big rounded type for reading aloud', ['Quicksand', 16, 1.6], ['Fraunces', 'numeral', 'Chapter', 34], { tw: 700, ncase: 'none', nsize: 16, orn: 'stars', drop: true, dropFont: 'Fraunces', noHeader: true, trim: '8x10', left: true, scene: 'stars' }),
  D('kid-chapter', 'First Chapter Book', 'Children', 'Friendly serif for early readers', ['Gelasio', 14, 1.6], ['Nunito', 'word', 'Chapter', 26], { tw: 700, ncase: 'none', nsize: 14, orn: 'stars', drop: true, dropFont: 'Nunito', trim: '5.5x8.5', left: true, scene: 'stars' }),
  D('kid-lobster', 'Funfair', 'Children', 'Lobster titles for adventures', ['Lato', 14, 1.6], ['Lobster', 'numeral', 'Chapter', 34], { nfont: 'Lato', nsize: 14, ncase: 'none', orn: 'swirl', noHeader: true, trim: '7x10', left: true, scene: 'stars', color: '#b45309' }),
  D('kid-picture', 'Picture Book', 'Children', 'Square page, huge friendly type', ['Nunito', 20, 1.5], ['Fraunces', 'none', '', 40], { orn: 'none', noHeader: true, pn: 'none', trim: '8.5x8.5', left: true, scene: 'blank', m: { top: 0.6, bottom: 0.6, inside: 0.6, outside: 0.6 } }),
  D('kid-pacifico', 'Treehouse', 'Children', 'Pacifico chapter titles, bouncy feel', ['Nunito Sans', 14, 1.6], ['Pacifico', 'numeral', '', 30], { nfont: 'Nunito Sans', nsize: 28, tw: 400, orn: 'stars', noHeader: true, trim: '6x9', left: true, scene: 'stars' }),
  D('kid-middle', 'Middle Grade', 'Children', 'Readable serif, sans chapter numbers', ['Literata', 12.5, 1.55], ['Figtree', 'numeral', 'Chapter', 24], { tw: 700, ncase: 'upper', nsize: 11, orn: 'short-rule', drop: true, dropFont: 'Figtree', left: true, scene: 'dinkus' }),

  // ---------- Non-fiction ----------
  D('nf-plex', 'Plex', 'Non-fiction', 'IBM Plex pair: engineered and clear', ['IBM Plex Serif', 10, 1.6], ['IBM Plex Sans', 'numeral', 'Chapter', 22], { tw: 700, ncase: 'upper', nsize: 10, al: 'left', orn: 'rule', hfont: 'IBM Plex Sans', sub: 'IBM Plex Sans', block: true, left: true, lead: 'none', scene: 'line' }),
  D('nf-journalism', 'Longform', 'Non-fiction', 'Magazine-style narrative non-fiction', ['Newsreader', 11, 1.5], ['Playfair Display', 'numeral', '', 26], { tw: 700, nsize: 14, nfont: 'Libre Franklin', al: 'left', orn: 'rule', hfont: 'Libre Franklin', lead: 'smallcaps-words', scene: 'dinkus' }),
  D('nf-history', 'History', 'Non-fiction', 'Scholarly Baskerville, centred titles', ['Libre Baskerville', 10, 1.55], ['Libre Baskerville', 'numeral', 'Chapter', 20], { ncase: 'upper', nsize: 10, ti: true, orn: 'short-rule', sub: 'Libre Baskerville', lead: 'smallcaps-line', scene: 'asterism' }),
  D('nf-science', 'Popular Science', 'Non-fiction', 'Clean Source pair with numbered heads', ['Source Serif 4', 10.5, 1.55], ['Source Sans 3', 'numeral', '', 22], { tw: 700, nsize: 40, al: 'left', orn: 'none', hfont: 'Source Sans 3', sub: 'Source Sans 3', lead: 'none', scene: 'line' }),
  D('nf-travel', 'Travel Journal', 'Non-fiction', 'Wanderlust headings with place names', ['Lora', 11, 1.55], ['Josefin Sans', 'word', '', 24, 'upper'], { ts: 0.25, nsize: 10, ncase: 'upper', orn: 'stars', drop: true, dropFont: 'Playfair Display', scene: 'stars' }),
  D('nf-nature', 'Field Notes', 'Non-fiction', 'Natural history, quiet and precise', ['Crimson Pro', 11.5, 1.45], ['Crimson Pro', 'numeral', '', 22], { ti: true, nsize: 28, al: 'left', orn: 'short-rule', sub: 'Crimson Pro', lead: 'smallcaps-words', scene: 'fleuron' }),
  D('nf-truecrime', 'True Crime', 'Non-fiction', 'Evidence-board urgency', ['PT Serif', 10.5, 1.5], ['Archivo', 'padded', '', 20, 'upper'], { tw: 700, ts: 0.08, nsize: 48, al: 'left', orn: 'rule', hfont: 'Archivo', lead: 'none', scene: 'line' }),

  // ---------- Business ----------
  D('biz-executive', 'Executive', 'Business', 'Confident Montserrat over Merriweather', ['Merriweather', 10, 1.6], ['Montserrat', 'numeral', 'Chapter', 24], { tw: 700, ncase: 'upper', nsize: 10, al: 'left', orn: 'rule', hfont: 'Montserrat', sub: 'Montserrat', block: true, left: true, lead: 'none', pn: 'bottom-outside', scene: 'line' }),
  D('biz-startup', 'Startup', 'Business', 'Manrope and Inter, product-book clean', ['Inter', 10, 1.6], ['Manrope', 'padded', '', 26], { tw: 700, nsize: 48, al: 'left', orn: 'none', hfont: 'Manrope', sub: 'Manrope', block: true, left: true, lead: 'none', pn: 'bottom-outside', scene: 'line', color: '#1e3a8a' }),
  D('biz-jakarta', 'Keynote', 'Business', 'Plus Jakarta Sans for talks turned books', ['Source Serif 4', 10.5, 1.55], ['Plus Jakarta Sans', 'numeral', '', 26], { tw: 700, nsize: 14, nfont: 'Plus Jakarta Sans', al: 'left', orn: 'short-rule', hfont: 'Plus Jakarta Sans', sub: 'Plus Jakarta Sans', lead: 'none', scene: 'dinkus' }),
  D('biz-finance', 'Finance', 'Business', 'Formal Libre Franklin and Tinos', ['Tinos', 10.5, 1.55], ['Libre Franklin', 'numeral', 'Chapter', 22], { tw: 700, ncase: 'upper', nsize: 10, al: 'left', orn: 'double-rule', hfont: 'Libre Franklin', sub: 'Libre Franklin', block: true, lead: 'none', pn: 'top-outside', scene: 'line' }),
  D('biz-leadership', 'Leadership', 'Business', 'Classic authority with modern heads', ['EB Garamond', 11.5, 1.5], ['DM Sans', 'numeral', '', 24, 'upper'], { tw: 700, ts: 0.06, nsize: 12, nfont: 'DM Sans', orn: 'rule', hfont: 'DM Sans', sub: 'DM Sans', lead: 'smallcaps-words', scene: 'dinkus' }),
  D('biz-marketing', 'Playbook', 'Business', 'Punchy Archivo headings, block paragraphs', ['Figtree', 10.5, 1.6], ['Archivo', 'padded', 'Play', 24, 'upper'], { tw: 700, nsize: 12, ncase: 'upper', al: 'left', orn: 'none', hfont: 'Archivo', block: true, left: true, lead: 'none', scene: 'line', color: '#c2410c' }),

  // ---------- Self-help ----------
  D('sh-calm', 'Calm', 'Self-help', 'Soft Mulish and Lora, lots of breathing room', ['Lora', 11, 1.65], ['Mulish', 'numeral', '', 24], { tw: 400, nsize: 36, orn: 'short-rule', hfont: 'Mulish', sub: 'Mulish', block: true, left: true, lead: 'none', scene: 'blank', color: '#0f766e' }),
  D('sh-avenir', 'Clarity', 'Self-help', 'Avenir-style Urbanist, warm and clear', ['Literata', 10.5, 1.6], ['Urbanist', 'numeral', 'Step', 26], { tw: 700, ncase: 'upper', nsize: 11, al: 'left', orn: 'rule', hfont: 'Urbanist', sub: 'Urbanist', left: true, lead: 'none', scene: 'dinkus' }),
  D('sh-wellness', 'Wellness', 'Self-help', 'Gentle Nunito Sans and airy margins', ['Nunito Sans', 11, 1.65], ['Fraunces', 'numeral', '', 28], { ti: true, nsize: 16, nfont: 'Nunito Sans', orn: 'stars', hfont: 'Nunito Sans', block: true, left: true, lead: 'none', scene: 'stars' }),
  D('sh-habit', 'Habits', 'Self-help', 'Numbered lessons, bold sans', ['Merriweather', 10, 1.6], ['Poppins', 'padded', 'Lesson', 24], { tw: 700, nsize: 11, ncase: 'upper', al: 'left', orn: 'none', hfont: 'Poppins', sub: 'Poppins', block: true, left: true, lead: 'none', scene: 'line' }),
  D('sh-journal', 'Guided Journal', 'Self-help', 'Handwritten prompts, large trim', ['Nunito', 12, 1.7], ['Caveat', 'numeral', 'Week', 34], { nfont: 'Nunito', nsize: 11, ncase: 'upper', orn: 'rule', trim: '7x10', left: true, block: true, lead: 'none', scene: 'line' }),
  D('sh-mindful', 'Mindful', 'Self-help', 'Light Raleway headings, centred calm', ['Crimson Pro', 12, 1.55], ['Raleway', 'word', '', 20, 'upper'], { ts: 0.3, nsize: 10, ncase: 'upper', orn: 'none', hfont: 'Raleway', lead: 'none', scene: 'blank' }),

  // ---------- Memoir ----------
  D('mem-letters', 'Letters Home', 'Memoir', 'Intimate Spectral with italic numbers', ['Spectral', 11, 1.55], ['Spectral', 'word', '', 20], { ncase: 'none', nital: true, ti: true, orn: 'fleuron', lead: 'smallcaps-words', lw: 3, scene: 'fleuron' }),
  D('mem-dates', 'Years', 'Memoir', 'Chapters headed by year, Prata numerals', ['EB Garamond', 12, 1.45], ['Prata', 'none', '', 26], { orn: 'short-rule', lead: 'smallcaps-line', scene: 'asterism' }),
  D('mem-polaroid', 'Snapshot', 'Memoir', 'Casual sans titles for personal essays', ['Lora', 11, 1.55], ['Work Sans', 'numeral', '', 20], { nsize: 30, al: 'left', orn: 'none', hfont: 'Work Sans', lead: 'none', scene: 'dinkus' }),
  D('mem-heritage', 'Heritage', 'Memoir', 'Family history with ornate openings', ['Cardo', 11, 1.5], ['Cormorant Garamond', 'word', '', 26], { ti: true, ncase: 'upper', nsize: 10, orn: 'swirl', drop: true, dropFont: 'Cormorant Garamond', scene: 'floral' }),
  D('mem-biography', 'Biography', 'Memoir', 'Sober Gelasio with roman numerals', ['Gelasio', 10.5, 1.55], ['Gelasio', 'roman', '', 20], { nsize: 22, orn: 'rule', lead: 'smallcaps-line', scene: 'asterism' }),
  D('mem-gilda', 'Portrait', 'Memoir', 'Gilda Display titles, refined and personal', ['Crimson Text', 11.5, 1.5], ['Gilda Display', 'word', 'Chapter', 24], { ncase: 'upper', nsize: 9, orn: 'short-rule', lead: 'smallcaps-words', scene: 'dinkus' }),

  // ---------- Poetry ----------
  D('poe-minimal', 'White Space', 'Poetry', 'Left-set verse, titles in small italics', ['EB Garamond', 12, 1.5], ['EB Garamond', 'none', '', 15], { ti: true, al: 'left', orn: 'none', sink: 1, block: true, left: true, lead: 'none', trim: '5.5x8.5', scene: 'blank' }),
  D('poe-centered', 'Centred Verse', 'Poetry', 'Centred titles with ornaments', ['Cormorant Garamond', 12.5, 1.45], ['Cormorant Garamond', 'none', '', 18, 'upper'], { ts: 0.2, orn: 'fleuron', block: true, left: true, lead: 'none', trim: '5.5x8.5', scene: 'fleuron' }),
  D('poe-modern', 'Modern Verse', 'Poetry', 'Sans titles, generous leading', ['Literata', 11, 1.6], ['Josefin Sans', 'none', '', 14, 'upper'], { ts: 0.25, al: 'left', orn: 'none', block: true, left: true, lead: 'none', trim: '5x8', scene: 'blank' }),
  D('poe-numbered', 'Sequence', 'Poetry', 'Numbered poems in roman numerals', ['Crimson Pro', 12, 1.5], ['Crimson Pro', 'roman', '', 14], { nsize: 16, ti: true, orn: 'none', block: true, left: true, lead: 'none', trim: '5.5x8.5', scene: 'blank' }),
  D('poe-instrument', 'Chapbook', 'Poetry', 'Instrument Serif italics for slim collections', ['Libre Caslon Text', 10.5, 1.55], ['Instrument Serif', 'none', '', 24], { ti: true, orn: 'none', block: true, left: true, lead: 'none', trim: '5x8', scene: 'blank' }),
  D('poe-haiku', 'Haiku', 'Poetry', 'Small format, one short poem a page', ['Cormorant Garamond', 14, 1.5], ['Cormorant Garamond', 'none', '', 13, 'upper'], { ts: 0.3, orn: 'none', noHeader: true, block: true, left: true, lead: 'none', trim: '4.25x6.87', scene: 'blank' }),

  // ---------- Academic ----------
  D('acad-thesis', 'Thesis', 'Academic', 'Numbered, left-aligned, footnote-friendly', ['Tinos', 11, 1.6], ['Tinos', 'numeral', '', 18], { tw: 700, npos: 'inline', nsize: 18, al: 'left', orn: 'none', sink: 0.5, hital: true, hcase: 'none', pn: 'top-outside', lead: 'none', scene: 'line', trim: '8.5x11' }),
  D('acad-press', 'University Press', 'Academic', 'Classic monograph styling', ['EB Garamond', 11, 1.5], ['EB Garamond', 'numeral', '', 20], { npos: 'inline', nsize: 20, ti: true, al: 'left', orn: 'none', hital: true, hcase: 'none', lead: 'smallcaps-line', scene: 'asterism' }),
  D('acad-textbook', 'Textbook', 'Academic', 'Bold sans heads, block paragraphs, 7 × 10', ['Source Serif 4', 10.5, 1.55], ['Source Sans 3', 'numeral', 'Chapter', 26], { tw: 700, ncase: 'upper', nsize: 11, al: 'left', orn: 'rule', hfont: 'Source Sans 3', sub: 'Source Sans 3', block: true, lead: 'none', trim: '7x10', scene: 'line', h2: 17, h3: 13.5 }),
  D('acad-legal', 'Law Review', 'Academic', 'Caladea and Carlito, court-ready', ['Caladea', 11, 1.55], ['Carlito', 'numeral', 'Part', 20], { tw: 700, ncase: 'upper', nsize: 11, al: 'left', orn: 'none', hfont: 'Carlito', sub: 'Carlito', lead: 'none', pn: 'bottom-center', scene: 'line' }),
  D('acad-humanities', 'Humanities', 'Academic', 'Cardo with Greek-ready glyphs', ['Cardo', 11, 1.55], ['Cardo', 'numeral', '', 20], { npos: 'inline', nsize: 20, al: 'left', orn: 'short-rule', ti: true, lead: 'smallcaps-line', scene: 'asterism' }),
  D('acad-medical', 'Clinical', 'Academic', 'Noto pair for multilingual reference works', ['Noto Serif', 10, 1.55], ['Noto Sans', 'numeral', '', 22], { tw: 700, nsize: 22, npos: 'inline', al: 'left', orn: 'rule', hfont: 'Noto Sans', sub: 'Noto Sans', block: true, lead: 'none', trim: '7x10', scene: 'line' }),

  // ---------- Faith ----------
  D('faith-devotional', 'Devotional', 'Faith', 'Gentle Cormorant, a reading for each day', ['Cormorant Garamond', 13, 1.45], ['Cormorant Garamond', 'word', 'Day', 22], { ncase: 'upper', nsize: 10, ti: true, orn: 'fleuron', drop: true, dropFont: 'Cormorant Garamond', scene: 'fleuron' }),
  D('faith-scripture', 'Scripture Study', 'Faith', 'Readable Gentium with sans section heads', ['Gentium Book Plus', 11, 1.55], ['Lato', 'numeral', 'Lesson', 22], { tw: 700, ncase: 'upper', nsize: 10, orn: 'short-rule', hfont: 'Lato', sub: 'Lato', block: true, lead: 'none', scene: 'line' }),
  D('faith-sermon', 'Sermons', 'Faith', 'Traditional Garamond with crosses of white space', ['EB Garamond', 12, 1.5], ['Cinzel', 'roman', '', 18, 'upper'], { nsize: 14, ts: 0.1, orn: 'diamond', lead: 'smallcaps-line', scene: 'asterism' }),
  D('faith-prayer', 'Prayer Book', 'Faith', 'Small trim, red titles, calm rhythm', ['Cardo', 11, 1.5], ['Cardo', 'none', '', 18], { ti: true, orn: 'fleuron', trim: '5x8', color: '#8b1a1a', lead: 'smallcaps-words', scene: 'fleuron' }),
  D('faith-hymn', 'Hymnal', 'Faith', 'Numbered hymns and verses', ['Crimson Text', 11.5, 1.45], ['Crimson Text', 'numeral', 'Hymn', 16, 'upper'], { nsize: 11, ncase: 'upper', ts: 0.08, orn: 'none', block: true, left: true, lead: 'none', scene: 'blank' }),

  // ---------- Cookbook & Lifestyle ----------
  D('cook-kitchen', 'Kitchen Table', 'Cookbook & Lifestyle', 'Recipe headings in Young Serif', ['Nunito Sans', 10.5, 1.55], ['Young Serif', 'none', '', 26], { al: 'left', orn: 'rule', hfont: 'Nunito Sans', sub: 'Nunito Sans', block: true, left: true, lead: 'none', trim: '8x10', scene: 'line', color: '#9a3412' }),
  D('cook-bistro', 'Bistro', 'Cookbook & Lifestyle', 'Elegant Playfair and Montserrat', ['Montserrat', 10, 1.6], ['Playfair Display', 'none', '', 28], { ti: true, orn: 'short-rule', hfont: 'Montserrat', sub: 'Montserrat', block: true, left: true, lead: 'none', trim: '7.5x9.25', scene: 'dinkus' }),
  D('cook-garden', 'Garden', 'Cookbook & Lifestyle', 'Fresh Figtree with handwritten notes', ['Figtree', 10.5, 1.6], ['Caveat', 'none', '', 36], { tw: 700, al: 'left', orn: 'none', hfont: 'Figtree', sub: 'Figtree', block: true, left: true, lead: 'none', trim: '8x10', scene: 'stars', color: '#166534' }),
  D('cook-bakery', 'Bakery', 'Cookbook & Lifestyle', 'Sweet Lobster titles', ['Quicksand', 11, 1.6], ['Lobster', 'none', '', 32], { orn: 'swirl', hfont: 'Quicksand', sub: 'Quicksand', block: true, left: true, lead: 'none', trim: '8x10', scene: 'stars', color: '#be185d' }),
  D('cook-craft', 'Handmade', 'Cookbook & Lifestyle', 'Craft and DIY: clear steps, friendly heads', ['Karla', 10.5, 1.6], ['Fraunces', 'numeral', 'Project', 26], { tw: 700, ncase: 'upper', nsize: 10, al: 'left', orn: 'none', hfont: 'Karla', sub: 'Karla', block: true, left: true, lead: 'none', trim: '8x10', scene: 'line' }),
  D('cook-photo', 'Coffee Table', 'Cookbook & Lifestyle', 'Large landscape-friendly display type', ['Mulish', 11, 1.6], ['Bodoni Moda', 'none', '', 34, 'upper'], { ts: 0.12, orn: 'none', hfont: 'Mulish', block: true, left: true, lead: 'none', trim: '8.5x11', scene: 'blank' }),

  // ---------- Classic reprint ----------
  D('cls-penguin', 'Paperback Classic', 'Classic reprint', 'Mass-market classics edition', ['Tinos', 10, 1.4], ['Tinos', 'roman', 'Chapter', 13, 'upper'], { nsize: 10, ncase: 'upper', ts: 0.15, orn: 'none', sink: 0.8, lead: 'none', trim: '5.06x7.81', scene: 'stars' }),
  D('cls-library', 'Library Edition', 'Classic reprint', 'Hardback-style with drop caps', ['EB Garamond', 11.5, 1.45], ['EB Garamond', 'roman', 'Chapter', 16, 'upper'], { nsize: 11, ncase: 'upper', ts: 0.12, orn: 'double-rule', drop: true, dropLines: 2, dropFont: 'EB Garamond', scene: 'asterism' }),
  D('cls-folio', 'Folio', 'Classic reprint', 'Fine-press Caslon and swashes', ['Libre Caslon Text', 10.5, 1.5], ['Cormorant Garamond', 'word', '', 26], { ti: true, ncase: 'upper', nsize: 10, orn: 'swirl', drop: true, dropFont: 'Cormorant Garamond', scene: 'floral' }),
  D('cls-everyman', 'Everyman', 'Classic reprint', 'Plain and sturdy, PT Serif', ['PT Serif', 10.5, 1.5], ['PT Serif', 'roman', '', 16], { nsize: 18, orn: 'rule', lead: 'smallcaps-line', scene: 'dinkus' }),
  D('cls-pocket', 'Pocket', 'Classic reprint', 'Small trim, tight economical setting', ['Crimson Text', 10.5, 1.35], ['Crimson Text', 'numeral', '', 14, 'upper'], { nsize: 14, ts: 0.1, orn: 'none', sink: 0.6, lead: 'none', trim: '4.25x6.87', scene: 'stars', m: { top: 0.5, bottom: 0.55, inside: 0.65, outside: 0.45 } }),
  D('cls-oxford', 'Annotated', 'Classic reprint', 'Room for notes, scholarly reprints', ['Spectral', 10.5, 1.55], ['Spectral', 'roman', 'Chapter', 17, 'upper'], { ncase: 'upper', nsize: 10, ts: 0.12, orn: 'short-rule', lead: 'smallcaps-line', scene: 'asterism', m: { top: 0.8, bottom: 0.85, inside: 0.9, outside: 0.8 } }),

  // ---------- Modern minimal ----------
  D('min-swiss', 'Swiss', 'Modern minimal', 'Grid-strict Inter everywhere', ['Inter', 9.5, 1.6], ['Inter', 'padded', '', 22], { tw: 700, nsize: 48, al: 'left', orn: 'none', hfont: 'Inter', pnfont: 'Inter', pn: 'bottom-outside', left: true, lead: 'none', scene: 'line' }),
  D('min-mono', 'Monospace', 'Modern minimal', 'JetBrains Mono heads for tech writing', ['IBM Plex Serif', 10, 1.6], ['JetBrains Mono', 'padded', '', 18], { tw: 700, nsize: 14, al: 'left', orn: 'none', hfont: 'JetBrains Mono', pnfont: 'JetBrains Mono', sub: 'JetBrains Mono', block: true, left: true, lead: 'none', scene: 'line' }),
  D('min-urbanist', 'Gallery', 'Modern minimal', 'Avenir-style headings and thin rules', ['Source Serif 4', 10.5, 1.55], ['Urbanist', 'padded', '', 20, 'upper'], { ts: 0.25, nsize: 12, orn: 'short-rule', hfont: 'Urbanist', pnfont: 'Urbanist', lead: 'none', scene: 'dinkus' }),
  D('min-dm', 'Studio', 'Modern minimal', 'DM Serif Text with DM Sans', ['DM Serif Text', 11, 1.5], ['DM Sans', 'numeral', '', 18, 'upper'], { tw: 700, ts: 0.15, nsize: 40, nfont: 'DM Serif Text', al: 'left', orn: 'none', hfont: 'DM Sans', lead: 'none', scene: 'dinkus' }),
  D('min-jost', 'Bauhaus', 'Modern minimal', 'Futura-style Jost, geometric and bold', ['Literata', 10.5, 1.55], ['Jost', 'numeral', '', 24, 'upper'], { tw: 700, ts: 0.1, nsize: 60, al: 'left', orn: 'none', hfont: 'Jost', pnfont: 'Jost', pn: 'bottom-outside', lead: 'none', scene: 'line' }),
  D('min-karla', 'Notebook', 'Modern minimal', 'Karla and Zilla Slab, approachable and plain', ['Zilla Slab', 11, 1.5], ['Karla', 'numeral', '', 20], { tw: 700, nsize: 28, al: 'left', orn: 'rule', hfont: 'Karla', lead: 'none', scene: 'dinkus' }),
  D('min-cabin', 'Gill Line', 'Modern minimal', 'Humanist Cabin, very British', ['Crimson Text', 11.5, 1.45], ['Cabin', 'word', '', 18, 'upper'], { ts: 0.2, ncase: 'upper', nsize: 10, orn: 'short-rule', hfont: 'Cabin', lead: 'smallcaps-words', scene: 'dinkus' }),
  D('min-figtree', 'Paper', 'Modern minimal', 'Figtree on Newsreader, light and calm', ['Newsreader', 11, 1.55], ['Figtree', 'numeral', '', 20], { nsize: 20, npos: 'inline', al: 'left', orn: 'none', hfont: 'Figtree', lead: 'none', scene: 'blank' }),
  D('min-spline', 'Contrast', 'Modern minimal', 'Spline Sans heads, Bodoni text', ['Libre Bodoni', 10.5, 1.5], ['Spline Sans', 'padded', '', 20, 'upper'], { tw: 700, ts: 0.2, nsize: 14, orn: 'rule', hfont: 'Spline Sans', lead: 'none', scene: 'line' }),
  D('min-roboto', 'Reader', 'Modern minimal', 'Roboto Slab and Roboto, screen-to-print', ['Roboto Slab', 10, 1.6], ['Roboto', 'numeral', 'Chapter', 22], { tw: 700, ncase: 'upper', nsize: 10, al: 'left', orn: 'none', hfont: 'Roboto', block: true, left: true, lead: 'none', scene: 'line' }),
]);

// The twelve original designs keep their places as "Booky originals".
export const ORIGINAL_CATEGORY = 'Booky originals';
