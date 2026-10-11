// Publish mode: pre-flight checklist and every export format.
import { h, icon, btn, clear, modal, toast, downloadBlob, slugify, add, celebrate } from './dom.js';
import { state, setMode, save } from '../core/store.js';
import { bookWords, elementWords, displayTitle, htmlToText, ELEMENT_TYPES } from '../core/model.js';
import { trimOf } from '../core/themes.js';
import { estimatePages } from '../render/cover.js';
import { PrintPreview } from '../render/preview.js';
import { downloadBackup } from './library.js';
import { platformGrid } from './platforms.js';
import { openDetails } from './details.js';
import { checkText } from '../lang/grammar.js';
import { findMisspelled, WORD_RE, shouldSkip } from '../lang/spell.js';

export function renderPublish(host) {
  const book = state.book;
  const wrap = h('section.publish');
  host.appendChild(wrap);

  const pages = estimatePages(book);
  const { w, h: hh } = trimOf(book.format);

  const card = (ic, bg, title, desc, actions) => h('div.export-card',
    h('div.ec-ic', { style: { background: bg } }, icon(ic, 22)),
    h('h3', title), h('p', desc), h('div.row', { style: { flexWrap: 'wrap' } }, actions));

  const run = async (label, fn) => {
    toast(`${label}…`);
    try { await fn(); } catch (e) { console.error(e); toast(`${label} failed: ${e.message}`, 'error', 5000); }
  };
  const fileBase = slugify(book.meta.title);

  add(wrap, 
    h('h2', 'Publish your book'),
    h('p.muted', `${book.meta.title || 'Untitled'} · ${bookWords(book).toLocaleString()} words · approx. ${pages} printed pages at ${w} × ${hh} in`),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 380px)', gap: '22px', alignItems: 'start', marginTop: '8px' } },
      h('div',
        h('div.card.platform-card',
          h('h3', { style: { margin: '0 0 2px' } }, 'Publish to a platform'),
          h('p.muted.small', { style: { margin: '0 0 12px' } }, 'Pick where you are publishing. Booky checks the platform’s requirements and builds a ready-to-upload package with the right files and sizes.'),
          platformGrid(book)),
        h('div.section-title', { style: { marginTop: '24px' } }, 'All export formats'),
        h('div.export-grid', { style: { marginTop: '8px' } },
          card('file-down', 'var(--grad)', 'Print-ready PDF', 'Paginated interior with your trim size, mirrored margins, running heads and page numbers — ready for KDP Print, IngramSpark, Lulu or any printer.', [
            btn('Export PDF', { kind: 'primary', icon: 'file-down', onClick: () => printPdf(book) }),
            btn('Preview', { kind: 'ghost', onClick: () => setMode('format') }),
          ]),
          card('tablet', 'linear-gradient(135deg,#e07a5f,#f2a65a)', 'EPUB ebook', 'Reflowable EPUB 3 with cover, navigation and metadata — upload to Kindle (KDP), Apple Books, Kobo, Google Play, Barnes & Noble.', [
            btn('Download EPUB', { kind: 'primary', icon: 'download', onClick: () => run('Building EPUB', async () => { const { buildEpub } = await import('../export/epub.js'); downloadBlob(await buildEpub(book), `${fileBase}.epub`); save(); toast('EPUB ready', 'success'); celebrate(); }) }),
          ]),
          card('file-text', 'linear-gradient(135deg,#2b6cb0,#4299e1)', 'Word document (DOCX)', 'A styled manuscript with headings, footnotes and images — for editors, agents, or publishers who ask for Word.', [
            btn('Download DOCX', { icon: 'download', onClick: () => run('Building DOCX', async () => { const { buildDocx } = await import('../export/docx.js'); downloadBlob(await buildDocx(book), `${fileBase}.docx`); toast('DOCX ready', 'success'); celebrate(); }) }),
          ]),
          card('image', 'linear-gradient(135deg,#2f9e77,#6cc6a0)', 'Covers', 'Ebook cover (JPG, 1600 × 2560) and full print wrap with spine and back cover (PDF / PNG at 300 DPI).', [
            btn('Open cover designer', { icon: 'image', onClick: () => setMode('cover') }),
          ]),
          card('globe', 'linear-gradient(135deg,#6b7280,#9ca3af)', 'Web page (HTML)', 'A single, self-contained web page of your book — share it, host it, or read it in any browser.', [
            btn('HTML', { icon: 'download', onClick: () => run('Building HTML', async () => { const { buildHtml } = await import('../export/simple.js'); downloadBlob(new Blob([buildHtml(book)], { type: 'text/html' }), `${fileBase}.html`); }) }),
            btn('Print-ready HTML', { kind: 'ghost', title: 'Paged HTML you can open in Chrome and print to PDF, or use with other PDF tools', onClick: () => run('Building print HTML', async () => { const { buildPrintHtml } = await import('../export/simple.js'); downloadBlob(new Blob([buildPrintHtml(book)], { type: 'text/html' }), `${fileBase}-print.html`); }) }),
          ]),
          card('file-code', 'linear-gradient(135deg,#334155,#64748b)', 'Markdown & plain text', 'Portable text formats for other tools, version control, or audiobook scripts.', [
            btn('Markdown', { icon: 'download', onClick: () => run('Building Markdown', async () => { const { buildMarkdown } = await import('../export/simple.js'); downloadBlob(new Blob([buildMarkdown(book)], { type: 'text/markdown' }), `${fileBase}.md`); }) }),
            btn('Text', { icon: 'download', onClick: () => run('Building text', async () => { const { buildText } = await import('../export/simple.js'); downloadBlob(new Blob([buildText(book)], { type: 'text/plain' }), `${fileBase}.txt`); }) }),
          ]),
          card('file-archive', 'linear-gradient(135deg,#a16207,#d99a1e)', 'Project backup', 'Everything — text, notes, snapshots, design and cover — in one .booky file. Open it on any computer with Booky.', [
            btn('Download backup', { icon: 'download', onClick: () => downloadBackup(book) }),
          ]),
        ),
      ),
      h('aside', preflight(book)),
    ),
  );
  return () => {};
}

