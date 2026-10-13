// Format mode: interior design settings + live paginated print / ebook preview.
import { h, icon, btn, iconBtn, clear, field, input, select, toggle, slider, color, segmented, pickFile, compressImage, debounce, toast, add, promptDialog, confirmDialog } from './dom.js';
import { state, on, touch, setApp } from '../core/store.js';
import { templateFromBook } from '../core/templates.js';
import { THEMES, TRIM_SIZES, SCENE_BREAKS, ORNAMENTS, applyTheme, trimOf } from '../core/themes.js';
import { allFonts, fontStack, fontOptions, figureSupport } from '../core/fonts.js';
import { orderedElements, displayTitle, bookWords, elementWords, formatNumber, applyCase } from '../core/model.js';
import { PrintPreview, ebookPreviewHtml } from '../render/preview.js';
import { renderSections } from '../render/book.js';
import { exportPdfDialog } from './pdf-dialog.js';
import { checkLayout, drawLayoutReport } from './layout-report.js';

const openSections = new Set(['theme']);

export function renderFormat(host) {
  const book = state.book;
  const f = () => book.format;
  const split = h('div.split');
  const pane = h('aside.settings-pane', { 'aria-label': 'Formatting settings' });
  const pv = h('section.preview-pane');
  add(split, pane, pv);
  host.appendChild(split);

  // ---------- preview ----------
  let target = 'print';
  let scope = bookWords(book) > 45000 ? 'chapter' : 'book';
  let device = 'kindle';
  let readerTheme = 'light';
  let fontScale = 1;
  let auto = true;
  const pages = h('span.pv-pages', '');
  const previewHost = h('div.preview-host');
  const loading = h('div.preview-loading.hidden', h('div', h('div.spinner'), h('div.muted', 'Typesetting pages…')));
  previewHost.appendChild(loading);
  const preview = new PrintPreview(previewHost);
  preview.spread = true;

  const scopeSel = select([], scope, (v) => { scope = v; refresh(); });
  const fillScope = () => {
    clear(scopeSel);
    scopeSel.appendChild(h('option', { value: 'book', selected: scope === 'book' }, 'Whole book'));
    const cur = state.currentId;
    scopeSel.appendChild(h('option', { value: 'chapter', selected: scope === 'chapter' }, `Current: ${(orderedElements(book).find((e) => e.id === cur) && displayTitle(book, orderedElements(book).find((e) => e.id === cur))) || '—'}`));
    orderedElements(book).forEach((e) => scopeSel.appendChild(h('option', { value: `el:${e.id}`, selected: scope === `el:${e.id}` }, `  ${displayTitle(book, e)}`)));
  };
  fillScope();
  scopeSel.style.width = '190px';

  const printTools = h('span.row', { style: { gap: '4px' } },
    segmented([['spread', 'Spreads'], ['single', 'Single pages']], preview.spread ? 'spread' : 'single', (v) => { preview.setSpread(v === 'spread'); }),
    iconBtn('zoom-out', 'Zoom out', () => preview.setZoom(preview.zoom - 0.15)),
    iconBtn('zoom-in', 'Zoom in', () => preview.setZoom(preview.zoom + 0.15)),
    iconBtn('scaling', 'Fit to width', () => preview.fitWidth()),
    iconBtn('grid-3x3', 'Show margin guides', (e) => { preview.setGuides(!preview.guides); e.currentTarget.classList.toggle('active', preview.guides); }),
  );
  const ebookTools = h('span.row.hidden', { style: { gap: '4px' } },
    segmented([['kindle', 'E-reader'], ['phone', 'Phone'], ['tablet', 'Tablet']], device, (v) => { device = v; refresh(); }),
    segmented([['light', 'Light'], ['sepia', 'Sepia'], ['dark', 'Dark']], readerTheme, (v) => { readerTheme = v; refresh(); }),
    iconBtn('a-large-small', 'Reader font size', () => { fontScale = fontScale >= 1.4 ? 0.85 : +(fontScale + 0.15).toFixed(2); refresh(); }),
  );
  const printBtn = btn('', { icon: 'file-down', kind: 'primary', cls: 'btn-sm', title: 'Download a print-ready PDF of what is shown in the preview', onClick: () => {
    const onlyId = scope === 'chapter' ? state.currentId : scope.startsWith('el:') ? scope.slice(3) : null;
    exportPdfDialog(book, { onlyId });
  } });
  const bar = h('div.preview-bar',
    segmented([['print', 'Print book'], ['ebook', 'Ebook']], target, (v) => { target = v; printTools.classList.toggle('hidden', v !== 'print'); ebookTools.classList.toggle('hidden', v !== 'ebook'); printBtn.classList.toggle('hidden', v !== 'print'); refresh(); }),
    scopeSel, printTools, ebookTools, h('span.grow'), pages,
    toggle(auto, (v) => { auto = v; }, 'Auto'),
    iconBtn('refresh-cw', 'Refresh preview', () => refresh()),
    printBtn,
  );
  add(pv, bar, previewHost);

  let ebookFrame = null;
  let renderToken = 0;
  async function refresh() {
    const my = ++renderToken;
    if (target === 'print') {
      ebookFrame?.parentElement?.remove();
      ebookFrame = null;
      loading.classList.remove('hidden');
      const onlyId = scope === 'chapter' ? state.currentId : scope.startsWith('el:') ? scope.slice(3) : null;
      try {
        const r = await preview.render(book, { onlyId });
        if (my !== renderToken) return;
        pages.textContent = `${r.pages} page${r.pages === 1 ? '' : 's'}${onlyId ? '' : ` · ${trimLabel()}`}`;
        if (!onlyId) pages.textContent += ` · ${bookWords(book).toLocaleString()} words`;
        const sb = pane.querySelector('.acc[data-id="stats"].open .acc-body');
        if (sb) drawStats(sb);
        if (!onlyId && r.pages) { book.cover.lastPageCount = r.pages + (r.pages % 2); }
        if (preview._firstFit !== false) { preview._firstFit = false; preview.fitWidth(); if (preview.zoom > 1) preview.setZoom(1); }
      } finally { if (my === renderToken) loading.classList.add('hidden'); }
    } else {
      preview.iframe?.remove();
      preview.iframe = null;
      const onlyId = scope === 'chapter' ? state.currentId : scope.startsWith('el:') ? scope.slice(3) : null;
      const sections = renderSections(book, 'ebook', { onlyId });
      const dims = { kindle: [430, 600], phone: [340, 680], tablet: [560, 760] }[device];
      if (!ebookFrame) {
        ebookFrame = h('iframe', { title: 'Ebook preview' });
        previewHost.appendChild(h('div.device-wrap', { style: { position: 'absolute', inset: 0 } }, h(`div.device.${device}`, ebookFrame)));
      }
      ebookFrame.parentElement.className = `device ${device}`;
      ebookFrame.style.width = dims[0] + 'px';
      ebookFrame.style.height = dims[1] + 'px';
      ebookFrame.srcdoc = ebookPreviewHtml(book, sections, { theme: readerTheme, fontScale });
      pages.textContent = `${sections.length} section${sections.length === 1 ? '' : 's'} · reflowable`;
    }
  }
  const trimLabel = () => { const t = trimOf(f()); return `${t.w} × ${t.h} in`; };
  const autoRefresh = debounce(() => { if (auto) refresh(); }, 900);

  // ---------- settings ----------
  const change = (redrawPane = false) => { touch('format'); autoRefresh(); if (redrawPane) drawPane(); };
  const fonts = () => fontOptions(book.meta.language);
  const fontsWithDefault = (label = 'Same as heading') => [{ value: '', label }, ...fonts()];
  const num = (obj, key, attrs = {}, redraw) => input(obj[key], (v) => { if (v === '' || isNaN(v)) return; obj[key] = +v; change(redraw); }, { type: 'number', ...attrs });
  const sel = (obj, key, opts, redraw = false) => select(opts, obj[key], (v) => { obj[key] = v; change(redraw); });
  const tog = (obj, key, label, redraw = false) => toggle(obj[key], (v) => { obj[key] = v; change(redraw); }, label);
  const sld = (obj, key, min, max, step, fmt) => slider(obj[key], min, max, step, (v) => { obj[key] = v; change(); }, fmt);
  const seg = (obj, key, opts, redraw = false) => segmented(opts, obj[key], (v) => { obj[key] = v; change(redraw); });

  function acc(id, ic, title, build) {
    const sec = h(`div.acc${openSections.has(id) ? '.open' : ''}`, { dataset: { id } });
    const body = h('div.acc-body');
    const head = h('button.acc-head', { type: 'button', 'aria-expanded': String(openSections.has(id)), on: { click: () => {
      const open = !sec.classList.contains('open');
      sec.classList.toggle('open', open);
      head.setAttribute('aria-expanded', String(open));
      open ? openSections.add(id) : openSections.delete(id);
      if (open && !body.childElementCount) build(body);
    } } }, icon(ic, 17), title, icon('chevron-right', 16, 'chev'));
    add(sec, head, body);
    if (openSections.has(id)) build(body);
    return sec;
  }

  // Word counts per chapter, with the printed page each starts on (from the last full preview).
  function drawStats(b) {
    clear(b);
    const els = orderedElements(book).filter((e) => e.include.print || e.include.ebook);
    const total = bookWords(book);
    const pagesDone = preview.pages && scope === 'book' && target === 'print' ? preview.pages : book.cover.lastPageCount || 0;
    const startPage = (id) => preview.doc?.querySelector(`[data-el="${id}"]`)?.closest('.pagedjs_page')?.getAttribute('data-folio') || '';
    const max = Math.max(1, ...els.map((e) => elementWords(e)));
    add(b,
      h('div.stat-grid', { style: { marginBottom: '12px' } },
        h('div.stat', h('b', total.toLocaleString()), h('span', 'Words')),
        h('div.stat', h('b', pagesDone || '—'), h('span', 'Printed pages')),
        h('div.stat', h('b', pagesDone ? Math.round(total / pagesDone) : '—'), h('span', 'Words per page')),
        h('div.stat', h('b', total / 238 < 60 ? `${Math.max(1, Math.round(total / 238))} min` : `${Math.round(total / 238 / 6) / 10} h`), h('span', 'Reading time'))),
      h('div.wc-table', els.filter((e) => e.type !== 'toc').map((e) => {
        const w = elementWords(e);
        return h('div.wc-row', { title: displayTitle(book, e) },
          h('span.wc-title', displayTitle(book, e)),
          h('span.wc-bar', h('i', { style: { width: `${(w / max) * 100}%` } })),
          h('span.wc-num', w.toLocaleString()),
          h('span.wc-page', startPage(e.id) ? `p. ${startPage(e.id)}` : ''));
      })),
      h('p.hint', 'Page numbers appear after a whole-book print preview.'),
    );
  }

  function drawPane() {
    const scroll = pane.scrollTop;
    clear(pane);
    const F = f();
    add(pane, 
      acc('theme', 'swatch-book', 'Design theme', (b) => {
        add(b, h('p.hint', { style: { marginTop: 0 } }, 'A theme sets fonts, headings, ornaments and spacing. Fine-tune anything below.'),
          h('div.theme-grid', Object.entries(THEMES).map(([id, t]) => {
            const tf = applyTheme(structuredClone(F), id);
            const n = formatNumber(1, tf.headings.numberStyle === 'none' ? 'word' : tf.headings.numberStyle);
            return h(`button.theme-card${F.theme === id ? '.on' : ''}`, { type: 'button', on: { click: () => { book.format = applyTheme(F, id); change(true); toast(`Theme “${t.label}” applied`, 'success', 1400); } } },
              h('div.tc-sample',
                h('div.tc-num', { style: { fontFamily: fontStack(tf.headings.numberFont || tf.headings.font) } }, applyCase(`${tf.headings.numberPrefix ? tf.headings.numberPrefix + ' ' : ''}${n}`, tf.headings.numberCase)),
                h('div.tc-title', { style: { fontFamily: fontStack(tf.headings.font), fontStyle: tf.headings.titleItalic ? 'italic' : '', fontWeight: tf.headings.titleWeight, textTransform: tf.headings.titleCase === 'upper' ? 'uppercase' : '' } }, 'The Beginning'),
                h('div', { style: { fontFamily: fontStack(tf.body.font), fontSize: '9px', marginTop: '3px', opacity: .7 } }, 'It was a quiet morning…')),
              h('b', t.label), h('small', t.desc));
          })));
      }),
      acc('mine', 'star', 'My templates', (b) => {
        const list = state.app.customTemplates || [];
        add(b,
          h('p.hint', { style: { marginTop: 0 } }, 'Save this book’s complete design (fonts, spacing, headings, page numbers, cover style and page structure) and reuse it for new projects.'),
          btn('Save current design as template…', { icon: 'save', kind: 'primary', cls: 'btn-block', onClick: async () => {
            const name = await promptDialog('Save as template', 'Template name', `${book.meta.title} style`);
            if (!name) return;
            setApp({ customTemplates: [...list, templateFromBook(book, name)] });
            toast(`Template “${name}” saved — use it from New book`, 'success');
            drawPane();
          } }),
          h('div', { style: { height: '10px' } }),
          ...list.map((t) => h('div.layer-row', icon('star', 15), h('span', t.name),
            btn('Apply', { cls: 'btn-sm', title: 'Apply this template’s design to the current book', onClick: () => { book.format = JSON.parse(JSON.stringify(t.format)); change(true); toast(`Applied “${t.name}”`, 'success'); } }),
            iconBtn('trash', 'Delete template', async () => { if (await confirmDialog('Delete template?', `“${t.name}” will be removed. Books made with it are not affected.`, { okLabel: 'Delete', danger: true })) { setApp({ customTemplates: list.filter((x) => x.id !== t.id) }); drawPane(); } }, { size: 15 }))),
          list.length ? null : h('p.muted.small', 'No saved templates yet.'),
        );
      }),
      acc('stats', 'chart-column', 'Word count & statistics', (b) => drawStats(b)),
      acc('page', 'ruler', 'Trim size & margins', (b) => {
        add(b, 
          field('Trim size', sel(F, 'trim', TRIM_SIZES.map((t) => [t.id, t.label]), true), 'The finished size of your printed book. Check your printer’s supported sizes (KDP, IngramSpark, Lulu…).'),
          F.trim === 'custom' ? h('div.grid-2', field('Width (in)', num(F.custom, 'w', { step: 0.01, min: 3 })), field('Height (in)', num(F.custom, 'h', { step: 0.01, min: 3 }))) : null,
          h('div.field-label', 'Margins (inches)'),
          h('div.grid-2',
            field('Top', num(F.margins, 'top', { step: 0.05, min: 0.2 })), field('Bottom', num(F.margins, 'bottom', { step: 0.05, min: 0.2 })),
            field('Inside (gutter)', num(F.margins, 'inside', { step: 0.05, min: 0.3 })), field('Outside', num(F.margins, 'outside', { step: 0.05, min: 0.2 }))),
          h('div.row', { style: { gap: '6px', marginBottom: '12px', flexWrap: 'wrap' } },
            ...[['Compact', [0.6, 0.6, 0.75, 0.5]], ['Standard', [0.75, 0.75, 0.875, 0.625]], ['Generous', [0.9, 1, 1, 0.75]]].map(([l, [t, bt, i, o]]) => btn(l, { cls: 'btn-sm', onClick: () => { Object.assign(F.margins, { top: t, bottom: bt, inside: i, outside: o }); change(true); } }))),
          h('p.hint', 'Tip: books over 300 pages need a larger inside margin (0.875–1 in) so text doesn’t disappear into the spine.'),
          h('div.col', { style: { gap: '10px', marginTop: '8px' } }, tog(F, 'bleed', 'Add bleed (0.125 in) — for images that run to the page edge'), tog(F, 'cropMarks', 'Show crop marks')),
        );
      }),
      acc('body', 'whole-word', 'Body text', (b) => {
        add(b, 
          field('Font', sel(F.body, 'font', fonts(), true)),
          h('div.grid-2', field('Size (pt)', num(F.body, 'size', { step: 0.5, min: 6, max: 24 })), field('Line spacing', num(F.body, 'leading', { step: 0.05, min: 1, max: 2.5 }))),
          field('Alignment', seg(F.body, 'align', [['justify', 'Justified'], ['left', 'Left']])),
          field('Paragraphs', seg(F.body, 'spacing', [['indent', 'First-line indent'], ['block', 'Space between']], true)),
          F.body.spacing === 'indent'
            ? h('div', field('Indent size', sld(F.body, 'indent', 0.5, 3, 0.1, (v) => `${v} em`)),
              field('Extra space between paragraphs', sld(F.body, 'indentGap', 0, 1, 0.05, (v) => `${v} em`)))
            : field('Space between paragraphs', sld(F.body, 'paraGap', 0.2, 1.6, 0.1, (v) => `${v} em`)),
          h('div.grid-2',
            field('Letter spacing', sld(F.body, 'letterSpacing', -0.03, 0.1, 0.005, (v) => `${v.toFixed(3)} em`)),
            field('Word spacing', sld(F.body, 'wordSpacing', -0.1, 0.4, 0.01, (v) => `${v.toFixed(2)} em`))),
          h('div.col', { style: { gap: '10px', marginBottom: '12px' } }, tog(F.body, 'hyphenate', 'Hyphenation (smoother justified text)', true)),
          F.body.hyphenate ? field('Hyphenated lines in a row', sel(F.body, 'hyphenLimit', [['0', 'No limit'], ['2', 'At most 2'], ['3', 'At most 3']]), 'Browsers can’t enforce this yet, so the Layout check lists pages that go over it.') : null,
          h('div.grid-2', field('Widow lines', num(F.layout, 'widows', { min: 1, max: 4 })), field('Orphan lines', num(F.layout, 'orphans', { min: 1, max: 4 }))),
          field('Numbers', sel(F.body, 'figures', [['auto', 'Font default'], ['lining', 'Lining (the height of capitals)'], ['oldstyle', 'Old-style (sit in the text like lower-case)']]),
            { lining: `${F.body.font} can switch figure styles: choose Lining for figures the height of capitals (good for tables and dates).`, single: `${F.body.font} has one style of figures, so this changes nothing. Cormorant Garamond, Alegreya, Playfair Display and Sorts Mill Goudy can switch to lining figures.`, unknown: 'Depends on your font — check the preview.' }[figureSupport(F.body.font)]),
          h('div.col', { style: { gap: '10px', marginBottom: '12px' } },
            tog(F.body, 'keepWithNext', 'Keep headings with the next paragraph'),
            tog(F.body, 'hangPunct', 'Hanging punctuation (opening quotes sit in the margin)')),
          field('Text colour', color(F.body.color, (v) => { F.body.color = v; change(); })),
        );
      }),
      acc('headings', 'heading-1', 'Chapter headings', (b) => {
        const H = F.headings;
        add(b, 
          field('Heading font', sel(H, 'font', fonts())),
          field('Alignment', seg(H, 'align', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']])),
          field('Space above heading (sink)', sld(H, 'sink', 0, 3.5, 0.1, (v) => `${v} in`)),
          field('Space after heading', sld(H, 'afterSpace', 0.1, 1.5, 0.05, (v) => `${v} in`)),
          h('div.section-title', 'Chapter number'),
          h('div.grid-2',
            field('Style', sel(H, 'numberStyle', [['word', 'One, Two'], ['numeral', '1, 2'], ['padded', '01, 02'], ['roman', 'I, II'], ['none', 'Hidden']])),
            field('Prefix', input(H.numberPrefix, (v) => { H.numberPrefix = v; change(); }, { placeholder: 'Chapter' }))),
          h('div.grid-2',
            field('Case', sel(H, 'numberCase', [['upper', 'UPPERCASE'], ['title', 'Title Case'], ['none', 'As typed'], ['lower', 'lowercase']])),
            field('Position', sel(H, 'numberPosition', [['above', 'Above title'], ['inline', 'Same line']]))),
          h('div.grid-2', field('Size (pt)', num(H, 'numberSize', { step: 1, min: 6, max: 90 })), field('Letter spacing', num(H, 'numberSpacing', { step: 0.02, min: 0, max: 1 }))),
          field('Number font', sel(H, 'numberFont', fontsWithDefault())),
          h('div.col', { style: { gap: '10px', marginBottom: '12px' } }, tog(H, 'numberItalic', 'Italic number')),
          h('div.section-title', 'Chapter title'),
          h('div.grid-2', field('Size (pt)', num(H, 'titleSize', { step: 1, min: 8, max: 72 })), field('Weight', sel(H, 'titleWeight', [['400', 'Regular'], ['700', 'Bold']]))),
          h('div.grid-2', field('Case', sel(H, 'titleCase', [['none', 'As typed'], ['upper', 'UPPERCASE'], ['title', 'Title Case']])), field('Letter spacing', num(H, 'titleSpacing', { step: 0.02, min: 0, max: 1 }))),
          h('div.row', { style: { gap: '16px', marginBottom: '12px' } }, tog(H, 'titleItalic', 'Italic'), h('span.row', color(H.titleColor, (v) => { H.titleColor = v; change(); }), h('span.small', 'Colour'))),
          h('div.grid-2', field('Subtitle size', num(H, 'subtitleSize', { step: 0.5, min: 6, max: 30 })), h('div', { style: { paddingTop: '22px' } }, tog(H, 'subtitleItalic', 'Italic subtitle'))),
          h('div.section-title', 'Ornament'),
          h('div.chips', { style: { marginBottom: '12px' } }, Object.keys(ORNAMENTS).map((k) => h(`button.chip${H.ornament === k ? '.strike' : ''}`, { type: 'button', style: H.ornament === k ? { background: 'var(--primary)', color: 'var(--primary-ink)', textDecoration: 'none' } : {}, on: { click: () => { H.ornament = k; change(true); } } }, { none: 'None', rule: 'Full rule', 'short-rule': 'Short rule', 'double-rule': 'Double rule', diamond: '◆', fleuron: '❦', stars: '✦ ✦ ✦', swirl: '⁓ ❧ ⁓' }[k]))),
          h('div.section-title', 'Heading image (all chapters)'),
          H.image ? h('div.row', { style: { marginBottom: '12px' } }, h('img', { src: H.image, style: { maxWidth: '120px', maxHeight: '60px' } }), btn('Remove', { cls: 'btn-sm', kind: 'ghost', onClick: () => { H.image = ''; change(true); } }))
            : btn('Upload image', { icon: 'image-plus', cls: 'btn-sm', onClick: async () => { const file = await pickFile('image/*'); if (file) { H.image = await compressImage(file, 1200); change(true); } } }),
          h('div.section-title', 'Parts'),
          h('div.grid-2', field('Part prefix', input(H.partPrefix, (v) => { H.partPrefix = v; change(); })), field('Number style', sel(H, 'partNumberStyle', [['word', 'One'], ['numeral', '1'], ['roman', 'I']]))),
          field('Part title size (pt)', num(H, 'partSize', { min: 10, max: 80 })),
          h('div.section-title', 'Sub-headings in text'),
          field('Sub-heading font', sel(H, 'subheadFont', fontsWithDefault())),
          h('div.grid-2', field('Heading 2 size', num(H, 'h2Size', { step: 0.5 })), field('Heading 3 size', num(H, 'h3Size', { step: 0.5 }))),
        );
      }),
      acc('first', 'pilcrow', 'Opening paragraph', (b) => {
        const P = F.firstPara;
        add(b, 
          h('div.col', { style: { gap: '10px', marginBottom: '12px' } }, tog(P, 'dropCap', 'Drop cap (large first letter)', true)),
          P.dropCap ? h('div',
            field('Drop cap height (lines)', sld(P, 'dropCapLines', 2, 5, 1, (v) => `${v} lines`)),
            field('Drop cap font', sel(P, 'dropCapFont', fontsWithDefault())),
            h('div.row', { style: { marginBottom: '12px' } }, color(P.dropCapColor || '#111111', (v) => { P.dropCapColor = v; change(); }), h('span.small', 'Drop cap colour'), btn('Reset', { cls: 'btn-sm', kind: 'ghost', onClick: () => { P.dropCapColor = ''; change(true); } }))) : null,
          field('Lead-in', seg(P, 'leadIn', [['none', 'None'], ['smallcaps-line', 'First line in small caps'], ['smallcaps-words', 'First words']], true)),
          P.leadIn === 'smallcaps-words' ? field('Number of words', sld(P, 'leadWords', 1, 8, 1, (v) => `${v} words`)) : null,
        );
      }),
      acc('scene', 'asterisk', 'Scene breaks', (b) => {
        const S = F.sceneBreak;
        add(b, 
          h('div.chips', { style: { marginBottom: '12px' } }, Object.entries({ ...SCENE_BREAKS, custom: 'Custom…', image: 'Image…' }).map(([k, sym]) => h('button.chip', {
            type: 'button', style: S.style === k ? { background: 'var(--primary)', color: 'var(--primary-ink)' } : {},
            on: { click: async () => { if (k === 'image' && !S.image) { const file = await pickFile('image/*'); if (!file) return; S.image = await compressImage(file, 600); } S.style = k; change(true); } },
          }, k === 'line' ? '———' : k === 'blank' ? 'Blank line' : sym))),
          S.style === 'custom' ? field('Custom symbol', input(S.custom, (v) => { S.custom = v; change(); }, { placeholder: '~ ❖ ~' })) : null,
          S.style === 'image' && S.image ? h('div.row', { style: { marginBottom: '12px' } }, h('img', { src: S.image, style: { height: '28px' } }), btn('Change', { cls: 'btn-sm', onClick: async () => { const file = await pickFile('image/*'); if (file) { S.image = await compressImage(file, 600); change(true); } } })) : null,
          tog(S, 'noIndentAfter', 'No indent on the paragraph after a break'),
          h('p.hint', 'Insert a scene break in the editor with the ✱ button or Ctrl Alt 8.'),
        );
      }),
      acc('header', 'layout-template', 'Running heads & page numbers', (b) => {
        const R = F.header, N = F.pageNumbers;
        const opts = [['author', 'Author name'], ['title', 'Book title'], ['chapter', 'Chapter title'], ['none', 'Nothing']];
        add(b, 
          tog(R, 'show', 'Show running heads', true),
          R.show ? h('div', { style: { marginTop: '12px' } },
            h('div.grid-2', field('Left pages (verso)', sel(R, 'verso', opts)), field('Right pages (recto)', sel(R, 'recto', opts))),
            h('div.grid-2', field('Position', sel(R, 'align', [['center', 'Centred'], ['outside', 'Outside edge']])), field('Case', sel(R, 'case', [['upper', 'UPPERCASE'], ['smallcaps', 'Small caps'], ['none', 'As typed']]))),
            h('div.grid-2', field('Size (pt)', num(R, 'size', { step: 0.5, min: 6, max: 14 })), field('Letter spacing', num(R, 'spacing', { step: 0.02, min: 0, max: 0.5 }))),
            field('Font', sel(R, 'font', fontsWithDefault('Heading font'))),
            tog(R, 'italic', 'Italic')) : null,
          h('div.section-title', { style: { marginTop: '18px' } }, 'Page numbers'),
          field('Position', sel(N, 'position', [['bottom-center', 'Bottom centre'], ['bottom-outside', 'Bottom outside'], ['top-outside', 'Top outside'], ['top-center', 'Top centre'], ['none', 'No page numbers']])),
          h('div.grid-2',
            field('Style', sel(N, 'style', [['plain', '12'], ['dashes', '— 12 —'], ['page', 'Page 12'], ['brackets', '[ 12 ]'], ['dots', '· 12 ·'], ['pipe', '| 12']])),
            field('First body page is', num(N, 'startAt', { min: 0, max: 999, step: 1 }))),
          h('div.grid-2', field('Size (pt)', num(N, 'size', { step: 0.5, min: 6, max: 14 })), field('Font', sel(N, 'font', fontsWithDefault('Heading font')))),
          h('div.row', { style: { marginBottom: '12px' } }, color(N.color || F.body.color, (v) => { N.color = v; change(); }), h('span.small', 'Page number colour')),
          h('div.col', { style: { gap: '10px' } }, tog(N, 'showOnChapterStart', 'Number on chapter opening pages'), tog(N, 'frontRoman', 'Roman numerals (i, ii, iii) for front matter')),
          h('p.hint', 'Title, copyright, dedication and blank pages never show heads or numbers — that’s the publishing convention.'),
        );
      }),
      acc('check', 'triangle-alert', 'Layout check', (b) => {
        const out = h('div');
        add(b,
          h('p.hint', { style: { marginTop: 0 } }, 'Looks through the print preview for widows and orphans, headings or scene breaks left at the foot of a page, short last pages, stacks of hyphens, very loose lines and blank pages.'),
          btn('Check layout', { icon: 'triangle-alert', cls: 'btn-block', onClick: async () => {
            if (!preview.doc?.querySelector('.pagedjs_page')) await refresh();
            out.textContent = 'Checking…';
            await new Promise((r) => setTimeout(r, 30));
            const findings = checkLayout(book, preview.doc);
            drawLayoutReport(out, findings, { onPage: (n) => preview.goToPage(n, true) });
            if (scope !== 'book') out.prepend(h('p.hint', 'Only the pages in the preview were checked. Choose “Whole book” above the preview to check everything.'));
          } }),
          out);
      }),
      acc('layout', 'book-open', 'Page flow', (b) => {
        const L = F.layout;
        add(b, 
          field('Chapters start on', seg(L, 'chapterStart', [['right', 'Right page'], ['any', 'Next page']])),
          field('Parts start on', seg(L, 'partStart', [['right', 'Right page'], ['any', 'Next page']])),
          field('Front matter pages start on', seg(L, 'frontStart', [['right', 'Right page'], ['any', 'Next page']])),
          h('p.hint', 'Traditional books start chapters on a right-hand (odd) page, adding a blank page when needed. Override individual pages in the Write → Page panel.'),
        );
      }),
      acc('toc', 'list-tree', 'Table of contents', (b) => {
        const T = F.toc;
        add(b, 
          h('div.col', { style: { gap: '10px', marginBottom: '12px' } },
            tog(T, 'showNumbers', 'Show chapter numbers'),
            tog(T, 'pageNumbers', 'Page numbers (print)'),
            tog(T, 'leaders', 'Dot leaders')),
          field('Depth', seg(T, 'depth', [[1, 'Chapters'], [2, '+ Heading 2'], [3, '+ Heading 3']])),
        );
      }),
      acc('ebook', 'tablet', 'Ebook options', (b) => {
        const E = F.ebook;
        add(b, h('div.col', { style: { gap: '10px' } },
          tog(E, 'useBookFonts', 'Use the book’s fonts (readers may still override)'),
          tog(E, 'embedFonts', 'Embed font files in the EPUB (larger file)'),
          tog(E, 'pageList', 'Print page numbers in the ebook (page-list) — when there is a print edition'),
          tog(E, 'justify', 'Justify text'),
          tog(E, 'indent', 'First-line indents'),
          tog(E, 'dropCaps', 'Drop caps in ebook'),
          tog(E, 'includeToc', 'Include printed-style contents page (navigation menu is always included)')));
      }),
    );
    pane.scrollTop = scroll;
  }

  drawPane();
  refresh();
  const offs = [
    on('select', () => { fillScope(); if (scope === 'chapter') autoRefresh(); }),
    on('meta', autoRefresh),
    on('app', (p) => { if ('customFonts' in p) drawPane(); }),
  ];
  return () => { offs.forEach((x) => x()); renderToken++; };
}
