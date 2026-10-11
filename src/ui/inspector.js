// Right-hand inspector: page settings, writing check, notes, snapshots and stats.
import { h, icon, btn, clear, field, input, textarea, select, toggle, segmented, toast, confirmDialog, pickFile, compressImage, iconBtn, timeAgo, add } from './dom.js';
import { state, on, emit, touch, currentElement, sessionWords } from '../core/store.js';
import { ELEMENT_TYPES, STATUSES, SECTIONS, htmlToText, countWords, bookWords, elementWords } from '../core/model.js';
import { takeSnapshot } from '../core/actions.js';
import { getEditor } from './editor-view.js';
import { allIssues } from '../editor/proofing.js';
import { readability, easeLabel, overusedWords } from '../lang/grammar.js';

const TABS = [
  { id: 'page', label: 'Page', icon: 'sliders-horizontal' },
  { id: 'check', label: 'Check', icon: 'spell-check' },
  { id: 'notes', label: 'Notes', icon: 'notebook-pen' },
  { id: 'history', label: 'History', icon: 'clock-arrow-left' },
  { id: 'stats', label: 'Stats', icon: 'chart-column' },
];

let lastTab = 'page';

export function renderInspector(host) {
  const pane = h('aside.inspector', { 'aria-label': 'Inspector' });
  const tabsEl = h('div.insp-tabs', { role: 'tablist' });
  const body = h('div.insp-body');
  add(pane, tabsEl, body);
  host.appendChild(pane);
  let tab = lastTab;
  let filter = 'all';

  const drawTabs = () => {
    clear(tabsEl);
    const ed = getEditor();
    const n = ed ? allIssues(ed.state).length : 0;
    TABS.forEach((t) => tabsEl.appendChild(h(`button.insp-tab${t.id === tab ? '.on' : ''}`, { type: 'button', role: 'tab', title: t.label, on: { click: () => { tab = lastTab = t.id; draw(); } } },
      icon(t.icon, 15), h('span.insp-label', t.label), t.id === 'check' && n ? h('span.badge', n) : null)));
  };

  function draw() {
    drawTabs();
    clear(body);
    const el = currentElement();
    if (tab === 'page') drawPage(el);
    if (tab === 'check') drawCheck(el);
    if (tab === 'notes') drawNotes(el);
    if (tab === 'history') drawHistory(el);
    if (tab === 'stats') drawStats(el);
  }

  function drawPage(el) {
    if (!el) { body.appendChild(h('p.muted', 'Select a page.')); return; }
    const def = ELEMENT_TYPES[el.type];
    const st = (k) => (v) => { el[k] = v; touch('elements'); };
    add(body, 
      h('div.section-title', icon(def.icon, 14), def.label),
      field('Status', select(STATUSES.map((s) => [s.id, s.label]), el.status, st('status'))),
      h('div.grid-2',
        field('Section', select(SECTIONS.map((s) => [s.id, s.label]), el.section, st('section'))),
        field('Page type', select(Object.entries(ELEMENT_TYPES).map(([id, d]) => [id, d.label]), el.type, (v) => { el.type = v; el.numbered = !!ELEMENT_TYPES[v].numbered; touch('elements'); emit('replace-content'); draw(); }))),
      h('div.col', { style: { gap: '10px', margin: '4px 0 14px' } },
        toggle(el.include.print, (v) => { el.include.print = v; touch('elements'); }, 'Include in print edition'),
        toggle(el.include.ebook, (v) => { el.include.ebook = v; touch('elements'); }, 'Include in ebook edition'),
        el.type === 'chapter' ? toggle(el.numbered, st('numbered'), 'Numbered chapter') : null,
        def.heading ? toggle(el.showTitle !== false, st('showTitle'), 'Show heading on the page') : null,
      ),
      h('div.section-title', 'Print layout'),
      field('Starts on', select([['default', 'Book default'], ['right', 'Right-hand page (recto)'], ['left', 'Left-hand page (verso)'], ['page', 'Next page'], ['continue', 'Continue on same page']], el.startOn || 'default', st('startOn'))),
      field('Vertical position', segmented([['default', 'Top'], ['third', 'Upper third'], ['center', 'Centre'], ['bottom', 'Bottom']], el.align || 'default', st('align')), 'Great for title, dedication and epigraph pages.'),
      def.heading ? h('div',
        h('div.section-title', 'Heading image'),
        el.headingImage
          ? h('div.row', h('img', { src: el.headingImage, style: { maxWidth: '120px', maxHeight: '70px', borderRadius: '6px', border: '1px solid var(--border)' } }), btn('Remove', { cls: 'btn-sm', kind: 'ghost', onClick: () => { el.headingImage = ''; touch('elements'); draw(); } }))
          : btn('Add image above heading', { icon: 'image-plus', cls: 'btn-sm', onClick: async () => { const f = await pickFile('image/*'); if (f) { el.headingImage = await compressImage(f, 1200); touch('elements'); draw(); } } }),
        h('p.hint', 'Shown above this heading. Set one for all chapters in Format → Chapter headings.')) : null,
      h('div.section-title', 'Goal'),
      field('Word target for this page', input(el.wordTarget || '', (v) => { el.wordTarget = +v || 0; touch('elements'); }, { type: 'number', min: 0, step: 100, placeholder: 'e.g. 3000' })),
    );
  }

  function drawCheck(el) {
    const ed = getEditor();
    if (!ed || !el) { body.appendChild(h('p.muted', 'Open a chapter to check it.')); return; }
    const issues = allIssues(ed.state);
    const counts = { spelling: 0, grammar: 0, style: 0, clarity: 0 };
    issues.forEach((i) => counts[i.kind]++);
    const text = ed.getText({ blockSeparator: '\n' });
    const r = readability(text);
    const pill = (id, label, colorVar) => h(`button.filter-pill${filter === id ? '.on' : ''}`, { type: 'button', on: { click: () => { filter = id; draw(); } } },
      colorVar ? h('i', { style: { background: `var(${colorVar})` } }) : null, label, h('span.badge', id === 'all' ? issues.length : counts[id]));
    add(body, 
      h('div.stat-grid', { style: { marginBottom: '14px' } },
        h('div.stat', h('b', r.ease), h('span', `Readability · ${easeLabel(r.ease)}`)),
        h('div.stat', h('b', r.grade), h('span', 'Reading grade level')),
        h('div.stat', h('b', r.avgSentence), h('span', 'Avg. words / sentence')),
        h('div.stat', h('b', issues.length), h('span', 'Suggestions'))),
      h('div.filter-row', pill('all', 'All'), pill('spelling', 'Spelling', '--spell'), pill('grammar', 'Grammar', '--grammar'), pill('style', 'Style', '--style'), pill('clarity', 'Clarity', '--clarity')),
    );
    const list = h('div.issue-list');
    const shown = issues.filter((i) => filter === 'all' || i.kind === filter).slice(0, 200);
    if (!shown.length) list.appendChild(h('div.empty-state', { style: { padding: '24px' } }, icon('circle-check', 26), h('p', issues.length ? 'Nothing in this category.' : 'No issues found. Lovely writing!')));
    for (const i of shown) {
      const ctxText = ed.state.doc.textBetween(Math.max(0, i.from - 30), Math.min(ed.state.doc.content.size, i.to + 30), ' ');
      const target = ed.state.doc.textBetween(i.from, i.to, ' ');
      const k = ctxText.indexOf(target);
      const card = h(`div.issue-card.${i.kind}`, {
        on: { click: () => {
          ed.chain().focus().setTextSelection({ from: i.from, to: i.to }).run();
          ed.view.domAtPos(i.from)?.node?.parentElement?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        } },
      },
      h('div.ic-title', h('span', i.title || 'Spelling'), i.replacements?.length ? h('span.muted.small', `→ ${i.replacements[0] || 'remove'}`) : null),
      h('div.ic-text', k >= 0 ? [ctxText.slice(0, k), h('mark', target), ctxText.slice(k + target.length)] : target),
      h('div.muted.small', i.message));
      if (i.replacements?.length) {
        card.appendChild(h('div.chips', { style: { marginTop: '6px' } }, i.replacements.slice(0, 3).map((rep) => h(`button.chip${rep === '' ? '.strike' : ''}`, { type: 'button', on: { click: (e) => { e.stopPropagation(); ed.chain().focus().insertContentAt({ from: i.from, to: i.to }, rep).run(); } } }, rep === '' ? target : rep))));
      }
      list.appendChild(card);
    }
    body.appendChild(list);
    const over = overusedWords(text, 12);
    if (over.length) {
      add(body, h('div.section-title', { style: { marginTop: '20px' } }, 'Most used words'),
        h('div.chips', over.map(([w, c]) => h('span.chip', { title: 'Occurrences in this chapter' }, `${w} · ${c}`))));
    }
    add(body, h('p.hint', { style: { marginTop: '16px' } }, 'All checks run on your device. Click an underlined word in the text for suggestions, or right-click for synonyms and rephrasing.'));
  }

  function drawNotes(el) {
    if (!el) return;
    add(body, 
      field('Synopsis (shown on the Plan corkboard)', textarea(el.synopsis, (v) => { el.synopsis = v; touch('notes'); }, { rows: 4, placeholder: 'What happens in this chapter?' })),
      field('Notes & research', textarea(el.notes, (v) => { el.notes = v; touch('notes'); }, { rows: 12, placeholder: 'Ideas, reminders, research, things to fix…' }), 'Notes are private — never printed or exported.'),
      field('Label / POV', input(el.label, (v) => { el.label = v; touch('notes'); }, { placeholder: 'e.g. POV: Mara' })),
    );
  }

  function drawHistory(el) {
    if (!el) return;
    add(body, 
      h('p.muted.small', 'Snapshots save a copy of this page so you can experiment freely and roll back anytime.'),
      btn('Take snapshot now', { icon: 'camera', kind: 'primary', cls: 'btn-block', onClick: () => { takeSnapshot(el); toast('Snapshot saved', 'success'); draw(); } }),
      h('div', { style: { height: '14px' } }),
    );
    if (!el.snapshots?.length) body.appendChild(h('p.muted', 'No snapshots yet.'));
    (el.snapshots || []).forEach((s) => {
      const words = countWords(htmlToText(s.content));
      body.appendChild(h('div.snap-item',
        icon('clock', 15),
        h('div', h('b', s.name), h('small', `${timeAgo(s.date)} · ${words.toLocaleString()} words`)),
        iconBtn('rotate-ccw', 'Restore this version', async () => {
          if (!(await confirmDialog('Restore snapshot?', 'The current text will be replaced. A snapshot of the current version is taken first, so you can undo this.', { okLabel: 'Restore' }))) return;
          takeSnapshot(el, 'Before restore');
          el.content = s.content;
          touch('content', el.id);
          emit('replace-content');
          draw();
          toast('Snapshot restored', 'success');
        }),
        iconBtn('trash', 'Delete snapshot', () => { el.snapshots = el.snapshots.filter((x) => x.id !== s.id); touch('snapshots'); draw(); })));
    });
  }

  function drawStats(el) {
    const book = state.book;
    const total = bookWords(book);
    const chWords = el ? elementWords(el) : 0;
    const chapters = book.elements.filter((e) => e.type === 'chapter');
    const avg = chapters.length ? Math.round(chapters.reduce((s, e) => s + elementWords(e), 0) / chapters.length) : 0;
    const g = book.goals;
    const today = new Date().toISOString().slice(0, 10);
    const days = Object.keys(g.history).sort();
    const prevDay = days.filter((d) => d < today).pop();
    const todayWords = total - (prevDay ? g.history[prevDay] : (g.history[days[0]] ?? total));
    let deadlineInfo = '';
    if (g.deadline && g.target) {
      const left = Math.ceil((new Date(g.deadline) - new Date()) / 86400000);
      const need = Math.max(0, g.target - total);
      deadlineInfo = left > 0 ? `${Math.ceil(need / left).toLocaleString()} words/day needed for ${left} days` : 'Deadline reached';
    }
    add(body, 
      h('div.stat-grid',
        h('div.stat', h('b', total.toLocaleString()), h('span', 'Words in book')),
        h('div.stat', h('b', chWords.toLocaleString()), h('span', 'Words in this page')),
        h('div.stat', h('b', `+${Math.max(0, sessionWords()).toLocaleString()}`), h('span', 'This session')),
        h('div.stat', h('b', Math.max(0, todayWords).toLocaleString()), h('span', 'Today')),
        h('div.stat', h('b', chapters.length), h('span', 'Chapters')),
        h('div.stat', h('b', avg.toLocaleString()), h('span', 'Avg. chapter length'))),
      h('div.section-title', { style: { marginTop: '20px' } }, 'Goals'),
      h('div.grid-2',
        field('Book word goal', input(g.target, (v) => { g.target = +v || 0; touch('goals'); }, { type: 'number', step: 1000 })),
        field('Daily goal', input(g.daily, (v) => { g.daily = +v || 0; touch('goals'); }, { type: 'number', step: 100 }))),
      field('Deadline', input(g.deadline, (v) => { g.deadline = v; touch('goals'); draw(); }, { type: 'date' })),
      deadlineInfo ? h('p.hint', deadlineInfo) : null,
      h('div.section-title', { style: { marginTop: '20px' } }, 'Writing sprint'),
      sprintWidget(),
    );
  }

  draw();
  let t;
  const offs = [
    on('select', draw),
    on('elements', () => { if (tab === 'page') draw(); }),
    on('proof', () => { clearTimeout(t); t = setTimeout(() => { if (tab === 'check') draw(); else drawTabs(); }, 300); }),
    on('snapshots', () => { if (tab === 'history') draw(); }),
    on('show-tab', (id) => { tab = lastTab = id; draw(); }),
  ];
  return () => offs.forEach((f) => f());
}

