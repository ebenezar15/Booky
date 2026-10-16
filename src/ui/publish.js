// Publish mode: pre-flight checklist and every export format.
import { parseIsbn, isbnFindings } from '../core/isbn.js';
import { collectImages, imageFindings, measureImages } from '../core/image-check.js';
import { goToImage } from './feedback-actions.js';
import { collectXrefs, xrefResolves, collectIndexMarks } from '../core/index-gen.js';
import { h, icon, btn, clear, modal, toast, downloadBlob, slugify, add, celebrate, input, textarea } from './dom.js';
import { exportPdfDialog } from './pdf-dialog.js';
import { confirmNoPlaceholders, openMarkersPanel } from './writing-tools.js';
import { state, setMode, save, selectElement, touch } from '../core/store.js';
import { fontsUsedBy, BUNDLED_FONTS, lookalikeFor } from '../core/fonts.js';
import { bookWords, elementWords, displayTitle, htmlToText, ELEMENT_TYPES, orderedElements } from '../core/model.js';
import { findPlaceholders } from '../core/writing.js';
import { countChanges } from '../core/track.js';
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
    if (!(await confirmNoPlaceholders(book))) return;
    toast(`${label}…`);
    try { await fn(); } catch (e) { console.error(e); toast(`${label} failed: ${e.message}`, 'error', 5000); }
  };
  const fileBase = slugify(book.meta.title);

  add(wrap, 
    h('h2', 'Publish your book'),
    h('p.muted', `${book.meta.title || 'Untitled'} · ${bookWords(book).toLocaleString()} words · approx. ${pages} printed pages at ${w} × ${hh} in`),
    h('div.publish-cols',
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
            btn('Download EPUB', { kind: 'primary', icon: 'download', onClick: () => run('Building EPUB', async () => { const { buildEpub } = await import('../export/epub.js'); const { pageListIfWanted } = await import('../export/page-map.js'); downloadBlob(await buildEpub(book, { pageList: await pageListIfWanted(book) }), `${fileBase}.epub`); save(); toast('EPUB ready', 'success'); celebrate(); }) }),
          ]),
          card('file-text', 'linear-gradient(135deg,#2b6cb0,#4299e1)', 'Word document (DOCX)', 'A styled manuscript with headings, footnotes and images — for editors, agents, or publishers who ask for Word.', [
            btn('Download DOCX', { icon: 'download', title: 'A clean manuscript (tracked changes shown accepted)', onClick: () => run('Building DOCX', async () => { const { buildDocx } = await import('../export/docx.js'); downloadBlob(await buildDocx(book), `${fileBase}.docx`); toast('DOCX ready', 'success'); celebrate(); }) }),
            btn('DOCX for your editor', { kind: 'ghost', icon: 'messages-square', title: 'With your open review comments as Word comments and tracked changes as Word revisions. When it comes back, use Feedback → Import Word file.', onClick: async () => { const { buildDocx } = await import('../export/docx.js'); downloadBlob(await buildDocx(book, { forEditor: true }), `${fileBase}-for-editor.docx`); toast('Word file ready — when your editor sends it back, import it in Feedback', 'success', 5000); } }),
          ]),
          card('image', 'linear-gradient(135deg,#2f9e77,#6cc6a0)', 'Covers', 'Ebook cover (JPG, 1600 × 2560) and full print wrap with spine and back cover (PDF / PNG at 300 DPI).', [
            btn('Open cover designer', { icon: 'image', onClick: () => setMode('cover') }),
          ]),
          card('globe', 'linear-gradient(135deg,#6b7280,#9ca3af)', 'Web page (HTML)', 'A single, self-contained web page of your book — share it, host it, or read it in any browser.', [
            btn('HTML', { icon: 'download', onClick: () => run('Building HTML', async () => { const { buildHtml } = await import('../export/simple.js'); downloadBlob(new Blob([buildHtml(book)], { type: 'text/html' }), `${fileBase}.html`); }) }),
            btn('Print-ready HTML', { kind: 'ghost', title: 'Paged HTML you can open in Chrome and print to PDF, or use with other PDF tools', onClick: () => run('Building print HTML', async () => { await (await import('../render/book.js')).prepareRender(book); const { buildPrintHtml } = await import('../export/simple.js'); downloadBlob(new Blob([buildPrintHtml(book)], { type: 'text/html' }), `${fileBase}-print.html`); }) }),
          ]),
          card('file-code', 'linear-gradient(135deg,#334155,#64748b)', 'Markdown & plain text', 'Portable text formats for other tools, version control, or audiobook scripts.', [
            btn('Markdown', { icon: 'download', onClick: () => run('Building Markdown', async () => { const { buildMarkdown } = await import('../export/simple.js'); downloadBlob(new Blob([buildMarkdown(book)], { type: 'text/markdown' }), `${fileBase}.md`); }) }),
            btn('Text', { icon: 'download', onClick: () => run('Building text', async () => { const { buildText } = await import('../export/simple.js'); downloadBlob(new Blob([buildText(book)], { type: 'text/plain' }), `${fileBase}.txt`); }) }),
          ]),
          sampleCard(book, card, run, fileBase),
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

