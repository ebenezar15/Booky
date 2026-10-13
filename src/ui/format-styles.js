// Format panels for formatting control: character styles, paragraph styles, links & notes, captions, poetry,
// chapter openers, layout overrides and custom CSS. Each builder fills an accordion body.
import { h, icon, btn, iconBtn, clear, add, field, input, select, toggle, slider, color, toast, confirmDialog, promptDialog, pickFile, compressImage, textarea, debounce } from './dom.js';
import { state, selectElement, setMode } from '../core/store.js';
import { orderedElements, displayTitle } from '../core/model.js';
import { ORNAMENTS } from '../core/themes.js';
import { fontOptions, fontStack } from '../core/fonts.js';
import { FORMAT_DEFAULTS, newStyleId, listOverrides, validateCss, charStyleDecls } from '../core/formatting.js';
import { PARAGRAPH_STYLES } from '../editor/extensions.js';
import { withEditor } from './feedback-actions.js';

const fontsWithNone = (book, none = 'Same as the text') => [{ value: '', label: none }, ...fontOptions(book.meta.language)];
const usedIn = (book, re) => book.elements.filter((e) => re.test(e.content || '')).length;

export function charStylesPanel(b, book, change) {
  const F = book.format;
  F.charStyles = F.charStyles || structuredClone(FORMAT_DEFAULTS.charStyles);
  const draw = () => {
    clear(b);
    add(b, h('p.hint', { style: { marginTop: 0 } }, 'Named inline styles. Apply them from the editor toolbar (or Alt+Shift+1…9). Change a style here and every use updates — in print, in the ebook and in Word files.'));
    F.charStyles.forEach((cs, i) => {
      const set = (k) => (v) => { cs[k] = v; change(); sample.setAttribute('style', charStyleDecls(cs, fontStack)); };
      const sample = h('span', { style: charStyleDecls(cs, fontStack) }, 'Sample text');
      add(b, h('div.card.cs-card', { style: { padding: '10px 12px', marginBottom: '10px' } },
        h('div.row', { style: { gap: '6px' } }, input(cs.name, (v) => { cs.name = v; change(); }, { style: { flex: 1, fontWeight: 600 } }), h('span.small.muted', i < 9 ? `Alt⇧${i + 1}` : ''),
          iconBtn('trash', 'Delete style', async () => {
            const n = usedIn(book, new RegExp(`data-cs="${cs.id}"`));
            if (n && !(await confirmDialog('Delete character style?', `“${cs.name}” is used in ${n} chapter${n === 1 ? '' : 's'}. That text will go back to normal.`, { okLabel: 'Delete', danger: true }))) return;
            F.charStyles.splice(i, 1); change(true); draw();
          }, { size: 15 })),
        h('div.cs-sample', { style: { fontFamily: fontStack(F.body.font), fontSize: '15px', margin: '6px 0' } }, sample),
        h('div.row', { style: { gap: '10px', flexWrap: 'wrap' } },
          toggle(!!cs.italic, set('italic'), 'Italic'), toggle(!!cs.bold, set('bold'), 'Bold'), toggle(!!cs.smallCaps, set('smallCaps'), 'Small caps'), toggle(!!cs.underline, set('underline'), 'Underline')),
        h('div.grid-2', { style: { marginTop: '8px' } },
          field('Font', select(fontsWithNone(book).map((o) => [o.value, o.label]), cs.font || '', set('font'))),
          field('Size', slider(+cs.size || 1, 0.7, 1.4, 0.05, set('size'), (v) => `${Math.round(v * 100)}%`))),
        h('div.grid-2', field('Letter spacing', slider(+cs.letterSpacing || 0, -0.03, 0.15, 0.005, set('letterSpacing'), (v) => `${(+v).toFixed(3)} em`)),
          field('Colour', h('div.row', { style: { gap: '6px' } }, color(cs.color || '#111111', set('color')), btn('None', { cls: 'btn-sm', kind: 'ghost', onClick: () => { cs.color = ''; change(); draw(); } }))))));
    });
    b.appendChild(btn('New character style…', { icon: 'plus', cls: 'btn-block', onClick: async () => {
      const name = await promptDialog('New character style', 'Name (e.g. Spell, Sign, Radio voice)', '');
      if (!name) return;
      F.charStyles.push({ id: newStyleId(name, F.charStyles.map((c) => c.id)), name, italic: true });
      change(true); draw();
    } }));
  };
  draw();
}