// Pomodoro-style sprint timer that counts words written.
let sprint = null;
function sprintWidget() {
  const time = h('div.time', '15:00');
  const info = h('div.muted.small', 'Write without stopping. Booky counts your words.');
  const startBtn = btn('Start 15-minute sprint', { icon: 'play', kind: 'primary', cls: 'btn-block' });
  const tick = () => {
    if (!sprint) return;
    const left = Math.max(0, sprint.end - Date.now());
    time.textContent = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
    const written = bookWords(state.book) - sprint.startWords;
    info.textContent = `${Math.max(0, written)} words so far`;
    if (left <= 0) {
      toast(`Sprint finished — ${Math.max(0, written)} words!`, 'success', 5000);
      clearInterval(sprint.timer);
      sprint = null;
      startBtn.querySelector('span').textContent = 'Start 15-minute sprint';
    }
  };
  startBtn.addEventListener('click', () => {
    if (sprint) { clearInterval(sprint.timer); sprint = null; time.textContent = '15:00'; startBtn.querySelector('span').textContent = 'Start 15-minute sprint'; return; }
    sprint = { end: Date.now() + 15 * 60000, startWords: bookWords(state.book) };
    sprint.timer = setInterval(tick, 1000);
    startBtn.querySelector('span').textContent = 'Stop sprint';
    tick();
  });
  if (sprint) { startBtn.querySelector('span').textContent = 'Stop sprint'; clearInterval(sprint.timer); sprint.timer = setInterval(tick, 1000); tick(); }
  return h('div.card.sprint', time, info, h('div', { style: { height: '10px' } }), startBtn);
}