function kdpGutter(pages) {
  if (pages <= 150) return 0.375;
  if (pages <= 300) return 0.5;
  if (pages <= 500) return 0.625;
  if (pages <= 700) return 0.75;
  return 0.875;
}

function preflight(book) {
  const m = book.meta;
  const items = [];
  const check = (level, title, detail, action) => items.push({ level, title, detail, action });
  const els = book.elements;
  const has = (t) => els.some((e) => e.type === t && (e.include.print || e.include.ebook));
  const pages = estimatePages(book);

  check(m.title && m.title !== 'Untitled Book' ? 'ok' : 'bad', 'Title', m.title || 'Missing', () => openDetails());
  check(m.author ? 'ok' : 'bad', 'Author name', m.author || 'Missing — shown on title page and cover', () => openDetails());
  check(m.isbnPrint ? 'ok' : 'warn', 'Print ISBN', m.isbnPrint || 'Not set (some platforms assign a free one)', () => openDetails('publishing'));
  check(m.isbnEbook ? 'ok' : 'warn', 'Ebook ISBN', m.isbnEbook || 'Optional for most ebook stores', () => openDetails('publishing'));
  check(m.description ? 'ok' : 'warn', 'Book description', m.description ? `${m.description.split(/\s+/).length} words` : 'Add a blurb for the EPUB metadata and back cover', () => openDetails('marketing'));
  check(has('title') ? 'ok' : 'warn', 'Title page', has('title') ? 'Included' : 'Recommended for print books');
  check(has('copyright') ? 'ok' : 'warn', 'Copyright page', has('copyright') ? 'Included' : 'Strongly recommended');
  check(has('toc') ? 'ok' : 'warn', 'Table of contents', has('toc') ? 'Generated automatically' : 'Recommended (required by some ebook stores)');
  const empty = els.filter((e) => ['chapter', 'prologue', 'epilogue'].includes(e.type) && elementWords(e) < 10);
  check(empty.length ? 'warn' : 'ok', 'Empty chapters', empty.length ? empty.map((e) => displayTitle(book, e)).slice(0, 4).join(', ') + (empty.length > 4 ? '…' : '') : 'None', null);
  const placeholders = els.filter((e) => /Add an illustration here|Title of Book|Author Name, <em>Source|Note text\.|Term<\/strong> — Definition/.test(e.content) && (e.include.print || e.include.ebook));
  check(placeholders.length ? 'warn' : 'ok', 'Template sample text', placeholders.length ? `Replace sample text in: ${placeholders.map((e) => displayTitle(book, e)).join(', ')}` : 'None left', null);
  check(pages >= 24 ? 'ok' : 'warn', 'Page count', `≈ ${pages} pages${pages < 24 ? ' — most printers need at least 24' : ''}${book.cover.lastPageCount ? ' (from last preview)' : ' (estimate — open Format to measure)'}`, () => setMode('format'));
  const need = kdpGutter(pages);
  check(book.format.margins.inside >= need ? 'ok' : 'bad', 'Inside margin (gutter)', `${book.format.margins.inside} in — ${pages} pages need at least ${need} in`, () => setMode('format'));
  check(book.cover.background.type === 'image' && book.cover.background.image ? 'ok' : 'warn', 'Cover artwork', book.cover.background.type === 'image' ? 'Custom artwork' : 'Using a typographic cover — fine, or add artwork', () => setMode('cover'));

  const list = h('div.checklist');
  const score = items.filter((i) => i.level === 'ok').length;
  items.forEach((i) => list.appendChild(h(`div.check-item.${i.level}`, { style: { cursor: i.action ? 'pointer' : 'default' }, on: { click: () => i.action?.() } },
    icon(i.level === 'ok' ? 'circle-check' : 'triangle-alert', 17), h('div', h('b', i.title), h('span', i.detail)))));

  const proofOut = h('div');
  return h('div.card',
    h('div.row', h('b', 'Pre-flight check'), h('span.grow'), h('span.badge', `${score}/${items.length}`)),
    h('p.muted.small', 'Click an item to fix it.'),
    list,
    h('div', { style: { borderTop: '1px solid var(--border)', marginTop: '10px', paddingTop: '12px' } },
      btn('Proofread whole book', { icon: 'spell-check', cls: 'btn-block', onClick: () => proofreadAll(book, proofOut) }), proofOut));
}

