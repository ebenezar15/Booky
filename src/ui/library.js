// Library / home screen: book shelf, templates, import.
import { h, icon, btn, iconBtn, menu, modal, toast, confirmDialog, field, pickFile, downloadBlob, slugify, timeAgo, segmented, clear, input, add, select, slider } from './dom.js';
import { db } from '../core/db.js';
import { LANGUAGES, langInfo, applyLanguageDesign } from '../core/languages.js';
import { BOOK_TEMPLATES, bookFromTemplate } from '../core/templates.js';
import { THEMES, DESIGN_CATEGORIES, TRIM_SIZES, defaultFormat, applyTheme } from '../core/themes.js';
import { allFonts, fontStack, fontOptions } from '../core/fonts.js';
import { bookWords, createBook, createElement, normalizeBook, uid, applyCase, formatNumber } from '../core/model.js';
import { coverThumbnail } from '../render/cover.js';
import { readManuscript, splitIntoChapters, chunksToElements, importSummary, IMPORT_ACCEPT } from '../import/importer.js';
import { state, setApp } from '../core/store.js';
import { backupPayload, backupAge, storageReport } from '../core/backup.js';
import { lastBackupAt, recordBackup, milestonesFor } from '../core/backup-folder.js';
import { storageStatus, requestPersistence } from '../core/db.js';
import { openSettings } from './settings.js';
import { appearanceButton } from './appearance.js';

import logoSvg from '../../assets/logo.svg?raw';

export function brand(onClick) {
  return h('div.brand', { on: { click: onClick }, title: 'Booky home' },
    h('span.brand-mark', { html: logoSvg }), 'Booky');
}

export function themeButton() {
  const order = ['light', 'sepia', 'dark'];
  const ic = { light: 'sun', sepia: 'coffee', dark: 'moon' };
  const b = iconBtn(ic[state.app.theme] || 'sun', 'Switch theme (light / sepia / dark)', () => {
    const next = order[(order.indexOf(state.app.theme) + 1) % order.length];
    setApp({ theme: next });
    b.replaceWith(themeButton());
  });
  return b;
}

