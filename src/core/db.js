// Tiny IndexedDB wrapper. Everything is stored locally in the browser — no server.
const DB_NAME = 'booky';
const VERSION = 1;
let dbp;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const db = {
  allBooks: () => tx('books', 'readonly', (s) => s.getAll()),
  getBook: (id) => tx('books', 'readonly', (s) => s.get(id)),
  putBook: (book) => tx('books', 'readwrite', (s) => s.put(book)),
  deleteBook: (id) => tx('books', 'readwrite', (s) => s.delete(id)),
  get: (key) => tx('kv', 'readonly', (s) => s.get(key)),
  set: (key, val) => tx('kv', 'readwrite', (s) => s.put(val, key)),
};

// Ask the browser to keep our data even under storage pressure.
export function requestPersistence() {
  try { navigator.storage?.persist?.(); } catch { /* not supported */ }
}
