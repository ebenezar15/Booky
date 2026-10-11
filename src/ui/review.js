// Review mode: whole-book proofreading, readability, repetition and originality checks.
import { h, icon, btn, clear, add, segmented, toast, modal, field, input, textarea, iconBtn, pickFile, confirmDialog, toggle } from './dom.js';
import { state, setMode, selectElement, emit, touch, setApp } from '../core/store.js';
import { includedElements } from '../render/book.js';
import { htmlToText, fillPlaceholders, displayTitle, uid, normalizeBook } from '../core/model.js';
import { checkText } from '../lang/grammar.js';
import { findMisspelled, WORD_RE, shouldSkip, suggest } from '../lang/spell.js';
import { similarSentences, repeatedPhrases, sentenceOpeners, echoes, textMetrics, readabilityAdvice, originalityCheck, FAMOUS_PASSAGES } from '../lang/analysis.js';
import { findMatches } from '../editor/find.js';
import { db } from '../core/db.js';
import { readManuscript } from '../import/importer.js';

let lastTab = 'proof';
const tick = () => new Promise((r) => setTimeout(r, 0));

// Boilerplate pages (copyright, title…) are spell-checked but excluded from style and readability analysis.
const BOILERPLATE = new Set(['copyright', 'title', 'half-title', 'series-title', 'also-by', 'colophon', 'toc', 'index', 'bibliography', 'blank', 'frontispiece']);

export function bookUnits(book, { prose = false } = {}) {
  return includedElements(book, 'print').concat(includedElements(book, 'ebook'))
    .filter((e, i, a) => a.indexOf(e) === i && e.type !== 'toc' && (!prose || !BOILERPLATE.has(e.type)))
    .map((e) => ({ id: e.id, type: e.type, title: displayTitle(book, e), text: htmlToText(fillPlaceholders(e.content, book)).replace(/\{\{\w+\}\}/g, '') }))
    .filter((u) => u.text.trim());
}

// Open a chapter in the editor and select the given text.
export function jumpTo(id, text) {
  selectElement(id);
  setMode('write');
  setTimeout(() => emit('editor-command', (ed) => {
    const needle = (text || '').trim().slice(0, 80);
    if (!needle) return;
    const m = findMatches(ed.state.doc, needle, { caseSensitive: false });
    if (!m[0]) return;
    ed.chain().focus().setTextSelection(m[0]).run();
    ed.view.domAtPos(m[0].from)?.node?.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }), 450);
}

const ring = (value, label, color = 'var(--primary)') => {
  const R = 46, C = 2 * Math.PI * R, pct = Math.max(0, Math.min(100, value)) / 100;
  return h('div.score-ring', { html: `<svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="10"/><circle cx="55" cy="55" r="${R}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 55 55)" opacity="${pct > 0 ? 1 : 0}"/><text x="55" y="61" text-anchor="middle" font-size="24" font-weight="700" fill="var(--text)">${Math.round(value)}</text></svg><div class="score-label">${label}</div>` });
};
const scoreColor = (s) => (s >= 75 ? 'var(--success)' : s >= 55 ? 'var(--warning)' : 'var(--danger)');
const mark = (text, needle) => {
  const i = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  return i < 0 ? text : [text.slice(0, i), h('mark', text.slice(i, i + needle.length)), text.slice(i + needle.length)];
};

