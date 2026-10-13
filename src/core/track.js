// Tracked changes (pure, unit-tested). Suggested insertions and deletions are stored in a chapter's HTML as
//   <span class="tc-ins" data-tc-id data-author data-at>…</span>   and   <span class="tc-del" …>…</span>
// These helpers accept or reject them in HTML, list them, and read a Word document's revisions and comments.

const TC_RE = /^<span\b[^>]*\bclass="[^"]*\btc-(ins|del)\b[^"]*"[^>]*>$/i;
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i')); return m ? m[1] : ''; };
const decode = (s) => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

/** Walk an HTML string; for each tracked-change span call decide(kind, tag) → 'keep' | 'unwrap' | 'drop'. */
function transform(html, decide) {
  const parts = String(html).split(/(<[^>]+>)/);
  const out = [];
  const stack = []; // per open <span>: { action }
  let dropDepth = 0;
  for (const p of parts) {
    if (!p) continue;
    if (/^<span\b/i.test(p)) {
      const m = p.match(TC_RE);
      const action = m ? decide(m[1].toLowerCase(), p) : 'keep';
      stack.push(action);
      if (dropDepth) { dropDepth++; continue; }
      if (action === 'drop') { dropDepth = 1; continue; }
      if (action === 'unwrap') continue;
      out.push(p);
      continue;
    }
    if (/^<\/span>/i.test(p)) {
      const action = stack.pop();
      if (dropDepth) { dropDepth--; continue; }
      if (action === 'unwrap') continue;
      out.push(p);
      continue;
    }
    if (dropDepth) continue;
    out.push(p);
  }
  return out.join('');
}

/** Accept changes (all, or one id): insertions stay as plain text, deletions disappear. */
export const acceptHtml = (html, id = null) => transform(html, (kind, tag) => (id && attr(tag, 'data-tc-id') !== id ? 'keep' : kind === 'ins' ? 'unwrap' : 'drop'));
/** Reject changes (all, or one id): insertions disappear, deletions come back as plain text. */
export const rejectHtml = (html, id = null) => transform(html, (kind, tag) => (id && attr(tag, 'data-tc-id') !== id ? 'keep' : kind === 'ins' ? 'drop' : 'unwrap'));
/** The text as if every change were accepted (used for print, ebook and plain exports). */
export const finalHtml = (html) => (String(html).includes('tc-') ? acceptHtml(html) : html);

/** Changes in one chapter: [{ id, kind, author, at, text }] in reading order (one entry per id and kind). */
export function listChanges(html) {
  const out = [];
  const parts = String(html).split(/(<[^>]+>)/);
  let cur = null, depth = 0;
  for (const p of parts) {
    if (!p) continue;
    if (/^<span\b/i.test(p)) {
      const m = p.match(TC_RE);
      if (m && !cur) {
        const id = attr(p, 'data-tc-id'), kind = m[1].toLowerCase();
        cur = out.find((c) => c.id === id && c.kind === kind);
        if (!cur) { cur = { id, kind, author: decode(attr(p, 'data-author')), at: +attr(p, 'data-at') || 0, text: '' }; out.push(cur); }
        depth = 1;
      } else if (cur) depth++;
      continue;
    }
    if (/^<\/span>/i.test(p)) { if (cur && --depth === 0) cur = null; continue; }
    if (cur && !p.startsWith('<')) cur.text += decode(p);
  }
  return out;
}

export const countChanges = (elements) => elements.reduce((n, e) => n + listChanges(e.content || '').length, 0);

export const changeSpan = (kind, { id, author, at }, innerHtml) => `<span class="tc-${kind}" data-tc-id="${escAttr(id)}" data-author="${escAttr(author || '')}" data-at="${+at || 0}">${innerHtml}</span>`;

/**
 * Put changes into one paragraph's HTML. Offsets count characters of the paragraph's text as it is now
 * (the "original" in Word terms). changes: [{ offset, del: 'text', ins: 'text', id, author, at }]
 * Deleted text is wrapped (piece by piece if it crosses tags); inserted text goes right after it.
 */
export function applyParagraphChanges(html, changes) {
  let out = String(html);
  for (const ch of [...changes].sort((a, b) => b.offset - a.offset)) {
    const parts = out.split(/(<[^>]+>)/);
    let pos = 0, inserted = false;
    const endDel = ch.offset + (ch.del ? ch.del.length : 0);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p || p.startsWith('<')) continue;
      const text = decode(p);
      const a = pos, b = pos + text.length;
      // the part of this text node covered by the deletion
      const s = Math.max(a, ch.offset), e = Math.min(b, endDel);
      let piece = '';
      if (ch.del && s < e) {
        piece = esc(text.slice(0, s - a)) + changeSpan('del', ch, esc(text.slice(s - a, e - a)));
        const rest = text.slice(e - a);
        if (!inserted && ch.ins && e === endDel) { piece += changeSpan('ins', ch, esc(ch.ins)); inserted = true; }
        piece += esc(rest);
        parts[i] = piece;
      } else if (!ch.del && !inserted && ch.ins && ch.offset >= a && ch.offset <= b && (ch.offset < b || i === lastTextIndex(parts))) {
        parts[i] = esc(text.slice(0, ch.offset - a)) + changeSpan('ins', ch, esc(ch.ins)) + esc(text.slice(ch.offset - a));
        inserted = true;
      }
      pos = b;
    }
    if (!inserted && ch.ins && !ch.del && pos <= ch.offset) {
      // empty paragraph or offset at the very end
      out = parts.join('').replace(/(<\/p>|<\/h\d>|<\/li>)?$/, (m) => `${changeSpan('ins', ch, esc(ch.ins))}${m || ''}`);
      continue;
    }
    out = parts.join('');
  }
  return out;
}
const lastTextIndex = (parts) => { for (let i = parts.length - 1; i >= 0; i--) if (parts[i] && !parts[i].startsWith('<')) return i; return -1; };

