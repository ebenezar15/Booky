// Global app state with change events and debounced autosave.
import { db } from './db.js';
import { bookWords, normalizeBook } from './model.js';

const listeners = new Map();

export const state = {
  book: null,
  currentId: null,
  mode: 'write',
  saving: 'saved', // saved | pending | saving | error
  app: {
    theme: 'light',
    colorScheme: 'cadenza',
    customPrimary: '#7c3aed',
    customAccent: '#d946ef',
    sidebar: 'deep',
    customTemplates: [],
    references: [],
    authorEmail: '',
    dictionary: [],
    ignored: [],
    customFonts: [], // {name, data(dataURL), format}
    spellcheck: true,
    grammar: true,
    styleHints: true,
    showInspector: true,
    showBinder: true,
    typewriter: false,
  },
};

export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt).delete(fn);
}

export function emit(evt, data) {
  listeners.get(evt)?.forEach((fn) => {
    try { fn(data); } catch (e) { console.error(e); }
  });
}

export async function loadAppSettings() {
  const saved = await db.get('app').catch(() => null);
  if (saved) Object.assign(state.app, saved);
}

let appTimer;
export function saveAppSettings() {
  clearTimeout(appTimer);
  appTimer = setTimeout(() => db.set('app', JSON.parse(JSON.stringify(state.app))).catch(console.error), 300);
}

export function setApp(patch) {
  Object.assign(state.app, patch);
  saveAppSettings();
  emit('app', patch);
}

export async function openBook(id) {
  const raw = await db.getBook(id);
  if (!raw) throw new Error('Book not found');
  state.book = normalizeBook(raw);
  state.currentId = state.book.elements.find((e) => e.type === 'chapter')?.id || state.book.elements[0]?.id || null;
  sessionStart = bookWords(state.book);
  emit('book');
  return state.book;
}

export function closeBook() {
  flushSave();
  state.book = null;
  state.currentId = null;
  emit('book');
}

let sessionStart = 0;
export const sessionWords = () => (state.book ? bookWords(state.book) - sessionStart : 0);

let saveTimer;
// Call after any mutation. `what` lets views refresh only what changed.
export function touch(what = 'book', data) {
  const b = state.book;
  if (!b) return;
  b.updatedAt = Date.now();
  state.saving = 'pending';
  emit('saving', state.saving);
  emit(what, data);
  if (what !== 'book') emit('changed', what);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 700);
}

function recordProgress(b) {
  const day = new Date().toISOString().slice(0, 10);
  b.goals.history[day] = bookWords(b);
}

export async function save() {
  const b = state.book;
  if (!b) return;
  clearTimeout(saveTimer);
  recordProgress(b);
  state.saving = 'saving';
  emit('saving', state.saving);
  try {
    await db.putBook(JSON.parse(JSON.stringify(b)));
    state.saving = 'saved';
  } catch (e) {
    console.error(e);
    state.saving = 'error';
  }
  emit('saving', state.saving);
}

export function flushSave() {
  if (state.saving === 'pending') save();
}

export const currentElement = () => state.book?.elements.find((e) => e.id === state.currentId) || null;

export function selectElement(id) {
  state.currentId = id;
  emit('select', id);
}

export function setMode(mode) {
  state.mode = mode;
  emit('mode', mode);
}

window.addEventListener('beforeunload', () => flushSave());
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