export async function renderLibrary(root) {
  const books = (await db.allBooks()).sort((a, b) => b.updatedAt - a.updatedAt);

  const top = h('header.topbar',
    brand(() => {}),
    h('div.grow'),
    h('div.topbar-actions',
      btn('Import', { icon: 'upload', kind: 'ghost', onClick: () => importFlow() }),
      appearanceButton(),
      themeButton(),
      iconBtn('settings', 'Settings', () => openSettings()),
    ));

  let query = '', sort = sessionStorage.getItem('booky-sort') || 'recent';
  const normalized = books.map((b) => normalizeBook(b));
  const grid = h('div.book-grid');
  const drawShelf = () => {
    clear(grid);
    const q = query.toLowerCase();
    const list = normalized
      .filter((b) => !q || [b.meta.title, b.meta.author, b.meta.series, b.meta.genre].join(' ').toLowerCase().includes(q))
      .sort((a, b) => sort === 'title' ? (a.meta.title || '').localeCompare(b.meta.title || '')
        : sort === 'words' ? bookWords(b) - bookWords(a)
        : sort === 'created' ? b.createdAt - a.createdAt
        : b.updatedAt - a.updatedAt);
    list.forEach((b) => grid.appendChild(bookCard(b)));
    if (!list.length) grid.appendChild(h('p.muted', 'No projects match your search.'));
  };
  drawShelf();
  const totalWords = normalized.reduce((n, b) => n + bookWords(b), 0);
  const shelf = books.length
    ? h('div',
      h('div.shelf-bar',
        h('input.input', { type: 'search', placeholder: 'Search projects by title, author, series…', style: { maxWidth: '340px' }, on: { input: (e) => { query = e.target.value; drawShelf(); } } }),
        select([['recent', 'Recently edited'], ['created', 'Newest'], ['title', 'Title A–Z'], ['words', 'Most words']], sort, (v) => { sort = v; sessionStorage.setItem('booky-sort', v); drawShelf(); }, { style: 'width:auto' }),
        h('span.grow'),
        h('span.muted.small', `${books.length} project${books.length === 1 ? '' : 's'} · ${totalWords.toLocaleString()} words written`)),
      grid)
    : h('div.empty-state', icon('feather', 34), h('h3', 'Your shelf is empty'), h('p', 'Start a new book from a template above, or import an existing manuscript (Word, Apple Pages, Markdown, text).'));

  const lib = h('main.library',
    h('section.lib-hero',
      h('h1', 'Write. Format. Publish.'),
      h('p', 'Booky is your offline book studio — draft your manuscript, design a print-ready interior, craft a cover and export PDF and EPUB, all without an internet connection.'),
      h('div.row', { style: { gap: '10px', flexWrap: 'wrap' } },
        btn('New book', { icon: 'plus', kind: 'primary', cls: 'btn-lg', onClick: () => newBookDialog() }),
        btn('Import manuscript', { icon: 'file-up', cls: 'btn-lg', onClick: () => importFlow() }),
        btn('Open backup (.booky)', { icon: 'folder-open', kind: 'ghost', cls: 'btn-lg', onClick: () => importFlow('.booky,.json') }),
      )),
    books.length ? h('section.lib-section', h('h2', 'Your projects'), shelf) : null,
    h('section.lib-section',
      h('h2', 'Start from a template'),
      h('div.tpl-grid', [...BOOK_TEMPLATES, ...(state.app.customTemplates || []).map((c) => ({ ...c, icon: 'star', desc: c.desc || 'Your saved template' }))].map((t) => h('button.tpl-card', { type: 'button', on: { click: () => newBookDialog(t.id) } },
        h('span.tpl-ic', icon(t.icon, 20)), h('b', t.name), h('span', t.desc))))),
    books.length ? null : h('section.lib-section', shelf),
    h('footer.lib-foot',
      h('span', icon('lock', 12), ' Everything is stored privately in this browser — nothing is uploaded.'),
      storageLine()),
  );

  add(root, top, lib);
}

function bookCard(book) {
  const words = bookWords(book);
  const open = () => { location.hash = `#/book/${book.id}`; };
  const more = iconBtn('ellipsis', 'Book options', (e) => {
    e.stopPropagation();
    menu(more, [
      { label: 'Open', icon: 'book-open', onClick: open },
      { label: 'Duplicate', icon: 'copy', onClick: async () => {
        const copy = JSON.parse(JSON.stringify(book));
        copy.id = uid('bk_'); copy.meta.title += ' (copy)'; copy.createdAt = copy.updatedAt = Date.now();
        await db.putBook(copy); rerender();
      } },
      { label: 'Translate…', icon: 'languages', onClick: () => import('./translate.js').then((m) => m.openTranslateDialog(book)) },
      { label: 'Download backup (.booky)', icon: 'download', onClick: () => downloadBackup(book) },
      { divider: true },
      { label: 'Delete book', icon: 'trash', danger: true, onClick: async () => {
        if (await confirmDialog('Delete book?', `“${book.meta.title}” will be permanently removed from this browser. Download a backup first if you might need it.`, { okLabel: 'Delete', danger: true })) {
          await db.deleteBook(book.id);
          for (const ms of await milestonesFor(book.id)) await db.deleteMilestone(ms.id).catch(() => {});
          toast('Book deleted'); rerender();
        }
      } },
    ], { align: 'right' });
  }, { cls: 'card-menu' });
  return h('div.book-card', { on: { click: open }, title: book.meta.title },
    h('div.book-cover-thumb', coverThumbnail(book, 240)), more,
    h('h3', book.meta.title || 'Untitled'),
    h('p', `${book.meta.author || 'No author'} · ${words.toLocaleString()} words`),
    h('p', `Edited ${timeAgo(book.updatedAt)}`),
    backupLine(book));
}

function backupLine(book) {
  const age = backupAge(lastBackupAt(book.id), Date.now(), { hasContent: bookWords(book) > 0, since: book.createdAt });
  return h(`p.backup-age${age.stale ? '.stale' : ''}`, { title: age.stale ? 'Download a backup or set up automatic folder backups in Settings → Backups' : '' }, icon(age.stale ? 'triangle-alert' : 'shield-check', 12), ` ${age.label}`);
}