// ---------- reading a Word document (document.xml / comments.xml) ----------
const xmlDecode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const xattr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? xmlDecode(m[1]) : ''; };

/**
 * Paragraphs of a Word document with their text, revisions and comment ranges.
 * @returns [{ style, bookmarks: [name], original, changes: [{ offset, del, ins, author, date, wid }], comments: [{ id, start, end }] }]
 * `original` is the text without insertions and with deletions (what the author sent).
 */
export function readWordParagraphs(documentXml) {
  const paras = [];
  const body = String(documentXml).replace(/<w:footnoteReference[^>]*\/>/g, '').replace(/<w:instrText[^>]*>[\s\S]*?<\/w:instrText>/g, '');
  const tokens = body.match(/<[^>]+>|[^<]+/g) || [];
  let p = null, inIns = null, inDel = null, inText = false, inDelText = false, inField = 0, change = null;
  const openComments = new Map();
  const flush = () => { if (change) { p.changes.push(change); change = null; } };
  for (const t of tokens) {
    if (t.startsWith('<w:p ') || t === '<w:p>' || /^<w:p\b[^>]*>$/.test(t)) { p = { style: '', bookmarks: [], original: '', changes: [], comments: [] }; continue; }
    if (t === '</w:p>') { if (p) { flush(); for (const [id, start] of openComments) if (start.p === p) { p.comments.push({ id, start: start.at, end: p.original.length }); openComments.delete(id); } paras.push(p); } p = null; continue; }
    if (!p) {
      if (/^<w:bookmarkStart\b/.test(t)) (paras.pendingBookmarks ||= []).push(xattr(t, 'w:name'));
      continue;
    }
    if (paras.pendingBookmarks?.length) { p.bookmarks.push(...paras.pendingBookmarks); paras.pendingBookmarks = []; }
    if (/^<w:pStyle\b/.test(t)) { p.style = xattr(t, 'w:val'); continue; }
    if (/^<w:bookmarkStart\b/.test(t)) { p.bookmarks.push(xattr(t, 'w:name')); continue; }
    if (/^<w:fldChar\b/.test(t)) { const k = xattr(t, 'w:fldCharType'); if (k === 'begin') inField++; else if (k === 'end') inField = Math.max(0, inField - 1); continue; }
    if (/^<w:ins\b/.test(t) && !t.endsWith('/>')) { inIns = { author: xattr(t, 'w:author'), date: xattr(t, 'w:date'), wid: xattr(t, 'w:id') }; continue; }
    if (t === '</w:ins>') { inIns = null; continue; }
    if (/^<w:del\b/.test(t) && !t.endsWith('/>')) { inDel = { author: xattr(t, 'w:author'), date: xattr(t, 'w:date'), wid: xattr(t, 'w:id') }; continue; }
    if (t === '</w:del>') { inDel = null; continue; }
    if (/^<w:commentRangeStart\b/.test(t)) { openComments.set(xattr(t, 'w:id'), { p, at: p.original.length }); continue; }
    if (/^<w:commentRangeEnd\b/.test(t)) {
      const id = xattr(t, 'w:id'); const st = openComments.get(id);
      if (st) { if (st.p === p) p.comments.push({ id, start: st.at, end: p.original.length }); else p.comments.push({ id, start: 0, end: p.original.length, from: st }); openComments.delete(id); }
      continue;
    }
    if (/^<w:t\b/.test(t) && !t.endsWith('/>')) { inText = true; continue; }
    if (t === '</w:t>') { inText = false; continue; }
    if (/^<w:delText\b/.test(t) && !t.endsWith('/>')) { inDelText = true; continue; }
    if (t === '</w:delText>') { inDelText = false; continue; }
    if (/^<w:tab\b/.test(t)) { if (!inField) addText('\t'); continue; }
    if (/^<w:br\b/.test(t)) { if (!inField) addText('\n'); continue; }
    if (!t.startsWith('<') && (inText || inDelText) && !inField) addText(xmlDecode(t));
  }
  delete paras.pendingBookmarks;
  return paras;

  function addText(text) {
    if (inDel || inDelText) {
      // deleted text is part of the original
      if (!change || change.ins || change.author !== inDel?.author) { flush(); change = { offset: p.original.length, del: '', ins: '', author: inDel?.author || '', date: inDel?.date || '', wid: inDel?.wid || '' }; }
      change.del += text;
      p.original += text;
    } else if (inIns) {
      if (!change || change.author !== inIns.author || change.offset + change.del.length !== p.original.length) { flush(); change = { offset: p.original.length, del: '', ins: '', author: inIns.author, date: inIns.date, wid: inIns.wid }; }
      change.ins += text;
    } else {
      flush();
      p.original += text;
    }
  }
}