const ALL_PARA = (F) => [...PARAGRAPH_STYLES.filter((p) => p.id).map((p) => ({ id: p.id, label: p.label, builtIn: true })), ...(F.customParaStyles || []).map((c) => ({ id: c.id, label: `${c.label} ★`, custom: c }))];

export function paraStylesPanel(b, book, change) {
  const F = book.format;
  F.paraStyles = F.paraStyles || {};
  F.customParaStyles = F.customParaStyles || [];
  let current = ALL_PARA(F)[0].id;
  const draw = () => {
    clear(b);
    const all = ALL_PARA(F);
    const entry = all.find((x) => x.id === current) || all[0];
    const o = entry.custom || (F.paraStyles[entry.id] ||= {});
    const set = (k) => (v) => { o[k] = v; change(); };
    const num = (k, min, max, step, unit) => slider(o[k] === undefined || o[k] === '' ? 0 : +o[k], min, max, step, set(k), (v) => `${(+v).toFixed(2)} ${unit}`);
    add(b,
      h('p.hint', { style: { marginTop: 0 } }, 'Adjust the paragraph styles you use in the editor (verse, epigraph, letter, callout…), or make your own based on one. Styles are saved with the book and in “My templates”.'),
      field('Style', select(all.map((x) => [x.id, x.label]), entry.id, (v) => { current = v; draw(); })),
      entry.custom ? field('Name', input(o.label, (v) => { o.label = v; change(); })) : null,
      field('Font', select(fontsWithNone(book).map((x) => [x.value, x.label]), o.font || '', set('font'))),
      h('div.grid-2', field('Size', slider(+o.size || 1, 0.6, 2, 0.05, set('size'), (v) => `${Math.round(v * 100)}%`)), field('Alignment', select([['', 'As designed'], ['left', 'Left'], ['center', 'Centre'], ['right', 'Right'], ['justify', 'Justified']], o.align || '', set('align')))),
      h('div.grid-2', field('Space above', num('above', 0, 3, 0.1, 'em')), field('Space below', num('below', 0, 3, 0.1, 'em'))),
      h('div.grid-2', field('First-line indent', num('indent', -3, 3, 0.1, 'em')), field('Left indent', num('left', 0, 4, 0.1, 'em'))),
      toggle(!!o.italic, set('italic'), 'Italic'),
      h('div.row', { style: { gap: '6px', marginTop: '10px', flexWrap: 'wrap' } },
        btn('New style based on this…', { cls: 'btn-sm', icon: 'plus', onClick: async () => {
          const label = await promptDialog('New paragraph style', 'Name (e.g. Poem title, Diary entry)', '');
          if (!label) return;
          const id = newStyleId(label, all.map((x) => x.id));
          F.customParaStyles.push({ id, label, basedOn: entry.custom ? entry.custom.basedOn : entry.id, ...(entry.custom ? { ...entry.custom, id, label } : { ...o }) });
          current = id; change(true); draw();
        } }),
        entry.builtIn ? btn('Reset to the design', { cls: 'btn-sm', kind: 'ghost', onClick: () => { delete F.paraStyles[entry.id]; change(true); draw(); } }) : null,
        entry.custom ? btn('Delete style', { cls: 'btn-sm', kind: 'ghost', onClick: async () => {
          const n = usedIn(book, new RegExp(`ps-${entry.id}\\b`));
          if (n && !(await confirmDialog('Delete paragraph style?', `It is used in ${n} chapter${n === 1 ? '' : 's'}; those paragraphs fall back to “${entry.custom.basedOn}”.`, { okLabel: 'Delete', danger: true }))) return;
          F.customParaStyles = F.customParaStyles.filter((c) => c.id !== entry.id); current = all[0].id; change(true); draw();
        } }) : null));
  };
  draw();
}