// Storage health in the library footer: space used and whether the browser promised to keep it.
function storageLine() {
  const el = h('span.storage-line', 'Checking storage…');
  const draw = async () => {
    const st = await storageStatus();
    if (!st.supported) { el.textContent = 'Tip: download a .booky backup regularly to keep your work safe.'; return; }
    const r = storageReport(st);
    clear(el);
    add(el, icon(r.level === 'ok' ? 'shield-check' : 'triangle-alert', 12), ` ${r.used} used${r.free ? ` · ${r.free} free` : ''} · ${st.persisted ? 'protected' : 'not protected'} `,
      h('button.linkish', { type: 'button', on: { click: () => openSettings('backups') } }, 'Backups & storage'));
    el.className = `storage-line ${r.level}`;
    el.title = r.message;
  };
  draw();
  return el;
}

function rerender() {
  const root = document.getElementById('app');
  clear(root);
  renderLibrary(root);
}

export async function downloadBackup(book) {
  const blob = new Blob([backupPayload(book, await milestonesFor(book.id))], { type: 'application/json' });
  downloadBlob(blob, `${slugify(book.meta.title)}.booky`);
  recordBackup(book.id);
}

const SAMPLES = {
  latin: ['The morning came slowly over the harbour, grey at first and then gold, and the gulls began their arguments above the boats.', 'She folded the letter twice and put it in her pocket, where it stayed for the rest of the summer.'],
  tamil: ['காலை மெல்ல துறைமுகத்தின் மேல் விடிந்தது; முதலில் சாம்பலாகவும் பின்னர் பொன்னாகவும் வானம் மாறியது.', 'அவள் அந்தக் கடிதத்தை இரண்டாக மடித்துத் தன் சட்டைப் பையில் வைத்துக்கொண்டாள்.'],
  devanagari: ['सुबह धीरे-धीरे बंदरगाह पर उतरी, पहले धूसर और फिर सुनहरी।', 'उसने चिट्ठी को दो बार मोड़ा और अपनी जेब में रख लिया।'],
  malayalam: ['പ്രഭാതം പതുക്കെ തുറമുഖത്തിനു മുകളിൽ വിടർന്നു.', 'അവൾ ആ കത്ത് രണ്ടായി മടക്കി പോക്കറ്റിൽ വച്ചു.'],
  telugu: ['ఉదయం నెమ్మదిగా రేవు మీద వెలిగింది.', 'ఆమె ఆ ఉత్తరాన్ని రెండుసార్లు మడిచి జేబులో పెట్టుకుంది.'],
  kannada: ['ಬೆಳಗು ನಿಧಾನವಾಗಿ ಬಂದರಿನ ಮೇಲೆ ಮೂಡಿತು.', 'ಅವಳು ಆ ಪತ್ರವನ್ನು ಎರಡು ಬಾರಿ ಮಡಚಿ ಜೇಬಿನಲ್ಲಿಟ್ಟಳು.'],
  bengali: ['ভোর ধীরে ধীরে বন্দরের ওপর নেমে এল।', 'সে চিঠিটা দুবার ভাঁজ করে পকেটে রাখল।'],
  gujarati: ['સવાર ધીમે ધીમે બંદર પર ઊતરી.', 'તેણે પત્ર બે વાર વાળીને ખિસ્સામાં મૂક્યો.'],
  gurmukhi: ['ਸਵੇਰ ਹੌਲੀ-ਹੌਲੀ ਬੰਦਰਗਾਹ ਉੱਤੇ ਉੱਤਰੀ।', 'ਉਸ ਨੇ ਚਿੱਠੀ ਦੋ ਵਾਰ ਮੋੜ ਕੇ ਜੇਬ ਵਿੱਚ ਰੱਖ ਲਈ।'],
  oriya: ['ସକାଳ ଧୀରେ ଧୀରେ ବନ୍ଦର ଉପରେ ଆସିଲା।', 'ସେ ଚିଠିଟିକୁ ଦୁଇଥର ଭାଙ୍ଗି ପକେଟରେ ରଖିଲା।'],
  arabic: ['صبح آہستہ آہستہ بندرگاہ پر اتری۔', 'اس نے خط کو دو بار تہہ کیا اور جیب میں رکھ لیا۔'],
  sinhala: ['උදෑසන සෙමින් වරාය මතට පැමිණියේය.', 'ඇය ලිපිය දෙවරක් නවා සාක්කුවට දැමුවාය.'],
};