/** Comments in comments.xml: Map id → { author, date, text } */
export function readWordComments(commentsXml) {
  const out = new Map();
  for (const m of String(commentsXml || '').matchAll(/<w:comment\b([^>]*)>([\s\S]*?)<\/w:comment>/g)) {
    const text = [...m[2].matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((pm) => [...pm[0].matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>/g)].map((t) => xmlDecode(t[1])).join('')).join('\n').trim();
    out.set(xattr(`<x${m[1]}>`, 'w:id'), { author: xattr(`<x${m[1]}>`, 'w:author'), date: xattr(`<x${m[1]}>`, 'w:date'), text });
  }
  return out;
}

const norm = (s) => String(s).replace(/[\s ]+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

/**
 * Match the Word paragraphs to Booky's chapters and paragraphs.
 * chapters: [{ elId, title, blocks: [plainText of each top-level block] }]  (Booky's current text)
 * @returns { placed: [{ elId, block, para }], unplaced: [para] }
 * Booky's own DOCX export writes a bookmark "bk_<elId>" at each chapter; other files are matched by text.
 */
export function placeParagraphs(paras, chapters) {
  const byBookmark = new Map(chapters.map((c) => [`bk_${String(c.elId).replace(/[^\w]/g, '_')}`.slice(0, 40), c]));
  let ch = null, cursor = 0;
  const placed = [], unplaced = [];
  for (const para of paras) {
    const mark = para.bookmarks.find((b) => byBookmark.has(b));
    if (mark) { ch = byBookmark.get(mark); cursor = 0; }
    const text = norm(para.original);
    if (!text) continue;
    // a chapter heading (no bookmark): switch chapter
    if (!mark) { const hit = chapters.find((c) => norm(c.title) && norm(c.title) === text); if (hit && hit !== ch && !para.changes.length) { ch = hit; cursor = 0; continue; } }
    const search = (c, from) => { for (let i = from; i < c.blocks.length; i++) if (norm(c.blocks[i]) === text) return i; return -1; };
    let i = ch ? search(ch, cursor) : -1;
    if (i < 0 && ch) i = search(ch, 0);
    if (i < 0) {
      // anywhere in the book
      for (const c of chapters) { const j = search(c, 0); if (j >= 0) { ch = c; i = j; break; } }
    }
    if (i < 0) { if (para.changes.length || para.comments.length) unplaced.push(para); continue; }
    cursor = i + 1;
    if (para.changes.length || para.comments.length) placed.push({ elId: ch.elId, block: i, para });
  }
  return { placed, unplaced };
}
