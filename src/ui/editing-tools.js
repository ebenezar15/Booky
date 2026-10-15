// Editing and consistency tools for the Review screen: consistency checker, script checks (Indian languages,
// Urdu), house style sheet, typographic clean-up, direct-formatting finder, and version comparison.
import { h, icon, btn, iconBtn, clear, add, modal, toast, confirmDialog, select, input, downloadBlob, slugify, field, pickFile, readAsText, menu } from './dom.js';
import { state, touch } from '../core/store.js';
import { orderedElements, displayTitle, htmlToText, fillPlaceholders, ELEMENT_TYPES } from '../core/model.js';
import { takeSnapshot } from '../core/actions.js';
import { consistencyFindings, applyFix, replaceInHtmlText, normalizeStyleSheet, styleSheetHtml } from '../core/consistency.js';
import { cleanHtml, indicFindings, applyIndicFix, supportsIndicChecks, paragraphDiff, restoreParagraph } from '../core/typography.js';
import { diffWords, diffStats } from '../core/diff.js';
import { isEnglish, langInfo } from '../core/languages.js';
import { findMatches } from '../editor/find.js';
import { withEditor } from './feedback-actions.js';
import { getEditor } from './editor-view.js';
import { PARAGRAPH_STYLES } from '../editor/extensions.js';
import { punctuationFindings, fixPunctuation } from '../lang/punctuation.js';

const SKIP = new Set(['toc', 'index', 'blank', 'copyright', 'title', 'half-title']);
const units = (book) => orderedElements(book).filter((e) => !SKIP.has(e.type) && !ELEMENT_TYPES[e.type]?.generated)
  .map((e) => ({ elId: e.id, text: htmlToText(fillPlaceholders(e.content || '', book)) }));
const titleOf = (book, id) => displayTitle(book, book.elements.find((e) => e.id === id) || {});

/** Save the open chapter first, so book-wide edits work on the latest text. */
function syncEditor(book) {
  const ed = getEditor();
  const el = book.elements.find((e) => e.id === state.currentId);
  if (ed && !ed.isDestroyed && el) el.content = ed.getHTML();
}
function afterBookEdit(book) {
  touch('elements');
  const ed = getEditor();
  const el = book.elements.find((e) => e.id === state.currentId);
  if (ed && !ed.isDestroyed && el && ed.getHTML() !== el.content) ed.commands.setContent(el.content);
}

/** Select the hit in the editor: the n-th occurrence of its text in that chapter. */
function goToHit(book, hit, then) {
  const text = units(book).find((u) => u.elId === hit.elId)?.text || '';
  let n = 0, i = -1;
  while ((i = text.indexOf(hit.match, i + 1)) !== -1 && i < hit.index) n++;
  withEditor(hit.elId, (ed) => {
    const m = findMatches(ed.state.doc, hit.match, { caseSensitive: true })[n];
    if (!m) { toast('Couldn’t find that spot — the text may have changed. Re-run the check.', 'warn'); return; }
    ed.chain().focus().setTextSelection(m).run();
    ed.view.domAtPos(m.from)?.node?.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    then?.(ed, m);
  });
}

/** Apply a text transformation to every changed chapter, with a snapshot first. Returns how many chapters changed. */
function editAll(book, fn, snapshotName) {
  syncEditor(book);
  let changed = 0;
  for (const el of book.elements) {
    if (SKIP.has(el.type)) continue;
    const next = fn(el.content || '', el);
    if (next !== el.content) { takeSnapshot(el, snapshotName); el.content = next; changed++; }
  }
  if (changed) afterBookEdit(book);
  return changed;
}