export function linksNotesPanel(b, book, change) {
  const F = book.format;
  F.notes = { ...FORMAT_DEFAULTS.notes, ...(F.notes || {}) };
  const n = F.notes;
  add(b,
    field('Web links in print', select([['footnote', 'URL in a footnote'], ['brackets', 'URL in brackets after the link'], ['qr', 'Small QR code after the link'], ['text', 'Plain text (no URL)']], F.printLinks || 'footnote', (v) => { F.printLinks = v; change(); }), 'The ebook always keeps live, tappable links.'),
    h('div.section-title', 'Footnotes'),
    field('Where notes go in print', select([['page', 'At the foot of the page'], ['chapter', 'At the end of each chapter'], ['book', 'At the back of the book, under chapter headings']], n.placement, (v) => { n.placement = v; change(); }), 'Ebooks always use pop-up notes with a link back.'),
    h('div.grid-2',
      field('Numbering', select([['chapter', 'Restart each chapter'], ['continuous', 'Continuous through the book']], n.numbering, (v) => { n.numbering = v; change(); })),
      field('Note marks', select([['number', '1, 2, 3'], ['symbol', '*, †, ‡, §']], n.marker, (v) => { n.marker = v; change(); }))),
  );
}

export function captionsPanel(b, book, change) {
  const F = book.format;
  F.captions = { ...FORMAT_DEFAULTS.captions, ...(F.captions || {}) };
  const c = F.captions;
  add(b,
    h('p.hint', { style: { marginTop: 0 } }, 'A caption is a paragraph in the “Caption” style right after an image. Captioned images are numbered, can be cross-referenced, and are listed on a “List of Illustrations” page (add one from the left-hand panel) with page numbers in print and links in the ebook.'),
    h('div.grid-2',
      field('Numbering', select([['chapter', 'By chapter (Figure 3.2)'], ['book', 'Through the book (Figure 7)'], ['none', 'No numbers']], c.numbering, (v) => { c.numbering = v; change(); })),
      field('Label', input(c.label, (v) => { c.label = v || 'Figure'; change(); }, { placeholder: 'Figure, Plate, Map…' }))),
    h('p.hint', 'Booky has no tables yet, so there is no list of tables.'),
  );
}

export function versePanel(b, book, change) {
  const F = book.format;
  F.verse = { ...FORMAT_DEFAULTS.verse, ...(F.verse || {}) };
  const v = F.verse;
  add(b,
    h('p.hint', { style: { marginTop: 0 } }, 'For paragraphs in the “Verse / Poetry” style. Leading spaces are kept, so you can indent lines as you like. Use Shift+Enter for a new line in the same stanza and Enter for a new stanza.'),
    field('Line numbers (print)', select([['0', 'None'], ['5', 'Every 5 lines'], ['10', 'Every 10 lines']], String(v.lineNumbers || 0), (x) => { v.lineNumbers = +x; change(); })),
    h('div.col', { style: { gap: '10px' } },
      toggle(v.hanging !== false, (x) => { v.hanging = x; change(); }, 'Indent the turnover when a long line wraps'),
      toggle(v.keepStanzas !== false, (x) => { v.keepStanzas = x; change(); }, 'Keep short stanzas (up to 8 lines) on one page'),
      toggle(!!v.onePerPage, (x) => { v.onePerPage = x; change(); }, 'Start every poem on a new page')),
  );
}