export function newBookDialog(tplId = 'novel') {
  let chosen = tplId;
  const meta = { title: '', subtitle: '', author: state.app.lastAuthor || '', language: 'en' };
  const customs = state.app.customTemplates || [];
  const all = () => [...BOOK_TEMPLATES, ...customs.map((c) => ({ ...c, icon: 'star' }))];
  // Design choices start from the template's theme and can be changed before creating the book.
  let design = null;
  const resetDesign = () => {
    const c = customs.find((x) => x.id === chosen);
    design = c ? JSON.parse(JSON.stringify(c.format)) : defaultFormat(BOOK_TEMPLATES.find((t) => t.id === chosen)?.theme);
  };
  resetDesign();
  const grid = h('div.tpl-grid', { style: { gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } });
  const designBox = h('div.design-box');
  const sample = h('div.design-sample');
  const draw = () => {
    clear(grid);
    all().forEach((t) => grid.appendChild(h('button.tpl-card', {
      type: 'button', style: { padding: '10px', borderColor: t.id === chosen ? 'var(--primary)' : '', boxShadow: t.id === chosen ? 'var(--focus)' : '' },
      on: { click: () => { chosen = t.id; resetDesign(); draw(); drawDesign(); } },
    }, h('span.tpl-ic', { style: { width: '30px', height: '30px' } }, icon(t.icon, 16)), h('b', { style: { fontSize: '13px' } }, t.name))));
  };
  const drawSample = () => {
    const f = design;
    const num = f.headings.numberStyle === 'none' ? '' : applyCase(`${f.headings.numberPrefix ? f.headings.numberPrefix + ' ' : ''}${formatNumber(1, f.headings.numberStyle)}`, f.headings.numberCase);
    clear(sample);
    add(sample,
      h('div', { style: { textAlign: f.headings.align, fontFamily: fontStack(f.headings.numberFont || f.headings.font), fontSize: '9px', letterSpacing: f.headings.numberSpacing + 'em' } }, num),
      h('div', { style: { textAlign: f.headings.align, fontFamily: fontStack(f.headings.font), fontSize: '17px', fontStyle: f.headings.titleItalic ? 'italic' : '', fontWeight: f.headings.titleWeight, textTransform: f.headings.titleCase === 'upper' ? 'uppercase' : '', margin: '2px 0 10px' } }, 'The Beginning'),
      ...(SAMPLES[langInfo(meta.language).script] || SAMPLES.latin).map((t, i) => h('p', {
        style: { fontFamily: fontStack(f.body.font), fontSize: `${f.body.size * 0.92}px`, lineHeight: f.body.leading, textAlign: f.body.align, margin: f.body.spacing === 'block' ? `0 0 ${f.body.paraGap}em` : 0, textIndent: f.body.spacing === 'indent' && i ? `${f.body.indent}em` : 0, letterSpacing: `${f.body.letterSpacing || 0}em`, hyphens: 'auto' },
      }, t)));
  };
  const drawDesign = () => {
    clear(designBox);
    const f = design;
    const fonts = fontOptions(meta.language || 'en');
    const ch = () => drawSample();
    add(designBox,
      h('div.grid-2',
        field(`Design template (${Object.keys(THEMES).length})`, select(DESIGN_CATEGORIES.flatMap((c) => [{ value: `__${c}`, label: `── ${c} ──`, disabled: true }, ...Object.entries(THEMES).filter(([, t]) => t.cat === c).map(([id, t]) => ({ value: id, label: t.label }))]), f.theme, (v) => { design = applyTheme(design, v); drawDesign(); })),
        field('Trim size', select(TRIM_SIZES.filter((t) => t.id !== 'custom').map((t) => [t.id, t.label]), f.trim, (v) => { f.trim = v; }))),
      h('div.grid-2',
        field('Body font', select(fonts, f.body.font, (v) => { f.body.font = v; ch(); })),
        field('Heading font', select(fonts, f.headings.font, (v) => { f.headings.font = v; ch(); }))),
      h('div.grid-2',
        field('Text size', slider(f.body.size, 8, 18, 0.5, (v) => { f.body.size = v; ch(); }, (v) => `${v} pt`)),
        field('Line spacing', slider(f.body.leading, 1, 2.2, 0.05, (v) => { f.body.leading = v; ch(); }, (v) => v.toFixed(2)))),
      h('div.grid-2',
        field('Paragraphs', segmented([['indent', 'Indented'], ['block', 'Spaced']], f.body.spacing, (v) => { f.body.spacing = v; ch(); })),
        field('Alignment', segmented([['justify', 'Justified'], ['left', 'Left']], f.body.align, (v) => { f.body.align = v; ch(); }))),
      h('div.grid-2',
        field('Chapter numbers', select([['word', 'Chapter One'], ['numeral', 'Chapter 1'], ['roman', 'I, II'], ['padded', '01'], ['none', 'Hidden']], f.headings.numberStyle, (v) => { f.headings.numberStyle = v; ch(); })),
        field('Drop cap', segmented([['no', 'Off'], ['yes', 'On']], f.firstPara.dropCap ? 'yes' : 'no', (v) => { f.firstPara.dropCap = v === 'yes'; }))),
    );
    drawSample();
  };
  draw();
  drawDesign();
  const create = async () => {
    const book = bookFromTemplate(chosen, { title: meta.title.trim() || 'Untitled Book', subtitle: meta.subtitle.trim(), author: meta.author.trim() }, customs);
    book.format = design;
    if (meta.language !== 'en') {
      const toc = book.elements.find((e) => e.type === 'toc');
      if (toc) toc.title = langInfo(meta.language).labels.contents;
    }
    book.meta.language = meta.language;
    setApp({ lastAuthor: meta.author.trim() });
    await db.putBook(book);
    m.close();
    location.hash = `#/book/${book.id}`;
  };
  const m = modal({
    title: 'Create a new book', width: 920,
    body: h('div.newbook',
      h('div',
        h('div.grid-2',
          field('Title', input('', (v) => (meta.title = v), { placeholder: 'The Great Untitled' })),
          field('Author / pen name', input(meta.author, (v) => (meta.author = v), { placeholder: 'Your name' }))),
        h('div.grid-2',
          field('Subtitle (optional)', input('', (v) => (meta.subtitle = v))),
          field('Language', select(LANGUAGES.map((l) => [l.code, l.native === l.name ? l.name : `${l.name} — ${l.native}`]), meta.language, (v) => {
            meta.language = v;
            applyLanguageDesign({ format: design, elements: [], meta: {} }, v);
            drawDesign();
          }))),
        h('div.field-label', { style: { margin: '6px 0 8px' } }, 'Template'),
        grid,
        h('p.hint', { style: { marginTop: '10px' } }, 'Templates set up the pages (front matter, chapters, back matter). Save your own from Format → “Save as template”.')),
      h('div',
        h('div.field-label', { style: { marginBottom: '8px' } }, 'Customise the design'),
        sample, designBox)),
    footer: [btn('Cancel', { onClick: () => m.close() }), btn('Create book', { kind: 'primary', icon: 'sparkles', onClick: create })],
  });
}