async function proofreadAll(book, out) {
  clear(out).appendChild(h('p.muted.small', 'Checking every chapter…'));
  const rows = [];
  for (const el of book.elements) {
    if (el.type === 'toc') continue;
    const text = htmlToText(el.content);
    if (!text.trim()) continue;
    const words = (text.match(WORD_RE) || []).map((w) => w.replace(/['’]+$/, '')).filter((w) => !shouldSkip(w) && !/\{\{/.test(w));
    const bad = await findMisspelled(words);
    const g = text.split('\n').flatMap((p) => checkText(p, { grammar: true, style: false }));
    const s = text.split('\n').flatMap((p) => checkText(p, { grammar: false, style: true, fiction: state.app.fictionHints !== false }));
    if (bad.size || g.length || s.length) rows.push({ el, sp: words.filter((w) => bad.has(w)).length, uniq: [...bad].slice(0, 6), g: g.length, s: s.length });
  }
  clear(out);
  if (!rows.length) { out.appendChild(h('p', { style: { color: 'var(--success)' } }, icon('circle-check', 16), ' No issues found in the whole book.')); return; }
  out.appendChild(h('p.small.muted', { style: { margin: '10px 0 6px' } }, 'Click a chapter to open it:'));
  rows.forEach((r) => out.appendChild(h('div.check-item', { style: { cursor: 'pointer' }, on: { click: () => { state.currentId = r.el.id; setMode('write'); } } },
    icon(ELEMENT_TYPES[r.el.type]?.icon || 'file', 16),
    h('div', h('b', displayTitle(book, r.el)), h('span', `${r.sp} spelling · ${r.g} grammar · ${r.s} style${r.uniq.length ? ` — ${r.uniq.join(', ')}` : ''}`)))));
}

export { exportPdfDialog as printPdf } from './pdf-dialog.js';