const OPENER_KEYS = [['prologue', 'Prologue'], ['epilogue', 'Epilogue'], ['interlude', 'Interludes'], ['part', 'Part pages'], ['special', 'Special chapters']];
export function openersPanel(b, book, change) {
  const F = book.format;
  F.openers = F.openers || {};
  let key = 'prologue';
  const draw = () => {
    clear(b);
    const on = !!F.openers[key];
    const o = F.openers[key] || {};
    add(b,
      h('p.hint', { style: { marginTop: 0 } }, 'Give some openers a look of their own within the theme. Mark a chapter as “special” in the Write → Page panel.'),
      field('Opener', select(OPENER_KEYS, key, (v) => { key = v; draw(); })),
      toggle(on, (v) => { if (v) F.openers[key] = { ornament: '', align: '', titleSize: '', image: '' }; else delete F.openers[key]; change(); draw(); }, 'Use a different opener'),
      on ? h('div', { style: { marginTop: '10px' } },
        field('Ornament', select([['', 'Same as chapters'], ...Object.keys(ORNAMENTS).map((k) => [k, k.replace('-', ' ')])], o.ornament || '', (v) => { o.ornament = v; change(); })),
        h('div.grid-2',
          field('Alignment', select([['', 'Same as chapters'], ['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], o.align || '', (v) => { o.align = v; change(); })),
          field('Title size (pt)', input(o.titleSize || '', (v) => { o.titleSize = v; change(); }, { type: 'number', min: 10, max: 60, placeholder: 'Same' }))),
        toggle(!!o.italic, (v) => { o.italic = v; change(); }, 'Italic title'),
        h('div.row', { style: { gap: '8px', marginTop: '10px' } },
          o.image ? h('img', { src: o.image, style: { maxWidth: '90px', maxHeight: '60px', borderRadius: '6px' } }) : null,
          btn(o.image ? 'Change opener image' : 'Opener image…', { cls: 'btn-sm', icon: 'image-plus', onClick: async () => { const f = await pickFile('image/*'); if (f) { o.image = await compressImage(f, 1200); change(); draw(); } } }),
          o.image ? btn('Remove', { cls: 'btn-sm', kind: 'ghost', onClick: () => { o.image = ''; change(); draw(); } }) : null)) : null,
    );
  };
  draw();
}

export function overridesPanel(b, book) {
  const list = listOverrides(orderedElements(book));
  clear(b);
  add(b, h('p.hint', { style: { marginTop: 0 } }, 'Layout fixes and print-only / ebook-only blocks set in the editor (right-click → Block options). Each shows a badge in the editor.'));
  if (!list.length) { b.appendChild(h('p.muted.small', 'None yet.')); return; }
  for (const o of list) {
    const el = book.elements.find((e) => e.id === o.elId);
    b.appendChild(h('div.row.ovr-row', { style: { gap: '6px', padding: '4px 0', borderBottom: '1px solid var(--border)' } },
      h('span.small', { style: { flex: 1 } }, h('b', o.label), h('span.muted', ` · ${displayTitle(book, el)}`)),
      btn('Show', { cls: 'btn-sm', kind: 'ghost', onClick: () => {
        if (o.index < 0) { selectElement(o.elId); setMode('write'); return; }
        withEditor(o.elId, (ed) => { let pos = 1, i = 0; ed.state.doc.forEach((n, off) => { if (/^(paragraph|heading|blockquote)$/.test(n.type.name) && i++ === o.index) pos = off + 1; }); ed.chain().focus().setTextSelection(pos).run(); ed.view.domAtPos(pos)?.node?.parentElement?.scrollIntoView({ block: 'center' }); });
      } })));
  }
}

export function customCssPanel(b, book, change) {
  const F = book.format;
  F.customCss = { print: '', ebook: '', ...(F.customCss || {}) };
  const box = (target) => {
    const msg = h('p.small');
    const show = (v) => { const r = validateCss(v); msg.textContent = r.ok ? (v.trim() ? '✓ Looks well-formed — applied.' : '') : `Not applied: ${r.error}`; msg.style.color = r.ok ? 'var(--success)' : 'var(--danger)'; return r.ok; };
    const apply = debounce((v) => { F.customCss[target] = v; change(); }, 700);
    const ta = textarea(F.customCss[target], (v) => { show(v); apply(v); }, { rows: 6, spellcheck: 'false', style: { fontFamily: 'ui-monospace, monospace', fontSize: '12px' }, placeholder: target === 'print' ? '.bk-chapter .bk-chap-title { letter-spacing: .05em; }' : '.bk-chap-title { color: #444; }' });
    show(F.customCss[target]);
    return h('div', field(target === 'print' ? 'Print CSS (preview and PDF)' : 'Ebook CSS (EPUB)', ta), msg);
  };
  add(b,
    h('div.notice.warn', icon('triangle-alert', 16), h('span', 'For experts. Your CSS is added after the theme and can break the layout. Rules with a syntax error are not applied, so the preview never goes blank.')),
    box('print'), box('ebook'));
}