// Sample / "reader magnet": the first chapters and a call-to-action page, as EPUB or PDF.
function sampleCard(book, card, run, fileBase) {
  const o = book.settings.sample = { chapters: 3, buyUrl: '', newsletterUrl: '', message: '', ...(book.settings.sample || {}) };
  const set = (k) => (v) => { o[k] = k === 'chapters' ? Math.max(1, Math.round(+v) || 1) : v; touch('settings'); };
  const make = async () => (await import('../core/sample.js')).sampleBook(book, o);
  const opts = h('div.sample-opts', { style: { display: 'grid', gap: '8px', width: '100%', marginBottom: '6px' } },
    h('label.field', h('span', 'Chapters to include'), input(String(o.chapters), set('chapters'), { type: 'number', min: 1, max: 50, style: { width: '90px' } })),
    h('label.field', h('span', 'Link to buy the full book'), input(o.buyUrl, set('buyUrl'), { type: 'url', placeholder: 'https://…' })),
    h('label.field', h('span', 'Newsletter sign-up link (optional)'), input(o.newsletterUrl, set('newsletterUrl'), { type: 'url', placeholder: 'https://…' })),
    h('label.field', h('span', 'Message on the last page (optional)'), textarea(o.message, set('message'), { rows: 2, placeholder: 'Thank you for reading this sample…' })));
  return card('bookmark', 'linear-gradient(135deg,#7c3aed,#c084fc)', 'Sample / reader magnet', 'The first chapters and a call-to-action page with your buy and newsletter links — give it away on your website, newsletter or BookFunnel. It has no ISBN.', [
    opts,
    btn('Sample EPUB', { icon: 'download', onClick: () => run('Building sample EPUB', async () => { const { buildEpub } = await import('../export/epub.js'); downloadBlob(await buildEpub(await make()), `${fileBase}-sample.epub`); toast('Sample EPUB ready', 'success'); }) }),
    btn('Sample PDF', { icon: 'file-down', onClick: async () => exportPdfDialog(await make()) }),
  ]);
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
  const isbnRow = (key, title, emptyText, emptyLevel) => {
    const p = parseIsbn(m[key]);
    check(p.empty ? emptyLevel : p.ok ? 'ok' : 'bad', title, p.empty ? emptyText : p.ok ? p.formatted : p.message, () => openDetails('publishing'));
  };
  isbnRow('isbnPrint', 'Paperback ISBN', 'Not set (KDP can assign a free one; IngramSpark needs your own)', 'warn');
  if (m.isbnHardcover) isbnRow('isbnHardcover', 'Hardcover ISBN', '', 'ok');
  isbnRow('isbnEbook', 'Ebook ISBN', 'Optional for most ebook stores', 'warn');
  for (const f of isbnFindings(m).filter((x) => x.ok === 'warn')) check('warn', 'ISBNs', f.text, () => openDetails('publishing'));
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
  const xrefs = collectXrefs(els);
  if (xrefs.length) {
    const broken = xrefs.filter((x) => !xrefResolves(els, x.target));
    check(broken.length ? 'bad' : 'ok', 'Cross-references', broken.length
      ? `${broken.length} point to a page, heading or figure that no longer exists: ${broken.slice(0, 3).map((x) => `“${x.label || x.target}” in ${displayTitle(book, els.find((e) => e.id === x.elId))}`).join(', ')}`
      : `${xrefs.length} — all found`, broken.length ? () => { selectElement(broken[0].elId); setMode('write'); } : null);
  }
  const tc = countChanges(book.elements);
  if (tc) check('warn', 'Tracked changes', `${tc} not yet accepted or rejected — exports show them accepted`, () => import('./track-ui.js').then((m) => m.openChangesPanel(book)));
  const todo = findPlaceholders(orderedElements(book).filter((e) => e.include.print || e.include.ebook));
  const ph = todo.filter((f) => f.kind === 'placeholder');
  const notes = todo.length - ph.length;
  check(ph.length ? 'bad' : 'ok', 'Placeholders (TK, XX, [[…]], ???)', ph.length ? `${ph.length} left to fill in — exports ask before going ahead` : `None${notes ? ` · ${notes} note${notes === 1 ? '' : 's'} to self (never exported)` : ''}`, ph.length || notes ? () => openMarkersPanel(book) : null);
  const marks = collectIndexMarks(els);
  if (marks.length && !has('index')) check('warn', 'Index', `${marks.length} index entries but no Index page — add one from the left-hand panel`, null);
  const computer = [...fontsUsedBy(book)].filter((f) => !BUNDLED_FONTS.includes(f) && !state.app.customFonts.some((c) => c.name === f));
  if (computer.length) check('warn', 'Fonts from this computer', `${computer.join(', ')} — print exports from this computer are fine; ebooks use ${computer.map((f) => lookalikeFor(f) || 'the reader’s own font').join(', ')} instead`, () => setMode('format'));
  check(book.cover.background.type === 'image' && book.cover.background.image ? 'ok' : 'warn', 'Cover artwork', book.cover.background.type === 'image' ? 'Custom artwork' : 'Using a typographic cover — fine, or add artwork', () => setMode('cover'));

  const list = h('div.checklist');
  const score = items.filter((i) => i.level === 'ok').length;
  items.forEach((i) => list.appendChild(h(`div.check-item.${i.level}`, { style: { cursor: i.action ? 'pointer' : 'default' }, on: { click: () => i.action?.() } },
    icon(i.level === 'ok' ? 'circle-check' : 'triangle-alert', 17), h('div', h('b', i.title), h('span', i.detail)))));

  const proofOut = h('div');
  const layoutOut = h('div');
  const layoutBtn = btn('Check layout (widows, orphans, blank pages…)', { icon: 'triangle-alert', cls: 'btn-block', onClick: async () => {
    layoutBtn.disabled = true;
    layoutOut.textContent = 'Typesetting the book to check it…';
    try {
      const { checkLayoutOffscreen, drawLayoutReport } = await import('./layout-report.js');
      const { findings } = await checkLayoutOffscreen(book);
      drawLayoutReport(layoutOut, findings);
    } finally { layoutBtn.disabled = false; }
  } });
  const imagesOut = h('div');
  imageCheck(book, imagesOut);
  return h('div.card',
    h('div.row', h('b', 'Pre-flight check'), h('span.grow'), h('span.badge', `${score}/${items.length}`)),
    h('p.muted.small', 'Click an item to fix it.'),
    list,
    imagesOut,
    h('div', { style: { borderTop: '1px solid var(--border)', marginTop: '10px', paddingTop: '12px' } },
      btn('Proofread whole book', { icon: 'spell-check', cls: 'btn-block', onClick: () => proofreadAll(book, proofOut) }), proofOut,
      h('div', { style: { height: '8px' } }), layoutBtn, layoutOut));
}

/** Image checks (resolution, colour, bleed, alt text), each clickable to the image. */
export async function imageCheck(book, out, opts = {}) {
  const images = collectImages(book);
  if (!images.length) return [];
  const dims = await measureImages(images);
  const found = imageFindings(book, images, dims, opts);
  clear(out);
  add(out, h('div.section-title', { style: { marginTop: '12px' } }, `Images (${images.length})`));
  if (!found.length) add(out, h('div.check-item.ok', icon('circle-check', 17), h('div', h('b', 'All images'), h('span', 'Sharp enough for print, with alt text'))));
  for (const f of found) {
    add(out, h(`div.check-item.${f.level}`, { style: { cursor: 'pointer' }, title: 'Show this image', on: { click: () => goToImage(f.elId, f.index, { editAlt: f.kind === 'alt' }) } },
      icon('triangle-alert', 17), h('div', h('b', { ppi: 'Image resolution', color: 'Colour images', bleed: 'Full-page image', alt: 'Alt text missing' }[f.kind]), h('span', f.text),
        f.kind === 'alt' ? h('span.small', { style: { color: 'var(--primary)' } }, ' Fill in alt text →') : null)));
  }
  return found;
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