export function renderReview(host) {
  const book = state.book;
  const wrap = h('section.plan.review');
  host.appendChild(wrap);
  const body = h('div');
  let tab = lastTab;
  let alive = true;

  const head = h('div.plan-head',
    h('h2', 'Review'),
    segmented([['proof', 'Proofread'], ['read', 'Readability'], ['repeat', 'Repetition'], ['orig', 'Originality']], tab, (v) => { tab = lastTab = v; run(); }),
    h('span.grow'),
    btn('Re-run', { icon: 'refresh-cw', kind: 'ghost', onClick: () => run() }));
  add(wrap, head, body);

  const loading = (msg) => { clear(body); add(body, h('div.empty-state', h('div.spinner-lg'), h('p', msg))); };

  async function run() {
    if (tab === 'proof') await proofread();
    if (tab === 'read') await readabilityTab();
    if (tab === 'repeat') await repetitionTab();
    if (tab === 'orig') await originalityTab();
  }

  // ---------------- Proofread ----------------
  let filter = 'all';
  async function proofread() {
    loading('Proofreading every chapter…');
    const units = bookUnits(book);
    const all = [];
    for (const u of units) {
      const tokens = (u.text.match(WORD_RE) || []).map((w) => w.replace(/['’]+$/, '')).filter((w) => !shouldSkip(w));
      const bad = await findMisspelled(tokens);
      const seen = new Set();
      for (const para of u.text.split(/\n+/)) {
        for (const m of para.matchAll(WORD_RE)) {
          const w = m[0].replace(/['’]+$/, '');
          if (bad.has(w) && !seen.has(w)) { seen.add(w); all.push({ unit: u, kind: 'spelling', title: 'Spelling', message: `“${w}” is not in the dictionary.`, word: w, context: para.slice(Math.max(0, m.index - 40), m.index + w.length + 40), needle: w }); }
        }
        if (BOILERPLATE.has(u.type)) continue; // spelling only on boilerplate pages
        for (const is of checkText(para, { grammar: true, style: true, fiction: state.app.fictionHints !== false })) {
          all.push({ unit: u, ...is, needle: para.slice(is.start, is.end), context: para.slice(Math.max(0, is.start - 40), is.end + 40) });
        }
      }
      await tick();
      if (!alive) return;
    }
    const counts = { spelling: 0, grammar: 0, style: 0, clarity: 0 };
    all.forEach((i) => counts[i.kind]++);
    const words = units.reduce((n, u) => n + (u.text.match(/\S+/g) || []).length, 0);
    const per1000 = words ? ((counts.spelling + counts.grammar) / words) * 1000 : 0;
    const style1000 = words ? ((counts.style + counts.clarity) / words) * 1000 : 0;
    const quality = Math.max(0, Math.round(100 - per1000 * 2.5 - style1000 * 0.8));
    clear(body);
    const list = h('div.review-list');
    const drawList = () => {
      clear(list);
      const shown = all.filter((i) => filter === 'all' || i.kind === filter);
      if (!shown.length) { add(list, h('div.empty-state', icon('circle-check', 28), h('p', 'Nothing to fix here.'))); return; }
      let lastUnit = null;
      for (const i of shown.slice(0, 500)) {
        if (i.unit !== lastUnit) { lastUnit = i.unit; add(list, h('div.review-group', i.unit.title, h('span.badge', shown.filter((x) => x.unit === i.unit).length))); }
        const chips = h('div.chips');
        const card = h(`div.issue-card.${i.kind}`, { on: { click: () => jumpTo(i.unit.id, i.needle.length >= 4 ? i.needle : i.context.trim().slice(0, 60)) } },
          h('div.ic-title', h('span', i.title || 'Spelling'), h('span.muted.small', 'Open ›')),
          h('div.ic-text', mark(i.context, i.needle)),
          h('div.muted.small', i.message), chips);
        if (i.kind === 'spelling') suggest(i.word).then((s) => s.slice(0, 4).forEach((x) => chips.appendChild(h('span.chip', x))));
        else (i.replacements || []).slice(0, 3).forEach((r) => chips.appendChild(h('span.chip', r || '(remove)')));
        list.appendChild(card);
      }
    };
    const pill = (id, label, cssVar) => h(`button.filter-pill${filter === id ? '.on' : ''}`, { type: 'button', on: { click: () => { filter = id; proofreadRedraw(); } } }, cssVar ? h('i', { style: { background: `var(${cssVar})` } }) : null, label, h('span.badge', id === 'all' ? all.length : counts[id]));
    const filters = h('div.filter-row');
    const proofreadRedraw = () => { clear(filters); add(filters, pill('all', 'All'), pill('spelling', 'Spelling', '--spell'), pill('grammar', 'Grammar', '--grammar'), pill('style', 'Style', '--style'), pill('clarity', 'Clarity', '--clarity')); drawList(); };
    add(body,
      h('div.review-top',
        ring(quality, 'Proofreading score', scoreColor(quality)),
        h('div.stat-grid.four',
          h('div.stat', h('b', counts.spelling), h('span', 'Spelling')),
          h('div.stat', h('b', counts.grammar), h('span', 'Grammar & punctuation')),
          h('div.stat', h('b', counts.style), h('span', 'Style suggestions')),
          h('div.stat', h('b', counts.clarity), h('span', 'Long sentences'))),
        h('div.col',
          btn('Auto-fix safe issues', { icon: 'wand-sparkles', kind: 'primary', title: 'Fixes double spaces, repeated words, a/an, spacing around punctuation and common slips like “could of”', onClick: () => autoFix() }),
          h('small.hint', 'Fixes only unambiguous mistakes. Everything else: click a card to open it in the editor.'))),
      filters, list);
    proofreadRedraw();
  }

  async function autoFix() {
    const SAFE = new Set(['double-space', 'space-before-punct', 'repeated-word', 'article', 'pronoun-i']);
    const SAFE_CONFUSED = /could of|would of|should of|must of|might of|alot|irregardless|between you and I|then$/i;
    if (!(await confirmDialog('Auto-fix safe issues?', 'Booky will correct unambiguous mistakes across the whole book. A snapshot of each changed chapter is saved first, so you can undo from History.', { okLabel: 'Fix' }))) return;
    let fixes = 0;
    const { takeSnapshot } = await import('../core/actions.js');
    for (const el of book.elements) {
      if (el.type === 'toc' || !el.content) continue;
      const tpl = document.createElement('template');
      tpl.innerHTML = el.content;
      const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
      let changed = 0;
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const t of nodes) {
        if (/\{\{/.test(t.data)) continue;
        const issues = checkText(t.data, { grammar: true, style: false })
          .filter((i) => i.replacements?.length && (SAFE.has(i.rule) || (i.rule === 'confused' && SAFE_CONFUSED.test(t.data.slice(i.start, i.end)))))
          .sort((a, b) => b.start - a.start);
        let text = t.data, lastStart = Infinity;
        for (const i of issues) {
          if (i.end > lastStart) continue;
          text = text.slice(0, i.start) + i.replacements[0] + text.slice(i.end);
          lastStart = i.start;
          changed++;
        }
        if (text !== t.data) t.data = text;
      }
      if (changed) {
        takeSnapshot(el, 'Before auto-fix');
        const d = document.createElement('div');
        d.appendChild(tpl.content);
        el.content = d.innerHTML;
        fixes += changed;
      }
    }
    touch('content');
    toast(fixes ? `Fixed ${fixes} issue${fixes === 1 ? '' : 's'}` : 'No safe fixes needed', 'success');
    proofread();
  }

  // ---------------- Readability ----------------
  async function readabilityTab() {
    loading('Measuring readability…');
    await tick();
    const units = bookUnits(book, { prose: true });
    const all = textMetrics(units.map((u) => u.text).join('\n'));
    const adv = readabilityAdvice(all, { fiction: !/non-?fiction|academic/.test(book.template || '') });
    const rows = units.map((u) => { const m = textMetrics(u.text); return { u, m, a: readabilityAdvice(m) }; }).filter((r) => r.m.words >= 30);
    clear(body);
    const metric = (v, label) => h('div.stat', h('b', v), h('span', label));
    add(body,
      h('div.review-top',
        ring(adv.score, 'Readability score', scoreColor(adv.score)),
        h('div.stat-grid.four',
          metric(all.ease, `Flesch ease · ${all.ease >= 60 ? 'easy' : all.ease >= 50 ? 'fairly hard' : 'hard'}`),
          metric(all.grade, 'Grade level'),
          metric(all.avgSentence, 'Words / sentence'),
          metric(`${all.passivePct}%`, 'Passive sentences'),
          metric(`${all.adverbPct}%`, 'Adverbs'),
          metric(`${all.longPct}%`, 'Sentences > 30 words'),
          metric(`${all.dialoguePct}%`, 'Dialogue'),
          metric(Math.round(all.words / 238), 'Minutes to read'))),
      h('div.section-title', 'Suggestions'),
      h('div.tips', adv.tips.map((t) => h(`div.tip.${t.level}`, icon(t.level === 'ok' ? 'circle-check' : t.level === 'warn' ? 'triangle-alert' : 'lightbulb', 16), h('span', t.text)))),
      h('div.section-title', 'By chapter'),
      h('div.card', { style: { padding: 0, overflow: 'auto' } },
        h('table.review-table',
          h('thead', h('tr', ['Chapter', 'Score', 'Grade', 'Words/sentence', 'Passive', 'Adverbs', 'Long', 'Top suggestion'].map((x) => h('th', x)))),
          h('tbody', rows.map(({ u, m, a }) => h('tr', { on: { click: () => jumpTo(u.id, '') } },
            h('td', h('b', u.title), h('div.muted.small', `${m.words.toLocaleString()} words`)),
            h('td', h('span.score-pill', { style: { background: scoreColor(a.score) } }, a.score)),
            h('td', m.grade), h('td', m.avgSentence), h('td', `${m.passivePct}%`), h('td', `${m.adverbPct}%`), h('td', `${m.longPct}%`),
            h('td.small', a.tips[0]?.text || '')))))),
    );
  }

  // ---------------- Repetition ----------------
  async function repetitionTab() {
    loading('Looking for repeated sentences and phrases…');
    await tick();
    const units = bookUnits(book, { prose: true });
    const sim = similarSentences(units);
    await tick();
    const phrases = repeatedPhrases(units);
    const open = sentenceOpeners(units);
    const echo = echoes(units);
    clear(body);
    const section = (title, n, hint, content) => h('div.rep-section', h('div.section-title', title, h('span.badge', n)), hint ? h('p.hint', hint) : null, content);
    add(body,
      section('Similar or duplicate sentences', sim.length, 'Sentences that say nearly the same thing in different places — often a sign of copy-paste or an idea repeated by accident.',
        sim.length ? h('div.review-list', sim.map((p) => h('div.issue-card.style',
          h('div.ic-title', h('span', p.exact ? 'Identical sentences' : `${p.score}% similar`), h('span.muted.small', p.a.title === p.b.title ? p.a.title : `${p.a.title} · ${p.b.title}`)),
          h('div.sim-pair',
            h('button.sim-side', { type: 'button', on: { click: () => jumpTo(p.a.id, p.a.text) } }, h('small', p.a.title), p.a.text),
            h('button.sim-side', { type: 'button', on: { click: () => jumpTo(p.b.id, p.b.text) } }, h('small', p.b.title), p.b.text))))) : h('p.muted', 'No similar sentences found.')),
      section('Repeated phrases', phrases.length, 'Word sequences used again and again. Some repetition is deliberate — check the rest.',
        phrases.length ? h('div.phrase-grid', phrases.map((p) => h('button.phrase', { type: 'button', title: p.where.join(', '), on: { click: () => openFind(p.phrase) } }, h('b', `“${p.phrase}”`), h('span', `${p.count}×`)))) : h('p.muted', 'No repeated phrases.')),
      section('How sentences begin', open.runs.length, `${open.total.toLocaleString()} sentences analysed. Several sentences in a row starting with the same word can feel monotonous.`,
        h('div',
          h('div.chips', { style: { marginBottom: '10px' } }, open.top.map((t) => h('span.chip', { style: t.pct >= 12 ? { borderColor: 'var(--warning)' } : {} }, `${t.word} · ${t.pct}%`))),
          h('div.review-list', open.runs.map((r) => h('div.issue-card.clarity', { on: { click: () => jumpTo(r.id, r.text.split(/(?<=[.!?])\s/)[0]) } },
            h('div.ic-title', h('span', `${r.count} sentences in a row start with “${r.word}”`), h('span.muted.small', r.title)),
            h('div.ic-text', r.text.length > 260 ? r.text.slice(0, 260) + '…' : r.text)))))),
      section('Echoes', echo.length, 'The same distinctive word used twice within a few lines.',
        echo.length ? h('div.review-list', echo.slice(0, 40).map((e) => h('div.issue-card.grammar', { on: { click: () => jumpTo(e.id, e.word) } },
          h('div.ic-title', h('span', `“${e.word}” repeated ${e.gap} words apart`), h('span.muted.small', e.title)),
          h('div.ic-text', mark(e.context, e.word))))) : h('p.muted', 'No close echoes found.')),
    );
  }

  function openFind(text) {
    setMode('write');
    setTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }));
      setTimeout(() => {
        const q = document.querySelector('.findbar input');
        if (q) { q.value = text; q.dispatchEvent(new Event('input')); const s = document.querySelector('.findbar select'); if (s) { s.value = 'book'; s.dispatchEvent(new Event('change')); } }
      }, 150);
    }, 350);
  }

  // ---------------- Originality ----------------
  const srcOpts = { famous: true, projects: true, refs: true };
  async function originalityTab() {
    loading('Comparing your manuscript with reference texts…');
    const units = bookUnits(book);
    const sources = [];
    if (srcOpts.famous) sources.push(...FAMOUS_PASSAGES);
    if (srcOpts.projects) {
      for (const raw of await db.allBooks()) {
        if (raw.id === book.id) continue;
        const other = normalizeBook(raw);
        sources.push({ id: other.id, title: `Your project: ${other.meta.title}`, kind: 'project', text: other.elements.map((e) => htmlToText(e.content)).join('\n') });
      }
    }
    if (srcOpts.refs) sources.push(...(state.app.references || []).map((r) => ({ ...r, kind: 'reference' })));
    await tick();
    const res = originalityCheck(units, sources);
    // Passages repeated inside this book are reported under Repetition; here we also flag self-duplication of long passages.
    clear(body);
    const refs = state.app.references || [];
    add(body,
      h('div.review-top',
        ring(res.originality, 'Originality', scoreColor(res.originality)),
        h('div',
          h('p', { style: { margin: '0 0 8px' } }, h('b', `${res.matchedWords.toLocaleString()} of ${res.totalWords.toLocaleString()} words`), ' match a reference text.'),
          h('div.col', { style: { gap: '8px' } },
            toggle(srcOpts.famous, (v) => { srcOpts.famous = v; originalityTab(); }, `Famous passages & quotations (${FAMOUS_PASSAGES.length})`),
            toggle(srcOpts.projects, (v) => { srcOpts.projects = v; originalityTab(); }, 'My other Booky projects'),
            toggle(srcOpts.refs, (v) => { srcOpts.refs = v; originalityTab(); }, `Reference documents I added (${refs.length})`))),
        h('div.col',
          btn('Add reference text…', { icon: 'plus', kind: 'primary', onClick: () => addReference() }),
          h('small.hint', 'Add sources you used — articles, research, earlier drafts, other authors’ texts — to check for copied passages.'))),
      h('div.notice', icon('info', 16), h('span', 'This check runs on your computer and compares your book with the sources listed above (7+ identical words in a row). It cannot search the internet; for a passage you are unsure about, use “Search online” (needs a connection).')),
      refs.length ? h('div', h('div.section-title', 'Reference documents'), h('div.ref-list', refs.map((r) => h('div.layer-row', icon('file-text', 15), h('span', `${r.title} · ${(r.text.match(/\S+/g) || []).length.toLocaleString()} words`),
        iconBtn('trash', 'Remove', async () => { if (await confirmDialog('Remove reference?', `“${r.title}” will no longer be used for originality checks.`, { okLabel: 'Remove', danger: true })) { setApp({ references: refs.filter((x) => x.id !== r.id) }); originalityTab(); } }, { size: 15 }))))) : null,
      h('div.section-title', 'Matching passages', h('span.badge', res.matches.length)),
      res.matches.length ? h('div.review-list', res.matches.slice(0, 100).map((m) => h('div.issue-card.spelling',
        h('div.ic-title', h('span', `${m.words} words match ${m.source}`), h('span.muted.small', m.title)),
        h('div.ic-text', '“', m.text, '”'),
        h('div.muted.small', 'Source: …', m.sourceText, '…'),
        h('div.row', { style: { marginTop: '8px' } },
          btn('Open in editor', { cls: 'btn-sm', onClick: () => jumpTo(m.id, m.text.split(' ').slice(0, 6).join(' ')) }),
          h('a.btn.btn-sm.btn-ghost', { href: `https://www.google.com/search?q=${encodeURIComponent(`"${m.text.split(' ').slice(0, 14).join(' ')}"`)}`, target: '_blank', rel: 'noopener' }, icon('globe', 14), 'Search online'))))) : h('div.empty-state', icon('circle-check', 28), h('p', 'No matching passages found — your text appears original against these sources.')),
    );
  }

  function addReference() {
    let title = '', text = '';
    const ta = textarea('', (v) => { text = v; }, { rows: 10, placeholder: 'Paste the source text here…' });
    const ti = input('', (v) => { title = v; }, { placeholder: 'e.g. Article on lighthouse history' });
    const m = modal({
      title: 'Add a reference text', width: 620,
      body: [
        field('Title', ti),
        field('Text', ta),
        btn('Or import a file (.docx, .txt, .md, .html)', { icon: 'file-up', kind: 'ghost', onClick: async () => {
          const f = await pickFile('.docx,.txt,.md,.markdown,.html,.htm,.rtf');
          if (!f) return;
          const r = await readManuscript(f);
          const t = htmlToText(r.html || '');
          ta.value = text = t;
          if (!ti.value) ti.value = title = r.title;
        } }),
      ],
      footer: [btn('Cancel', { onClick: () => m.close() }), btn('Add reference', { kind: 'primary', onClick: () => {
        if (!text.trim()) { toast('Paste or import some text first', 'warn'); return; }
        setApp({ references: [...(state.app.references || []), { id: uid('ref_'), title: title.trim() || 'Untitled reference', text, addedAt: Date.now() }] });
        m.close();
        originalityTab();
      } })],
    });
  }

  run();
  return () => { alive = false; };
}
