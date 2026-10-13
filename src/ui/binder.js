// Binder: the book's structure (front matter, body, back matter) with drag-and-drop.
import { h, icon, iconBtn, menu, clear, promptDialog, confirmDialog } from './dom.js';
import { state, on, selectElement, setMode, touch } from '../core/store.js';
import { SECTIONS, ELEMENT_TYPES, STATUSES, computeNumbers, displayTitle, elementWords, bookWords, fillText } from '../core/model.js';
import { addElement, deleteElement, duplicateElement, moveElement, updateElement } from '../core/actions.js';
import { importFlow } from './library.js';
import { mergeWithNext, nextInSection } from './writing-tools.js';
import { getEditor } from './editor-view.js';

export function addMenuItems(section, afterId) {
  const groups = { front: 'Front matter', body: 'Body', back: 'Back matter' };
  const byGroup = (g) => Object.entries(ELEMENT_TYPES).filter(([, d]) => d.section === g).map(([id, d]) => ({
    label: d.label, icon: d.icon, onClick: () => addElement(id, { section: section || d.section, afterId }),
  }));
  const primary = section === 'body' || !section
    ? [{ label: 'Chapter', icon: 'file-pen', onClick: () => addElement('chapter', { section: 'body', afterId }) }, { label: 'Part divider', icon: 'layers', onClick: () => addElement('part', { section: 'body', afterId }) }, { divider: true }]
    : [];
  return [
    ...primary,
    ...['front', 'body', 'back'].map((g) => ({ label: groups[g], icon: g === 'front' ? 'book-open' : g === 'body' ? 'file-text' : 'bookmark', sub: byGroup(g) })),
    { divider: true },
    { label: 'Import file as chapters…', icon: 'file-up', onClick: () => importFlow(undefined, state.book, () => touch('elements')) },
  ];
}

export function elementMenu(el) {
  const b = state.book;
  return [
    { label: 'Rename…', icon: 'pencil', onClick: async () => { const t = await promptDialog('Rename', 'Title', el.title); if (t != null) updateElement(el.id, { title: t }, 'elements'); } },
    { label: 'Duplicate', icon: 'copy', onClick: () => duplicateElement(el.id) },
    { label: 'Merge with next chapter', icon: 'merge', disabled: !nextInSection(b, el), onClick: async () => mergeWithNext(getEditor(), b, el) },
    { label: 'Insert after', icon: 'plus', sub: addMenuItems(el.section, el.id) },
    { divider: true },
    { label: 'Include in print', checked: el.include.print, onClick: () => { el.include.print = !el.include.print; touch('elements'); } },
    { label: 'Include in ebook', checked: el.include.ebook, onClick: () => { el.include.ebook = !el.include.ebook; touch('elements'); } },
    el.type === 'chapter' ? { label: 'Numbered chapter', checked: el.numbered, onClick: () => { el.numbered = !el.numbered; touch('elements'); } } : null,
    { label: 'Status', icon: 'flag', sub: STATUSES.map((s) => ({ label: s.label, checked: el.status === s.id, onClick: () => updateElement(el.id, { status: s.id }, 'elements') })) },
    { label: 'Move to', icon: 'move', sub: SECTIONS.map((s) => ({ label: s.label, checked: el.section === s.id, onClick: () => moveElement(el.id, { section: s.id }) })) },
    { label: 'Change type', icon: 'layers', sub: Object.entries(ELEMENT_TYPES).map(([id, d]) => ({ label: d.label, checked: el.type === id, onClick: () => { el.type = id; el.numbered = !!d.numbered; touch('elements'); } })) },
    { divider: true },
    { label: 'Delete', icon: 'trash', danger: true, onClick: async () => {
      if (await confirmDialog('Delete this page?', `“${displayTitle(b, el)}” and its text will be removed. This cannot be undone (snapshots are deleted too).`, { okLabel: 'Delete', danger: true })) deleteElement(el.id);
    } },
  ];
}

