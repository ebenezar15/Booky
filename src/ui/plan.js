// Plan mode: corkboard, outline, story bible (characters, places…) and goals.
import { h, icon, btn, clear, segmented, iconBtn, field, input, textarea, select, menu, pickFile, compressImage, confirmDialog, toast, add } from './dom.js';
import { state, on, touch, selectElement, setMode } from '../core/store.js';
import { ELEMENT_TYPES, STATUSES, computeNumbers, displayTitle, elementWords, bookWords, uid, fillText, orderedElements } from '../core/model.js';
import { moveElement, addElement } from '../core/actions.js';
import { addToDictionary } from '../lang/spell.js';

const BIBLE_KINDS = [
  { id: 'character', label: 'Character', icon: 'user' },
  { id: 'place', label: 'Place', icon: 'map-pin' },
  { id: 'item', label: 'Object', icon: 'star' },
  { id: 'lore', label: 'Lore / World', icon: 'globe' },
  { id: 'research', label: 'Research', icon: 'lightbulb' },
  { id: 'timeline', label: 'Timeline event', icon: 'calendar' },
];

let lastView = 'cork';

export function renderPlan(host) {
  const book = state.book;
  const wrap = h('section.plan');
  host.appendChild(wrap);
  let view = lastView;
  let showAll = false;
  let bibleFilter = 'all';

  function draw() {
    clear(wrap);
    wrap.appendChild(h('div.plan-head',
      h('h2', { cork: 'Corkboard', outline: 'Outline', bible: 'Story Bible', goals: 'Goals & Progress' }[view]),
      segmented([['cork', 'Corkboard'], ['outline', 'Outline'], ['bible', 'Story Bible'], ['goals', 'Goals']], view, (v) => { view = lastView = v; draw(); }),
      h('span.grow'),
      view === 'cork' || view === 'outline' ? h('label.row.small', h('input', { type: 'checkbox', checked: showAll, on: { change: (e) => { showAll = e.target.checked; draw(); } } }), 'Show front & back matter') : null,
      view === 'cork' || view === 'outline' ? btn('New chapter', { icon: 'plus', kind: 'primary', onClick: () => { addElement('chapter', { section: 'body', select: false }); draw(); } }) : null,
    ));
    if (view === 'cork') drawCork();
    if (view === 'outline') drawOutline();
    if (view === 'bible') drawBible();
    if (view === 'goals') drawGoals();
  }

  const visible = () => orderedElements(book).filter((e) => showAll || e.section === 'body');

  function drawCork() {
    const nums = computeNumbers(book);
    const grid = h('div.cork');
    let dragId = null;
    for (const el of visible()) {
      if (el.type === 'part') {
        grid.appendChild(h('div.cork-part', `${ELEMENT_TYPES.part.label} ${nums[el.id] || ''} — ${fillText(el.title, book)}`));
        continue;
      }
      const status = STATUSES.find((s) => s.id === el.status) || STATUSES[0];
      const title = h('input.cc-title', { value: el.title, placeholder: displayTitle(book, el, nums), on: { input: (e) => { el.title = e.target.value; touch('element-title', el.id); } } });
      const syn = h('textarea', { placeholder: 'Synopsis — what happens here?', on: { input: (e) => { el.synopsis = e.target.value; touch('notes'); } } }, el.synopsis || '');
      const card = h('div.cork-card', {
        draggable: 'true',
        on: {
          dragstart: (e) => { if (/INPUT|TEXTAREA/.test(e.target.tagName)) return; dragId = el.id; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; },
          dragend: () => { card.classList.remove('dragging'); grid.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target')); },
          dragover: (e) => { if (dragId && dragId !== el.id) { e.preventDefault(); card.classList.add('drop-target'); } },
          dragleave: () => card.classList.remove('drop-target'),
          drop: (e) => { e.preventDefault(); if (dragId && dragId !== el.id) { const ids = visible().map((x) => x.id); moveElement(dragId, { targetId: el.id, before: ids.indexOf(dragId) > ids.indexOf(el.id) }); draw(); } },
        },
      },
      h('div.cc-band', { style: { background: status.color } }),
      h('div.cc-head', icon(ELEMENT_TYPES[el.type].icon, 13), h('span.cc-num', el.type === 'chapter' ? (nums[el.id] ? `Chapter ${nums[el.id]}` : 'Chapter') : ELEMENT_TYPES[el.type].label), h('span.grow'),
        el.label ? h('span.kind-tag', el.label) : null,
        iconBtn('pen-line', 'Open in editor', () => { selectElement(el.id); setMode('write'); }, { size: 14 })),
      title, syn,
      h('div.cc-foot',
        h('span', `${elementWords(el).toLocaleString()} words`), h('span.grow'),
        select(STATUSES.map((s) => [s.id, s.label]), el.status, (v) => { el.status = v; touch('elements'); draw(); })));
      grid.appendChild(card);
    }
    wrap.appendChild(grid);
  }

  function drawOutline() {
    const nums = computeNumbers(book);
    const table = h('div.card', { style: { padding: 0, overflow: 'auto' } });
    const rows = visible().map((el) => h('tr',
      h('td.muted', el.type === 'chapter' && nums[el.id] ? nums[el.id] : el.type === 'part' ? `P${nums[el.id] || ''}` : '–'),
      h('td', h('a', { href: '#', on: { click: (e) => { e.preventDefault(); selectElement(el.id); setMode('write'); } } }, fillText(displayTitle(book, el, nums), book))),
      h('td', input(el.label, (v) => { el.label = v; touch('notes'); }, { placeholder: 'POV / label', style: 'height:28px' })),
      h('td', input(el.synopsis, (v) => { el.synopsis = v; touch('notes'); }, { placeholder: 'One-line summary', style: 'height:28px;min-width:260px' })),
      h('td', select(STATUSES.map((s) => [s.id, s.label]), el.status, (v) => { el.status = v; touch('elements'); }, { style: 'height:28px' })),
      h('td', { style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, elementWords(el).toLocaleString()),
      h('td', { style: { textAlign: 'right' } }, el.wordTarget ? `${Math.min(100, Math.round((elementWords(el) / el.wordTarget) * 100))}%` : '–')));
    table.appendChild(h('table.outline', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' } },
      h('thead', h('tr', ['#', 'Title', 'Label', 'Synopsis', 'Status', 'Words', 'Target'].map((t) => h('th', { style: { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.07em' } }, t)))),
      h('tbody', rows)));
    table.querySelectorAll('td').forEach((td) => Object.assign(td.style, { padding: '6px 12px', borderBottom: '1px solid var(--border)' }));
    wrap.appendChild(table);
  }

  function drawBible() {
    const bar = h('div.row', { style: { marginBottom: '14px', flexWrap: 'wrap' } },
      h('div.filter-row', { style: { margin: 0 } },
        h(`button.filter-pill${bibleFilter === 'all' ? '.on' : ''}`, { type: 'button', on: { click: () => { bibleFilter = 'all'; draw(); } } }, 'All', h('span.badge', book.bible.length)),
        BIBLE_KINDS.map((k) => h(`button.filter-pill${bibleFilter === k.id ? '.on' : ''}`, { type: 'button', on: { click: () => { bibleFilter = k.id; draw(); } } }, k.label, h('span.badge', book.bible.filter((b) => b.kind === k.id).length)))),
      h('span.grow'),
      btn('Add', { icon: 'plus', kind: 'primary', onClick: (e) => menu(e.currentTarget, BIBLE_KINDS.map((k) => ({ label: k.label, icon: k.icon, onClick: () => { book.bible.unshift({ id: uid('bi_'), kind: k.id, name: '', role: '', body: '', image: '' }); touch('bible'); draw(); } }))) }),
      btn('Add names to dictionary', { icon: 'spell-check', kind: 'ghost', title: 'Stop character and place names being flagged as misspellings', onClick: () => {
        const names = book.bible.flatMap((b) => (b.name || '').split(/\s+/)).filter((w) => /^\p{L}{2,}$/u.test(w));
        names.forEach((n) => addToDictionary(n));
        toast(`${names.length} name(s) added to your dictionary`, 'success');
      } }));
    wrap.appendChild(bar);
    const items = book.bible.filter((b) => bibleFilter === 'all' || b.kind === bibleFilter);
    if (!items.length) {
      wrap.appendChild(h('div.empty-state', icon('users', 30), h('h3', 'Build your story world'), h('p', 'Keep characters, places, objects, lore and research in one place — handy while you write. These notes are never exported.')));
      return;
    }
    const grid = h('div.bible-grid');
    for (const it of items) {
      const kind = BIBLE_KINDS.find((k) => k.id === it.kind) || BIBLE_KINDS[0];
      const avatar = h('div.bc-avatar', { title: 'Set picture', on: { click: async () => { const f = await pickFile('image/*'); if (f) { it.image = await compressImage(f, 400); touch('bible'); draw(); } } } },
        it.image ? h('img', { src: it.image, alt: '' }) : icon(kind.icon, 22));
      grid.appendChild(h('div.bible-card',
        h('div.bc-head', avatar,
          h('div.grow', h('input.bc-name', { value: it.name, placeholder: `${kind.label} name`, on: { input: (e) => { it.name = e.target.value; touch('bible'); } } }), h('span.kind-tag', kind.label)),
          iconBtn('trash', 'Delete', async () => { if (await confirmDialog('Delete entry?', `Delete “${it.name || kind.label}”?`, { okLabel: 'Delete', danger: true })) { book.bible = book.bible.filter((x) => x !== it); touch('bible'); draw(); } })),
        input(it.role, (v) => { it.role = v; touch('bible'); }, { placeholder: it.kind === 'character' ? 'Role (protagonist, mentor…), age' : it.kind === 'timeline' ? 'When' : 'Tagline' }),
        textarea(it.body, (v) => { it.body = v; touch('bible'); }, { rows: 5, placeholder: it.kind === 'character' ? 'Appearance, personality, goals, secrets, arc…' : 'Details…' })));
    }
    wrap.appendChild(grid);
  }

  function drawGoals() {
    const g = book.goals;
    const total = bookWords(book);
    const pct = g.target ? Math.min(1, total / g.target) : 0;
    const R = 52, C = 2 * Math.PI * R;
    const ring = `<svg class="ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="12"/><circle cx="60" cy="60" r="${R}" fill="none" stroke="url(#gg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" opacity="${pct > 0 ? 1 : 0}" transform="rotate(-90 60 60)"/><defs><linearGradient id="gg"><stop offset="0" stop-color="var(--primary)"/><stop offset="1" stop-color="var(--accent)"/></linearGradient></defs><text x="60" y="66" text-anchor="middle" font-size="22" font-weight="700" fill="var(--text)">${Math.round(pct * 100)}%</text></svg>`;
    // daily words over the last 30 days
    const days = [];
    const hist = g.history;
    const keys = Object.keys(hist).sort();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const prev = keys.filter((k) => k < d).pop();
      const val = hist[d] != null ? hist[d] - (prev ? hist[prev] : hist[d]) : 0;
      days.push({ d, v: Math.max(0, val) });
    }
    const max = Math.max(g.daily || 1, ...days.map((x) => x.v));
    const streak = (() => { let s = 0; for (let i = days.length - 1; i >= 0; i--) { if (days[i].v > 0) s++; else if (i !== days.length - 1) break; } return s; })();
    add(wrap, 
      h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: '18px', alignItems: 'start' } },
        h('div.card', { style: { textAlign: 'center' } },
          h('div', { html: ring }),
          h('h3', { style: { margin: '8px 0 2px' } }, `${total.toLocaleString()} words`),
          h('p.muted', { style: { margin: '0 0 14px' } }, g.target ? `of ${g.target.toLocaleString()} word goal` : 'Set a goal below'),
          h('div.grid-2', { style: { textAlign: 'left' } },
            field('Book goal', input(g.target, (v) => { g.target = +v || 0; touch('goals'); }, { type: 'number', step: 1000 })),
            field('Daily goal', input(g.daily, (v) => { g.daily = +v || 0; touch('goals'); }, { type: 'number', step: 100 }))),
          h('div', { style: { textAlign: 'left' } }, field('Deadline', input(g.deadline, (v) => { g.deadline = v; touch('goals'); }, { type: 'date' })))),
        h('div.card',
          h('div.row', h('b', 'Words per day — last 30 days'), h('span.grow'), h('span.kind-tag', `🔥 ${streak}-day streak`)),
          h('div.goal-chart', days.map((x) => h('div.bar', { style: { height: `${(x.v / max) * 100}%`, opacity: x.v >= (g.daily || Infinity) ? 1 : 0.55 }, 'data-tip': `${x.d}: ${x.v} words` }))),
          h('p.hint', 'Bars at full colour met your daily goal. Progress is recorded automatically as you write.'))),
    );
  }

  draw();
  const offs = [on('elements', () => { if (view !== 'bible' && view !== 'goals') draw(); })];
  return () => offs.forEach((f) => f());
}
