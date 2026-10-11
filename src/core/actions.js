// Book structure mutations shared by the binder, corkboard and inspector.
import { state, touch, selectElement } from './store.js';
import { createElement, ELEMENT_TYPES, uid } from './model.js';

export function addElement(type, { section, afterId, select = true } = {}) {
  const b = state.book;
  const el = createElement(type);
  if (section) el.section = section;
  let idx = b.elements.length;
  if (afterId) {
    const i = b.elements.findIndex((e) => e.id === afterId);
    if (i >= 0) { idx = i + 1; if (!section) el.section = b.elements[i].section; }
  } else {
    // append at the end of its section
    const last = b.elements.map((e) => e.section).lastIndexOf(el.section);
    if (last >= 0) idx = last + 1;
  }
  b.elements.splice(idx, 0, el);
  touch('elements');
  if (select) selectElement(el.id);
  return el;
}

export function deleteElement(id) {
  const b = state.book;
  const i = b.elements.findIndex((e) => e.id === id);
  if (i < 0) return;
  b.elements.splice(i, 1);
  if (state.currentId === id) selectElement(b.elements[Math.min(i, b.elements.length - 1)]?.id || null);
  touch('elements');
}

export function duplicateElement(id) {
  const b = state.book;
  const i = b.elements.findIndex((e) => e.id === id);
  if (i < 0) return;
  const copy = JSON.parse(JSON.stringify(b.elements[i]));
  copy.id = uid('el_');
  copy.title = copy.title ? copy.title + ' (copy)' : '';
  copy.snapshots = [];
  b.elements.splice(i + 1, 0, copy);
  touch('elements');
  selectElement(copy.id);
}

// Move `id` before/after `targetId` (adopting the target's section), or to the end of `section`.
export function moveElement(id, { targetId, before = true, section } = {}) {
  const b = state.book;
  const from = b.elements.findIndex((e) => e.id === id);
  if (from < 0 || id === targetId) return;
  const [el] = b.elements.splice(from, 1);
  if (targetId) {
    let to = b.elements.findIndex((e) => e.id === targetId);
    el.section = b.elements[to].section;
    if (!before) to++;
    b.elements.splice(to, 0, el);
  } else {
    el.section = section || el.section;
    const last = b.elements.map((e) => e.section).lastIndexOf(el.section);
    b.elements.splice(last + 1, 0, el);
  }
  touch('elements');
}

export function updateElement(id, patch, what = 'element') {
  const el = state.book.elements.find((e) => e.id === id);
  if (!el) return;
  Object.assign(el, patch);
  touch(what, id);
}

export function takeSnapshot(el, name = '') {
  el.snapshots = el.snapshots || [];
  el.snapshots.unshift({ id: uid('sn_'), date: Date.now(), name: name || new Date().toLocaleString(), content: el.content, title: el.title });
  if (el.snapshots.length > 30) el.snapshots.length = 30;
  touch('snapshots', el.id);
}

export function typesForSection(section) {
  return Object.entries(ELEMENT_TYPES).filter(([, d]) => d.section === section || (section === 'body' && d.section === 'body')).map(([id, d]) => ({ id, ...d }));
}