const wordReplacer = (variants, preferred) => {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\p{L}\\p{N}-])(${variants.map(esc).join('|')})(?![\\p{L}\\p{N}-])`, 'gu');
  return (t) => t.replace(re, preferred);
};

// ---------- finding cards (shared by consistency and script checks) ----------
function findingList(body, book, findings, { replacement, fixAll, addWord, empty, rerun }) {
  if (!findings.length) { body.appendChild(h('div.empty-state', icon('circle-check', 30), h('h3', empty), h('p', 'Nothing differs from the style sheet.'))); return; }
  body.appendChild(h('p.muted.small', `${findings.length} thing${findings.length === 1 ? '' : 's'} to look at. “Fix all” takes a snapshot of each chapter it changes, so it can be undone from History.`));
  for (const f of findings) {
    let at = 0;
    const where = h('span.small.muted');
    const showWhere = () => { const hit = f.hits[at]; where.textContent = hit ? `${at + 1} of ${f.hits.length} · ${titleOf(book, hit.elId)}` : ''; };
    showWhere();
    const rep = replacement(f);
    add(body, h('div.card.finding', { style: { marginBottom: '10px', padding: '12px 14px' } },
      h('div.row', { style: { gap: '8px', alignItems: 'baseline' } }, h('b', f.title), h('span.grow'), where),
      h('p.small', { style: { margin: '4px 0 8px' } }, f.detail),
      h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } },
        btn('Show', { cls: 'btn-sm', icon: 'search', onClick: () => { goToHit(book, f.hits[at]); at = (at + 1) % f.hits.length; showWhere(); } }),
        rep ? btn('Fix this', { cls: 'btn-sm', onClick: () => goToHit(book, f.hits[at], (ed, m) => { ed.chain().focus().insertContentAt(m, rep(f.hits[at].match)).run(); toast('Fixed — Ctrl Z to undo', 'success', 1500); }) }) : null,
        fixAll(f) ? btn('Fix all', { cls: 'btn-sm', kind: 'primary', onClick: async () => {
          if (!(await confirmDialog('Fix all?', `${f.hits.length} place${f.hits.length === 1 ? '' : 's'} will change. A snapshot of each chapter is taken first.`, { okLabel: 'Fix all' }))) return;
          const n = editAll(book, (html) => replaceInHtmlText(html, fixAll(f)), `Before “${f.title.slice(0, 40)}”`);
          toast(`Changed ${n} chapter${n === 1 ? '' : 's'}`, 'success');
          rerun();
        } }) : null,
        addWord && f.preferred && /^[\p{L}][\p{L}\p{M}' -]*$/u.test(f.preferred) ? btn('Add to style sheet', { cls: 'btn-sm', kind: 'ghost', onClick: () => { addWord(f.preferred); rerun(); } }) : null)));
  }
}

export function consistencyTab(body, book, rerun) {
  clear(body);
  const sheet = book.styleSheet = normalizeStyleSheet(book.styleSheet);
  const names = (book.bible || []).flatMap((b) => [b.name, ...(String(b.name || '').split(/\s+/))]).filter((n) => n && [...n].length >= 4);
  const findings = consistencyFindings(units(book), sheet, { names: [...new Set(names)] });
  add(body, h('div.notice', icon('info', 16), h('span', `Checked against your style sheet (${{ us: 'US', uk: 'UK', in: 'Indian' }[sheet.variety]} English${sheet.words.length ? `, ${sheet.words.length} word-list entries` : ''}) and story-bible names. Change the rules in the Style sheet tab.`)));
  findingList(body, book, findings, {
    empty: 'Consistent throughout',
    replacement: (f) => (f.fix ? (m) => applyFix(m, f.fix) : f.preferred && f.kind !== 'quotes' && f.kind !== 'percent' ? () => f.preferred : null),
    fixAll: (f) => (f.fix ? (t) => applyFix(t, f.fix) : f.preferred && f.variants.length && f.kind !== 'quotes' && f.kind !== 'percent' ? wordReplacer(f.variants, f.preferred) : null),
    addWord: (w) => { if (!sheet.words.some((x) => x.word.toLowerCase() === w.toLowerCase())) sheet.words.push({ word: w, note: '' }); touch('styleSheet'); toast(`“${w}” added to the word list`, 'success'); },
    rerun,
  });
}

export function scriptCheckTab(body, book, rerun) {
  clear(body);
  const lang = book.meta.language || 'en';
  const findings = indicFindings(units(book), lang);
  add(body, h('div.notice', icon('info', 16), h('span', `Unicode checks for ${langInfo(lang).name || lang}: text not in standard form, stray zero-width joiners, Latin letters or digits inside words, letters from another script${String(lang).startsWith('ur') ? ', Arabic letters used instead of Urdu ones' : ''}, and doubled vowel signs.`)));
  findingList(body, book, findings, {
    empty: 'No script problems found',
    replacement: (f) => (f.fix ? (m) => applyIndicFix(m, f) : null),
    fixAll: (f) => (f.fix ? (t) => applyIndicFix(t, f) : null),
    rerun,
  });
}

export function punctuationTab(body, book, rerun) {
  clear(body);
  syncEditor(book);
  const lang = book.meta.language || 'en';
  const findings = punctuationFindings(units(book), lang);
  add(body, h('div.notice', icon('info', 16), h('span', `Punctuation checks for ${langInfo(lang).name || lang}: spaces before or after marks, doubled marks, brackets and quotation marks without a partner${{ ur: ', the Urdu ، ؟ ؛ ۔', ar: ', the Arabic ، ؟ ؛', fa: ', the Persian ، ؟ ؛', hi: ', the danda । and ॥', sa: ', the danda । and ॥', ne: ', the danda । and ॥', bn: ', the danda ।', pa: ', the danda ।', or: ', the danda ।', es: ', the opening ¿ and ¡', fr: ', the spaces French puts before ; : ! ? and inside « »', zh: ', full-width marks', ja: ', full-width marks' }[String(lang).split('-')[0]] || ''}.`)));
  findingList(body, book, findings.map((f) => ({ ...f, title: `${f.title} (${f.hits.length})` })), {
    empty: 'No punctuation problems found',
    replacement: (f) => (f.fix ? (m) => f.hits.find((x) => x.match === m)?.replacement ?? fixPunctuation(m, f.id, lang) : null),
    // leave HTML entities such as &lt; and &amp; alone
    fixAll: (f) => (f.fix ? (t) => t.split(/(&#?\w+;)/).map((part, i) => (i % 2 ? part : fixPunctuation(part, f.id, lang))).join('') : null),
    rerun,
  });
}

// ---------- style sheet ----------
export function styleSheetTab(body, book) {
  clear(body);
  const s = book.styleSheet = normalizeStyleSheet(book.styleSheet);
  const set = (k) => (v) => { s[k] = k === 'serialComma' ? v : v; touch('styleSheet'); if (k === 'variety') import('../lang/spell.js').then((m) => m.applyBookSpelling(book)); };
  const sel = (k, opts) => select(opts, String(s[k]), (v) => set(k)(k === 'serialComma' ? v === 'true' : v));
  const words = h('div.ss-words');
  const drawWords = () => {
    clear(words);
    const list = [...s.words].sort((a, b) => a.word.localeCompare(b.word));
    if (!list.length) words.appendChild(h('p.muted.small', 'No words yet. Add chosen spellings, capitalisation and hyphenation (email, okay, Mum, invented words, character names).'));
    for (const w of list) words.appendChild(h('div.row.ss-word', h('b', w.word), input(w.note || '', (v) => { w.note = v; touch('styleSheet'); }, { placeholder: 'Note (optional)', style: { flex: 1 } }),
      iconBtn('trash', 'Remove', () => { s.words = s.words.filter((x) => x !== w); touch('styleSheet'); drawWords(); }, { size: 15 })));
  };
  drawWords();
  const newWord = h('input.input', { placeholder: 'Add a word…', on: { keydown: (e) => { if (e.key === 'Enter') addWord(); } } });
  const addWord = () => {
    const w = newWord.value.trim();
    if (!w || s.words.some((x) => x.word === w)) return;
    s.words.push({ word: w, note: '' });
    newWord.value = '';
    touch('styleSheet');
    drawWords();
  };
  const english = isEnglish(book.meta.language);
  add(body,
    h('p.muted', 'The decisions a copyeditor records for this book. The consistency check uses them, and they go with review copies so your editor and readers see them too.'),
    h('div.grid-2', { style: { gap: '12px', maxWidth: '760px' } },
      english ? field('Spelling', sel('variety', [['us', 'US English (color, realize)'], ['uk', 'UK English (colour, realise)'], ['in', 'Indian English (colour, realise)']]), 'Also changes spell-check suggestions.') : null,
      field('Serial (Oxford) comma', sel('serialComma', [['true', 'Yes — red, white, and blue'], ['false', 'No — red, white and blue']])),
      field('Dashes', sel('dash', [['em-closed', 'Closed em dash—like this'], ['en-spaced', 'Spaced en dash – like this']])),
      field('Quotation marks', sel('quotes', [['double', '“Double” (‘single’ inside)'], ['single', '‘Single’ (“double” inside)']])),
      field('Ellipsis', sel('ellipsis', [['char', 'One character …'], ['dots', 'Three full stops ...'], ['spaced', 'Spaced . . .']])),
      field('Numbers', sel('numbers', [['words-10', 'Spell out one to ten'], ['words-100', 'Spell out one to one hundred'], ['numerals', 'Figures']])),
      field('Percentages', sel('percent', [['percent', '5 percent'], ['per-cent', '5 per cent'], ['symbol', '5%']])),
      field('Dates', sel('dates', [['mdy', 'October 13, 2026'], ['dmy', '13 October 2026']]))),
    h('div.section-title', { style: { marginTop: '18px' } }, 'Word list'),
    h('div.row', { style: { gap: '8px', maxWidth: '760px', marginBottom: '8px' } }, newWord, btn('Add', { icon: 'plus', onClick: addWord }),
      (book.bible || []).length ? btn('Add story-bible names', { kind: 'ghost', onClick: () => {
        let n = 0;
        for (const b of book.bible) if (b.name && !s.words.some((x) => x.word === b.name)) { s.words.push({ word: b.name, note: b.kind || '' }); n++; }
        touch('styleSheet'); drawWords(); toast(n ? `Added ${n} name${n === 1 ? '' : 's'}` : 'All names are already in the list', 'success');
      } }) : null),
    words,
    h('div.row', { style: { gap: '8px', marginTop: '16px' } },
      btn('Print / save for a copyeditor', { icon: 'printer', onClick: () => {
        const html = styleSheetHtml(book, s);
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); } else downloadBlob(new Blob([html], { type: 'text/html' }), `${slugify(book.meta.title)}-style-sheet.html`);
      } }),
      btn('Download (.html)', { kind: 'ghost', icon: 'download', onClick: () => downloadBlob(new Blob([styleSheetHtml(book, s)], { type: 'text/html' }), `${slugify(book.meta.title)}-style-sheet.html`) })),
  );
}

// ---------- typographic clean-up ----------
export function typographyTab(body, book, rerun) {
  clear(body);
  const lang = book.meta.language || 'en';
  const results = orderedElements(book).filter((e) => !SKIP.has(e.type)).map((e) => ({ el: e, ...cleanHtml(e.content || '', { lang }) })).filter((r) => r.changes.length);
  const total = results.reduce((n, r) => n + r.changes.length, 0);
  add(body, h('p.muted', 'Curly quotes and apostrophes (including ’90s), one-character ellipses, single spaces, no space before punctuation (French books keep a thin space), and no-break spaces after Mr./Dr., between a number and its unit, and in “Chapter 12” or “page 4” so they never split across lines.'));
  if (!total) { body.appendChild(h('div.empty-state', icon('circle-check', 30), h('h3', 'Nothing to clean up'))); return; }
  add(body,
    h('div.row', { style: { gap: '8px', margin: '8px 0 14px' } }, h('b', `${total} change${total === 1 ? '' : 's'} in ${results.length} chapter${results.length === 1 ? '' : 's'}`), h('span.grow'),
      btn('Apply all', { kind: 'primary', icon: 'wand-sparkles', onClick: () => {
        const n = editAll(book, (html) => cleanHtml(html, { lang }).html, 'Before typography clean-up');
        toast(`Cleaned ${n} chapter${n === 1 ? '' : 's'} — undo from each chapter’s History`, 'success');
        rerun();
      } })),
    ...results.map((r) => h('div.card', { style: { marginBottom: '10px', padding: '10px 14px' } },
      h('b', displayTitle(book, r.el)), h('span.muted.small', ` · ${r.changes.length}`),
      h('div.typo-changes', r.changes.slice(0, 8).map((c) => h('div.typo-change', h('del', c.before), icon('arrow-right', 12), h('ins', c.after)))),
      r.changes.length > 8 ? h('p.muted.small', `…and ${r.changes.length - 8} more`) : null)),
  );
}

// ---------- direct formatting ----------
function styledSpans(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return { tpl, spans: [...tpl.content.querySelectorAll('span[style]')].filter((s) => /font-family|font-size|(^|;)\s*color/i.test(s.getAttribute('style'))) };
}
const describe = (sp) => {
  const st = sp.style;
  return [st.fontFamily && `font ${st.fontFamily.split(',')[0].replace(/["']/g, '')}`, st.fontSize && `size ${st.fontSize}`, st.color && `colour ${st.color}`].filter(Boolean).join(', ');
};
const unwrap = (sp) => { const p = sp.parentNode; while (sp.firstChild) p.insertBefore(sp.firstChild, sp); sp.remove(); };

export function directFormattingTab(body, book, rerun) {
  clear(body);
  const items = [];
  for (const el of orderedElements(book)) {
    const { spans } = styledSpans(el.content || '');
    spans.forEach((sp, i) => items.push({ el, i, what: describe(sp), text: sp.textContent.trim().slice(0, 80) }));
  }
  add(body, h('p.muted', 'Text where a font, size or colour was set by hand. Hand formatting doesn’t follow your design — when you change the theme or font, these places stay as they are. Clear it, or use a paragraph style instead.'));
  if (!items.length) { body.appendChild(h('div.empty-state', icon('circle-check', 30), h('h3', 'No hand formatting'), h('p', 'Every page follows the book design.'))); return; }
  const clearOne = (it, pstyle) => {
    syncEditor(book);
    takeSnapshot(it.el, 'Before clearing formatting');
    const { tpl, spans } = styledSpans(it.el.content);
    const sp = spans[it.i];
    if (pstyle != null) { const block = sp.closest('p, h1, h2, h3, h4'); if (block) { block.className = block.className.replace(/\bps-[\w-]+\b/g, '').trim(); if (pstyle) block.classList.add(`ps-${pstyle}`); } }
    unwrap(sp);
    const d = document.createElement('div'); d.appendChild(tpl.content);
    it.el.content = d.innerHTML;
    afterBookEdit(book);
  };
  add(body, h('div.row', { style: { gap: '8px', margin: '8px 0 14px' } }, h('b', `${items.length} place${items.length === 1 ? '' : 's'}`), h('span.grow'),
    btn('Clear all', { kind: 'primary', onClick: async () => {
      if (!(await confirmDialog('Clear all hand formatting?', 'Fonts, sizes and colours set by hand are removed so the text follows your design. A snapshot of each chapter is taken first.', { okLabel: 'Clear all' }))) return;
      const n = editAll(book, (html) => { const { tpl, spans } = styledSpans(html); if (!spans.length) return html; spans.forEach(unwrap); const d = document.createElement('div'); d.appendChild(tpl.content); return d.innerHTML; }, 'Before clearing formatting');
      toast(`Cleared formatting in ${n} chapter${n === 1 ? '' : 's'}`, 'success');
      rerun();
    } })));
  // group per element so indexes stay valid after each single clear (re-run after every action)
  for (const it of items) add(body, h('div.card', { style: { marginBottom: '8px', padding: '10px 14px' } },
    h('div.row', { style: { gap: '8px' } }, h('b', displayTitle(book, it.el)), h('span.small.muted', it.what), h('span.grow'),
      btn('Show', { cls: 'btn-sm', onClick: () => goToHit(book, { elId: it.el.id, index: htmlToText(it.el.content).indexOf(it.text), match: it.text.slice(0, 60) }) }),
      btn('Clear', { cls: 'btn-sm', onClick: () => { clearOne(it); rerun(); } }),
      btn('Use a style…', { cls: 'btn-sm', kind: 'ghost', onClick: (e) => menu(e.currentTarget, PARAGRAPH_STYLES.map((p) => ({ label: p.label, onClick: () => { clearOne(it, p.id); rerun(); } }))) })),
    h('p.small', { style: { margin: '6px 0 0', fontFamily: 'var(--font-serif)' } }, `“${it.text}”`)));
}

// ---------- compare versions ----------
/**
 * Compare an older version of a page with the current text, paragraph by paragraph, with word-level highlights.
 * opts: { title, oldHtml, el, onRestored }
 */
export function compareDialog(book, { title, oldHtml, el, onRestoreAll }) {
  const view = h('div.cmp-view');
  const stats = h('p.small.muted');
  const draw = () => {
    syncEditor(book);
    const cur = el.content || '';
    const changes = paragraphDiff(oldHtml, cur);
    const s = diffStats(diffWords(htmlToText(oldHtml), htmlToText(cur)));
    stats.textContent = changes.every((c) => c.op === '=') ? 'No changes.' : s.added || s.removed ? `${s.added.toLocaleString()} words added and ${s.removed.toLocaleString()} removed. Restore single paragraphs, or the whole page.` : 'Only formatting changed (the words are the same). Restore single paragraphs, or the whole page.';
    clear(view);
    for (const c of changes) {
      if (c.op === '=') { view.appendChild(h('div.cmp-same', htmlToText(c.new).trim().slice(0, 140) + (htmlToText(c.new).length > 140 ? '…' : ''))); continue; }
      const parts = c.op === '~' ? diffWords(htmlToText(c.old).trim(), htmlToText(c.new).trim()) : c.op === '-' ? [{ op: '-', text: htmlToText(c.old).trim() }] : [{ op: '+', text: htmlToText(c.new).trim() }];
      view.appendChild(h(`div.cmp-para.${{ '~': 'changed', '-': 'removed', '+': 'added' }[c.op]}`,
        h('div.cmp-text', parts.map((p) => (p.op === '=' ? p.text : h(p.op === '+' ? 'ins' : 'del', p.text)))),
        h('div.cmp-actions', h('span.small.muted', { '~': 'Changed', '-': 'Deleted since', '+': 'Added since' }[c.op]),
          btn(c.op === '+' ? 'Remove this paragraph' : 'Restore this paragraph', { cls: 'btn-sm', onClick: () => {
            takeSnapshot(el, `Before restoring a paragraph from “${title}”`);
            el.content = restoreParagraph(el.content, c);
            afterBookEdit(book);
            toast('Paragraph restored — the previous text is in History', 'success', 2500);
            draw();
          } }))));
    }
  };
  draw();
  const m = modal({ title: `${displayTitle(book, el)}: “${title}” → now`, width: 820, body: [stats, view],
    footer: [btn('Close', { onClick: () => m.close() }), onRestoreAll ? btn('Restore the whole page', { kind: 'primary', icon: 'rotate-ccw', onClick: () => { m.close(); onRestoreAll(); } }) : null] });
}

// ---------- dictionaries for other languages ----------
export function dictionaryPanel() {
  const box = h('div');
  const book = state.book;
  const lang = String(book?.meta.language || '').split('-')[0];
  const draw = async () => {
    clear(box);
    if (!book || isEnglish(lang)) { box.appendChild(h('p.muted.small', 'English books use the built-in dictionary. For a book in another language, open it and import a Hunspell dictionary here.')); return; }
    const { dictionaryInfo, importDictionary, removeDictionary, applyBookSpelling } = await import('../lang/spell.js');
    const info = await dictionaryInfo(lang);
    add(box,
      h('div.section-title', `Spelling dictionary for ${langInfo(lang).name || lang}`),
      h('p.muted.small', 'Booky doesn’t include dictionaries for Indian languages or Urdu, because the free ones we found are under licences that don’t allow bundling them in Booky. You can import one yourself: a Hunspell dictionary is two files, .aff and .dic (for example from LibreOffice’s dictionaries).'),
      info ? h('p', icon('circle-check', 14), ` ${info.name || 'Imported dictionary'} · about ${info.words.toLocaleString()} words`) : null,
      h('div.row', { style: { gap: '8px' } },
        btn(info ? 'Replace dictionary…' : 'Import dictionary (.aff + .dic)…', { icon: 'upload', onClick: async () => {
          const files = await pickFile('.aff,.dic', { multiple: true });
          const aff = files?.find((f) => /\.aff$/i.test(f.name)), dic = files?.find((f) => /\.dic$/i.test(f.name));
          if (!aff || !dic) { toast('Choose both files: the .aff and the .dic (hold Ctrl or ⌘ to pick two).', 'warn', 5000); return; }
          toast('Loading the dictionary…');
          await importDictionary(lang, await readAsText(aff), await readAsText(dic), dic.name.replace(/\.dic$/i, ''));
          await applyBookSpelling(book);
          toast('Dictionary ready — spelling is now checked as you write', 'success');
          draw();
        } }),
        info ? btn('Remove', { kind: 'ghost', onClick: async () => { await removeDictionary(lang); await applyBookSpelling(book); draw(); } }) : null));
  };
  draw();
  return box;
}
