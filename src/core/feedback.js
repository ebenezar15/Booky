// Reviewer feedback: reviewers, review rounds and their comments, kept inside the book.
import { uid } from './model.js';

export const REVIEWER_COLORS = ['#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5'];

export const COMMENT_TYPES = {
  comment: { label: 'Comment', icon: 'messages-square' },
  suggestion: { label: 'Suggested edit', icon: 'pencil' },
  question: { label: 'Question', icon: 'circle-question-mark' },
  highlight: { label: 'Highlight', icon: 'highlighter' },
  praise: { label: 'Praise', icon: 'heart' },
  error: { label: 'Error / typo', icon: 'triangle-alert' },
};

export function ensureReviews(book) {
  if (!book.reviews) book.reviews = { reviewers: [], comments: [], overall: [], rounds: [] };
  for (const k of ['reviewers', 'comments', 'overall', 'rounds']) if (!Array.isArray(book.reviews[k])) book.reviews[k] = [];
  return book.reviews;
}

export function addReviewer(book, { name, email, note = '' }) {
  const r = ensureReviews(book);
  const used = new Set(r.reviewers.map((x) => x.color));
  const color = REVIEWER_COLORS.find((c) => !used.has(c)) || REVIEWER_COLORS[r.reviewers.length % REVIEWER_COLORS.length];
  const rev = { id: uid('rv_'), name: name.trim() || email, email: email.trim(), color, note, createdAt: Date.now(), copies: [] };
  r.reviewers.push(rev);
  return rev;
}

/** Merge a .bookyreview file. Returns { added, updated, reviewer } or throws. */
export function importReviewFile(book, data) {
  if (!data || data.type !== 'booky-review') throw new Error('This is not a Booky comments file.');
  const r = ensureReviews(book);
  if (data.bookId && data.bookId !== book.id) throw new Error(`These comments are for another book (“${data.bookTitle || 'unknown'}”).`);
  let rev = r.reviewers.find((x) => x.id === data.reviewer?.id) || r.reviewers.find((x) => x.email.toLowerCase() === (data.reviewer?.email || '').toLowerCase());
  if (!rev) {
    rev = addReviewer(book, { name: data.reviewer?.name || 'Reviewer', email: data.reviewer?.email || '' });
  }
  rev.lastImport = Date.now();
  let added = 0, updated = 0;
  for (const c of data.comments || []) {
    const existing = r.comments.find((x) => x.id === c.id);
    const clean = {
      id: c.id, reviewerId: rev.id, roundId: data.roundId, elId: c.elId, sectionTitle: c.sectionTitle || '',
      quote: String(c.quote || '').slice(0, 2000), prefix: String(c.prefix || '').slice(0, 80), suffix: String(c.suffix || '').slice(0, 80),
      offset: +c.offset || 0, type: COMMENT_TYPES[c.type] ? c.type : 'comment', color: c.color || '',
      note: String(c.note || '').slice(0, 5000), suggestion: c.suggestion != null ? String(c.suggestion).slice(0, 5000) : null,
      createdAt: c.createdAt || Date.now(),
    };
    if (existing) {
      // keep the author's status/reply; update the reviewer's text
      Object.assign(existing, { ...clean, status: existing.status, reply: existing.reply });
      updated++;
    } else {
      r.comments.push({ ...clean, status: 'open', reply: '' });
      added++;
    }
  }
  // Comments the reviewer deleted since their last export
  const ids = new Set((data.comments || []).map((c) => c.id));
  const removed = r.comments.filter((c) => c.reviewerId === rev.id && c.roundId === data.roundId && !ids.has(c.id) && c.status === 'open');
  r.comments = r.comments.filter((c) => !removed.includes(c));
  if (data.overall && (data.overall.rating || data.overall.text)) {
    r.overall = r.overall.filter((o) => !(o.reviewerId === rev.id && o.roundId === data.roundId));
    r.overall.push({ reviewerId: rev.id, roundId: data.roundId, rating: +data.overall.rating || 0, text: String(data.overall.text || '').slice(0, 10000), at: data.sentAt || Date.now() });
  }
  return { added, updated, removed: removed.length, reviewer: rev };
}

/** Comments in reading order (book order, then position in the chapter). */
export function orderedComments(book, list) {
  const order = new Map(book.elements.map((e, i) => [e.id, i]));
  const sec = { front: 0, body: 1, back: 2 };
  const elIdx = (id) => { const e = book.elements.find((x) => x.id === id); return e ? sec[e.section] * 10000 + order.get(id) : 1e9; };
  return [...list].sort((a, b) => elIdx(a.elId) - elIdx(b.elId) || a.offset - b.offset || a.createdAt - b.createdAt);
}

/** Find a quote inside text, using prefix/suffix to pick the right occurrence. Returns {start,end} or null.
    Whitespace is compared loosely but positions refer to the original text. */
export function locateQuote(text, c) {
  const ws = (s) => s.replace(/\s/g, ' ');
  const t = ws(text), q = ws(c.quote || '');
  if (!q.trim()) return null;
  let best = null, bestScore = -1, i = -1;
  const p = ws(c.prefix || ''), s = ws(c.suffix || '');
  while ((i = t.indexOf(q, i + 1)) !== -1) {
    const before = t.slice(Math.max(0, i - 40), i), after = t.slice(i + q.length, i + q.length + 40);
    let score = 0;
    for (let k = 1; k <= Math.min(p.length, before.length); k++) { if (p[p.length - k] === before[before.length - k]) score++; else break; }
    for (let k = 0; k < Math.min(s.length, after.length); k++) { if (s[k] === after[k]) score++; else break; }
    if (score > bestScore) { bestScore = score; best = { start: i, end: i + q.length }; }
  }
  if (!best) {
    // The text may have been edited since: fall back to the first 40 characters of the quote.
    const head = q.trim().slice(0, 40);
    const j = head.length >= 12 ? t.indexOf(head) : -1;
    if (j >= 0) best = { start: j, end: j + head.length, partial: true };
  }
  return best;
}