// Import a manuscript into a NEW book (or into `targetBook` if given).
export function importFlow(accept = IMPORT_ACCEPT, targetBook = null, onDone) {
  let parsed = null;
  let chunks = [];
  let mode = 'auto';
  let separator = '* * *';
  const preview = h('div.import-preview.hidden');
  const status = h('p.hint');
  const sepInput = input(separator, (v) => { separator = v; recompute(); }, { placeholder: 'Separator line, e.g. ###' });
  const sepField = field('Separator text', sepInput);
  sepField.classList.add('hidden');
  const modeCtl = segmented([['auto', 'Auto-detect'], ['h1', 'Heading 1'], ['h2', 'Heading 1–2'], ['pattern', '“Chapter …” lines'], ['separator', 'Separator'], ['none', 'One chapter']], mode, (v) => {
    mode = v; sepField.classList.toggle('hidden', v !== 'separator'); recompute();
  });
  const opts = h('div.hidden', h('div.field-label', { style: { margin: '14px 0 6px' } }, 'Split into chapters by'), modeCtl, sepField);
  const importBtn = btn(targetBook ? 'Add to book' : 'Create book', { kind: 'primary', icon: 'check', disabled: true });

  function recompute() {
    if (!parsed?.html) return;
    chunks = splitIntoChapters(parsed.html, { mode, separator });
    const sum = importSummary(chunks);
    clear(preview).classList.remove('hidden');
    sum.forEach((s, i) => preview.appendChild(h('div', h('span', `${i + 1}. ${s.title}`), h('span.muted', `${s.type} · ${s.words.toLocaleString()} words`))));
    status.textContent = `Found ${chunks.length} section${chunks.length === 1 ? '' : 's'}.`;
    importBtn.disabled = !chunks.length;
  }

  async function handle(file) {
    if (!file) return;
    status.textContent = `Reading ${file.name}…`;
    try {
      parsed = await readManuscript(file);
    } catch (e) {
      console.error(e);
      status.textContent = `Could not read this file: ${e.message}`;
      return;
    }
    if (parsed.project) {
      const raw = parsed.project.book || parsed.project;
      if (!raw.elements) { status.textContent = 'This is not a Booky backup file.'; return; }
      const book = normalizeBook(raw);
      const existing = await db.getBook(book.id);
      if (existing) { book.id = uid('bk_'); book.meta.title += existing.meta.title === book.meta.title ? ' (restored)' : ''; }
      await db.putBook(book);
      for (const ms of parsed.project.milestones || []) await db.putMilestone({ ...ms, id: uid('ms_'), bookId: book.id }).catch(() => {});
      m.close();
      toast('Backup restored', 'success');
      location.hash = `#/book/${book.id}`;
      return;
    }
    opts.classList.remove('hidden');
    zone.querySelector('b').textContent = file.name;
    recompute();
  }

  importBtn.addEventListener('click', async () => {
    const els = chunksToElements(chunks);
    if (targetBook) {
      targetBook.elements.push(...els);
      m.close();
      onDone?.(els);
      toast(`Imported ${els.length} section${els.length === 1 ? '' : 's'}`, 'success');
      return;
    }
    const book = createBook({ meta: { title: parsed.title || 'Imported Book', author: state.app.lastAuthor || '' } });
    const hasType = (t) => els.some((e) => e.type === t);
    const front = ['title', 'copyright'].filter((t) => !hasType(t)).map((t) => createElement(t));
    if (!hasType('toc')) front.push(createElement('toc'));
    book.elements = [...front, ...els];
    await db.putBook(book);
    m.close();
    toast('Manuscript imported', 'success');
    location.hash = `#/book/${book.id}`;
  });

  const zone = h('div.dropzone', {
    on: {
      click: async () => handle(await pickFile(accept)),
      dragover: (e) => { e.preventDefault(); zone.classList.add('over'); },
      dragleave: () => zone.classList.remove('over'),
      drop: (e) => { e.preventDefault(); zone.classList.remove('over'); handle(e.dataTransfer.files[0]); },
    },
  }, icon('file-up', 30), h('div', h('b', 'Drop a file here or click to browse')), h('small', 'Word (.docx), Apple Pages (.pages), Markdown (.md), Text (.txt), HTML, RTF or a Booky backup (.booky)'));

  const m = modal({
    title: targetBook ? 'Import into this book' : 'Import a manuscript', width: 640,
    body: [zone, status, opts, preview],
    footer: [btn('Cancel', { onClick: () => m.close() }), importBtn],
  });
}