export function renderBinder(host) {
  const book = state.book;
  const collapsed = new Set(JSON.parse(sessionStorage.getItem('booky-collapsed') || '[]'));
  let filter = '';
  const list = h('div.binder-list');
  const goalBar = h('div');
  const search = h('input.input.binder-search', { placeholder: 'Filter chapters…', type: 'search', on: { input: () => { filter = search.value.toLowerCase(); draw(); } } });

  const pane = h(`aside.binder${state.app.sidebar === 'light' ? '' : '.deep'}`, { 'aria-label': 'Book structure' },
    h('div.binder-head', h('h3', 'Manuscript'),
      iconBtn('plus', 'Add page or chapter', (e) => menu(e.currentTarget, addMenuItems(null), { align: 'right' }))),
    search, list,
    h('div.binder-foot', goalBar));
  host.appendChild(pane);

  let dragId = null;

  function item(el, nums, inPart) {
    const def = ELEMENT_TYPES[el.type] || ELEMENT_TYPES.custom;
    const status = STATUSES.find((s) => s.id === el.status);
    const title = fillText(displayTitle(book, el, nums), book);
    const num = el.type === 'chapter' && nums[el.id] ? nums[el.id] : el.type === 'part' && nums[el.id] ? `P${nums[el.id]}` : '';
    const words = elementWords(el);
    const more = iconBtn('ellipsis', 'Options', (e) => { e.stopPropagation(); menu(e.currentTarget, elementMenu(el), { align: 'right' }); }, { cls: 'bi-more', size: 15 });
    const row = h(`div.binder-item${el.id === state.currentId ? '.active' : ''}${el.type === 'part' ? '.part' : ''}${inPart ? '.in-part' : ''}${!el.include.print && !el.include.ebook ? '.excluded' : ''}`, {
      draggable: 'true', tabindex: '0', role: 'button', title: `${def.label}${words ? ` · ${words.toLocaleString()} words` : ''}`,
      dataset: { id: el.id },
      on: {
        click: () => { selectElement(el.id); if (state.mode === 'plan') setMode('write'); },
        keydown: (e) => { if (e.key === 'Enter') selectElement(el.id); },
        contextmenu: (e) => { e.preventDefault(); menu({ x: e.clientX, y: e.clientY }, elementMenu(el)); },
        dragstart: (e) => { dragId = el.id; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', el.id); },
        dragend: () => { dragId = null; row.classList.remove('dragging'); list.querySelectorAll('.drop-before,.drop-after').forEach((n) => n.classList.remove('drop-before', 'drop-after')); },
        dragover: (e) => {
          if (!dragId || dragId === el.id) return;
          e.preventDefault();
          const r = row.getBoundingClientRect();
          const before = e.clientY < r.top + r.height / 2;
          row.classList.toggle('drop-before', before);
          row.classList.toggle('drop-after', !before);
        },
        dragleave: () => row.classList.remove('drop-before', 'drop-after'),
        drop: (e) => {
          e.preventDefault();
          const before = row.classList.contains('drop-before');
          row.classList.remove('drop-before', 'drop-after');
          if (dragId && dragId !== el.id) moveElement(dragId, { targetId: el.id, before });
        },
      },
    },
    h('span.bi-icon', icon(def.icon, 15)),
    h('span.bi-title', title),
    num ? h('span.bi-num', num) : null,
    status && el.status !== 'todo' ? h('span.bi-status', { style: { background: status.color }, title: status.label }) : null,
    el.source && el.trStatus !== 'reviewed' ? h('span.bi-tr', { title: el.trStatus === 'machine' ? 'Translation not reviewed yet' : 'Not translated yet' }, el.trStatus === 'machine' ? '◐' : '○') : null,
    more);
    return row;
  }

  function draw() {
    clear(list);
    const nums = computeNumbers(book);
    for (const sec of SECTIONS) {
      const els = book.elements.filter((e) => e.section === sec.id && (!filter || displayTitle(book, e, nums).toLowerCase().includes(filter)));
      const isCol = collapsed.has(sec.id);
      const head = h('div.binder-group-head', {
        on: {
          click: () => { isCol ? collapsed.delete(sec.id) : collapsed.add(sec.id); sessionStorage.setItem('booky-collapsed', JSON.stringify([...collapsed])); draw(); },
          dragover: (e) => { if (dragId) e.preventDefault(); },
          drop: (e) => { e.preventDefault(); if (dragId) moveElement(dragId, { section: sec.id }); },
        },
      }, icon(isCol ? 'chevron-right' : 'chevron-down', 13), sec.label, h('span.badge', els.length),
      iconBtn('plus', `Add to ${sec.label}`, (e) => { e.stopPropagation(); menu(e.currentTarget, addMenuItems(sec.id), { align: 'right' }); }, { size: 14 }));
      const group = h('div.binder-group', head);
      if (!isCol) {
        let inPart = false;
        for (const el of els) {
          if (el.type === 'part') inPart = true;
          group.appendChild(item(el, nums, inPart && el.type !== 'part' && sec.id === 'body'));
        }
        if (!els.length && !filter) group.appendChild(h('div.muted.small', { style: { padding: '4px 10px 8px' } }, 'Empty — use + to add pages'));
      }
      list.appendChild(group);
    }
    const total = bookWords(book);
    const target = book.goals.target || 0;
    const pct = target ? Math.min(100, Math.round((total / target) * 100)) : 0;
    clear(goalBar).append(
      h('div.row', { style: { justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' } },
        h('span', h('b', total.toLocaleString()), ' words'),
        h('span.muted', target ? `${pct}% of ${target.toLocaleString()}` : 'No goal set')),
      h('div.progress', h('div', { style: { width: `${pct}%` } })));
    list.querySelector('.binder-item.active')?.scrollIntoView({ block: 'nearest' });
  }
  draw();

  const offs = [on('elements', draw), on('select', draw), on('book', draw), on('element-title', draw), on('meta', draw)];
  let t;
  offs.push(on('content', () => { clearTimeout(t); t = setTimeout(draw, 1500); }));
  return () => offs.forEach((f) => f());
}
