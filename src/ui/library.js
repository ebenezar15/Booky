// Library / home screen: book shelf, templates, import.
import { h, icon, btn, iconBtn, menu, modal, toast, confirmDialog, field, pickFile, downloadBlob, slugify, timeAgo, segmented, clear, input, add } from './dom.js';
import { db } from '../core/db.js';
import { BOOK_TEMPLATES, bookFromTemplate } from '../core/templates.js';
import { bookWords, createBook, createElement, normalizeBook, uid } from '../core/model.js';
import { coverThumbnail } from '../render/cover.js';
import { readManuscript, splitIntoChapters, chunksToElements, importSummary, IMPORT_ACCEPT } from '../import/importer.js';
import { state, setApp } from '../core/store.js';
import { openSettings } from './settings.js';

export function brand(onClick) {
  return h('div.brand', { on: { click: onClick }, title: 'Booky home' },
    h('span.brand-mark', icon('book-open', 18)), 'Booky');
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
      themeButton(),
      iconBtn('settings', 'Settings', () => openSettings()),
    ));

  const shelf = books.length
    ? h('div.book-grid', books.map((b) => bookCard(normalizeBook(b))))
    : h('div.empty-state', icon('feather', 34), h('h3', 'Your shelf is empty'), h('p', 'Start a new book from a template below, or import an existing manuscript (Word, Markdown, text).'));

  const lib = h('main.library',
    h('section.lib-hero',
      h('h1', 'Write. Format. Publish.'),
      h('p', 'Booky is your offline book studio — draft your manuscript, design a print-ready interior, craft a cover and export PDF and EPUB, all without an internet connection.'),
      h('div.row', { style: { gap: '10px', flexWrap: 'wrap' } },
        btn('New book', { icon: 'plus', kind: 'primary', cls: 'btn-lg', onClick: () => newBookDialog() }),
        btn('Import manuscript', { icon: 'file-up', cls: 'btn-lg', onClick: () => importFlow() }),
        btn('Open backup (.booky)', { icon: 'folder-open', kind: 'ghost', cls: 'btn-lg', onClick: () => importFlow('.booky,.json') }),
      )),
    books.length ? h('section.lib-section', h('h2', `Your books · ${books.length}`), shelf) : null,
    h('section.lib-section',
      h('h2', 'Start from a template'),
      h('div.tpl-grid', BOOK_TEMPLATES.map((t) => h('button.tpl-card', { type: 'button', on: { click: () => newBookDialog(t.id) } },
        h('span.tpl-ic', icon(t.icon, 20)), h('b', t.name), h('span', t.desc))))),
    books.length ? null : h('section.lib-section', shelf),
    h('footer.lib-foot',
      h('span', icon('lock', 12), ' Everything is stored privately in this browser — nothing is uploaded.'),
      h('span', 'Tip: export a .booky backup regularly to keep your work safe.')),
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
      { label: 'Download backup (.booky)', icon: 'download', onClick: () => downloadBackup(book) },
      { divider: true },
      { label: 'Delete book', icon: 'trash', danger: true, onClick: async () => {
        if (await confirmDialog('Delete book?', `“${book.meta.title}” will be permanently removed from this browser. Download a backup first if you might need it.`, { okLabel: 'Delete', danger: true })) {
          await db.deleteBook(book.id); toast('Book deleted'); rerender();
        }
      } },
    ], { align: 'right' });
  }, { cls: 'card-menu' });
  return h('div.book-card', { on: { click: open }, title: book.meta.title },
    h('div.book-cover-thumb', coverThumbnail(book, 240)), more,
    h('h3', book.meta.title || 'Untitled'),
    h('p', `${book.meta.author || 'No author'} · ${words.toLocaleString()} words`),
    h('p', `Edited ${timeAgo(book.updatedAt)}`));
}

function rerender() {
  const root = document.getElementById('app');
  clear(root);
  renderLibrary(root);
}

export function downloadBackup(book) {
  const blob = new Blob([JSON.stringify({ booky: 1, exportedAt: new Date().toISOString(), book }, null, 1)], { type: 'application/json' });
  downloadBlob(blob, `${slugify(book.meta.title)}.booky`);
}

export function newBookDialog(tplId = 'novel') {
  let chosen = tplId;
  const meta = { title: '', subtitle: '', author: state.app.lastAuthor || '' };
  const grid = h('div.tpl-grid', { style: { gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } });
  const draw = () => {
    clear(grid);
    BOOK_TEMPLATES.forEach((t) => grid.appendChild(h('button.tpl-card', {
      type: 'button', style: { padding: '10px', borderColor: t.id === chosen ? 'var(--primary)' : '', boxShadow: t.id === chosen ? 'var(--focus)' : '' },
      on: { click: () => { chosen = t.id; draw(); } },
    }, h('span.tpl-ic', { style: { width: '30px', height: '30px' } }, icon(t.icon, 16)), h('b', { style: { fontSize: '13px' } }, t.name))));
  };
  draw();
  const create = async () => {
    const book = bookFromTemplate(chosen, { title: meta.title.trim() || 'Untitled Book', subtitle: meta.subtitle.trim(), author: meta.author.trim() });
    setApp({ lastAuthor: meta.author.trim() });
    await db.putBook(book);
    m.close();
    location.hash = `#/book/${book.id}`;
  };
  const m = modal({
    title: 'Create a new book', width: 620,
    body: [
      h('div.grid-2',
        field('Title', input('', (v) => (meta.title = v), { placeholder: 'The Great Untitled' })),
        field('Author / pen name', input(meta.author, (v) => (meta.author = v), { placeholder: 'Your name' }))),
      field('Subtitle (optional)', input('', (v) => (meta.subtitle = v))),
      h('div.field-label', { style: { margin: '6px 0 8px' } }, 'Template'),
      grid,
      h('p.hint', { style: { marginTop: '10px' } }, 'Templates set up the structure (front matter, chapters, back matter) and a matching interior design. Everything can be changed later.'),
    ],
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
  }, icon('file-up', 30), h('div', h('b', 'Drop a file here or click to browse')), h('small', 'Word (.docx), Markdown (.md), Text (.txt), HTML, RTF or a Booky backup (.booky)'));

  const m = modal({
    title: targetBook ? 'Import into this book' : 'Import a manuscript', width: 640,
    body: [zone, status, opts, preview],
    footer: [btn('Cancel', { onClick: () => m.close() }), importBtn],
  });
}
