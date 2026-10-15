// Apple Pages (.pages) import, offline. Pure functions (unit-tested with hand-built files).
//
// Pages 5 and later: a zip of "IWA" files — Snappy-compressed chunks holding protobuf archives.
//   chunk: 0x00, 3-byte little-endian length, raw Snappy block
//   stream: varint length + TSP.ArchiveInfo { identifier = 1; message_infos = 2 { type = 1; length = 3 } }, then each message's bytes
//   text lives in TSWP.StorageArchive (type 2001/2005): kind = 1 (0 = body), text = 3, table_para_style = 5, table_char_style = 8,
//   where an ObjectAttributeTable is { entries = 1 { character_index = 1; object = 2 { identifier = 1 } } }.
//   Styles: TSWP.ParagraphStyleArchive / CharacterStyleArchive { super = 1 (TSS.StyleArchive { name = 1; style_identifier = 2; parent = 3 }); char_properties = 11 }
//   CharacterStylePropertiesArchive: bold = 1, italic = 2, superscript = 10 (1 super, 2 sub), underline = 11, strikethru = 12, capitalization = 13 (2 = small caps).
// Pages '09: a zip with index.xml (or index.xml.gz) — paragraphs are <sf:p>.

// ---------- Snappy (raw block format) ----------
export function snappyDecompress(src) {
  let pos = 0, len = 0, shift = 0;
  for (;;) { const b = src[pos++]; len |= (b & 0x7f) << shift; if (b < 0x80) break; shift += 7; }
  const out = new Uint8Array(len);
  let op = 0;
  while (pos < src.length) {
    const tag = src[pos++];
    const type = tag & 3;
    if (type === 0) { // literal
      let n = tag >> 2;
      if (n >= 60) { const bytes = n - 59; n = 0; for (let i = 0; i < bytes; i++) n |= src[pos++] << (8 * i); }
      n += 1;
      out.set(src.subarray(pos, pos + n), op); pos += n; op += n;
      continue;
    }
    let length, offset;
    if (type === 1) { length = ((tag >> 2) & 7) + 4; offset = ((tag >> 5) << 8) | src[pos++]; }
    else if (type === 2) { length = (tag >> 2) + 1; offset = src[pos] | (src[pos + 1] << 8); pos += 2; }
    else { length = (tag >> 2) + 1; offset = (src[pos] | (src[pos + 1] << 8) | (src[pos + 2] << 16) | (src[pos + 3] << 24)) >>> 0; pos += 4; }
    if (!offset || offset > op) throw new Error('Bad Snappy data');
    for (let i = 0; i < length; i++, op++) out[op] = out[op - offset];
  }
  return out.subarray(0, op);
}

/** Unwrap an .iwa file: its chunks, decompressed and joined. */
export function iwaDecompress(data) {
  const parts = [];
  let pos = 0, total = 0;
  while (pos + 4 <= data.length) {
    const kind = data[pos];
    const n = data[pos + 1] | (data[pos + 2] << 8) | (data[pos + 3] << 16);
    pos += 4;
    const block = data.subarray(pos, pos + n);
    pos += n;
    if (kind !== 0) continue;
    const d = snappyDecompress(block);
    parts.push(d); total += d.length;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ---------- protobuf ----------
function varint(buf, st) {
  let r = 0, mul = 1, b;
  do { b = buf[st.pos++]; r += (b & 0x7f) * mul; mul *= 128; } while (b >= 0x80 && st.pos < buf.length);
  return r;
}
/** Decode a message into { field: [values] }; length-delimited values are Uint8Arrays, varints are numbers. */
export function pbDecode(buf) {
  const st = { pos: 0 };
  const f = {};
  while (st.pos < buf.length) {
    const key = varint(buf, st);
    const no = Math.floor(key / 8), wt = key & 7;
    let v;
    if (wt === 0) v = varint(buf, st);
    else if (wt === 1) { v = buf.subarray(st.pos, st.pos + 8); st.pos += 8; }
    else if (wt === 2) { const n = varint(buf, st); v = buf.subarray(st.pos, st.pos + n); st.pos += n; }
    else if (wt === 5) { v = buf.subarray(st.pos, st.pos + 4); st.pos += 4; }
    else break; // groups are not used by iWork
    (f[no] ||= []).push(v);
  }
  return f;
}
const dec = new TextDecoder();
const str = (v) => (v instanceof Uint8Array ? dec.decode(v) : '');
const sub = (f, n) => (f[n]?.[0] instanceof Uint8Array ? pbDecode(f[n][0]) : null);
const num = (f, n) => (typeof f?.[n]?.[0] === 'number' ? f[n][0] : undefined);

/** All archives in a decompressed IWA stream: [{ id, type, data }]. */
export function iwaArchives(stream) {
  const out = [];
  const st = { pos: 0 };
  while (st.pos < stream.length) {
    const n = varint(stream, st);
    const info = pbDecode(stream.subarray(st.pos, st.pos + n));
    st.pos += n;
    const id = num(info, 1);
    for (const mi of info[2] || []) {
      const m = pbDecode(mi);
      const len = num(m, 3) || 0;
      out.push({ id, type: num(m, 1), data: stream.subarray(st.pos, st.pos + len) });
      st.pos += len;
    }
  }
  return out;
}

const STORAGE_TYPES = new Set([2001, 2005]);

/** Read a style archive: name, identifier, parent id and character properties. */
function readStyle(data) {
  const f = pbDecode(data);
  const s = sub(f, 1) || {};
  const cp = sub(f, 11) || {};
  return {
    name: str(s[1]?.[0]), ident: str(s[2]?.[0]), parent: num(sub(s, 3), 1),
    bold: num(cp, 1), italic: num(cp, 2), sup: num(cp, 10), underline: num(cp, 11), strike: num(cp, 12), caps: num(cp, 13),
  };
}

function table(f, n) {
  const t = sub(f, n);
  return (t?.[1] || []).map((e) => { const x = pbDecode(e); return { at: num(x, 1) || 0, ref: num(sub(x, 2), 1) }; }).sort((a, b) => a.at - b.at);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Which HTML a paragraph style becomes. */
export function blockFor(style) {
  const s = `${style?.name || ''} ${style?.ident || ''}`.toLowerCase();
  if (/subtitle/.test(s)) return 'p.ps-subtitle';
  if (/\btitle\b|chapter/.test(s)) return 'h1';
  if (/heading\s*3|heading-3/.test(s)) return 'h3';
  if (/heading\s*2|heading-2|subheading/.test(s)) return 'h2';
  if (/heading/.test(s)) return 'h1';
  if (/quote/.test(s)) return 'blockquote';
  return 'p';
}

/**
 * Turn the archives of a Pages document into HTML.
 * @param archives [{ id, type, data }] from every .iwa file
 */
export function pagesArchivesToHtml(archives) {
  const byId = new Map(archives.map((a) => [a.id, a]));
  const styles = new Map();
  const style = (id) => {
    if (id == null) return null;
    if (styles.has(id)) return styles.get(id);
    const a = byId.get(id);
    let s = null;
    try { s = a ? readStyle(a.data) : null; } catch { s = null; }
    styles.set(id, s);
    if (s && s.parent != null && s.parent !== id) {
      const p = style(s.parent);
      if (p) for (const k of ['name', 'ident', 'bold', 'italic', 'sup', 'underline', 'strike', 'caps']) if (s[k] === undefined || s[k] === '') s[k] = p[k];
    }
    return s;
  };
  const storages = [];
  for (const a of archives) {
    if (!STORAGE_TYPES.has(a.type)) continue;
    let f;
    try { f = pbDecode(a.data); } catch { continue; }
    const text = (f[3] || []).map(str).join('');
    if (!text.trim()) continue;
    storages.push({ kind: num(f, 1) ?? 3, text, para: table(f, 5), chars: table(f, 8) });
  }
  if (!storages.length) return '';
  const body = storages.filter((s) => s.kind === 0);
  const use = body.length ? body : [storages.sort((a, b) => b.text.length - a.text.length)[0]];
  return use.map(storageHtml).join('');

  function storageHtml(s) {
    const html = [];
    // paragraph-style entries without an object continue the previous style; character-style ones end the run
    const at = (tbl, i, keep) => { let r = null; for (const e of tbl) { if (e.at > i) break; if (e.ref != null || !keep) r = e.ref ?? null; } return r; };
    let start = 0;
    const text = s.text;
    for (let i = 0; i <= text.length; i++) {
      const c = text[i];
      if (i < text.length && c !== '\n' && c !== '\u2029' && c !== '\f') continue;
      const tag = blockFor(style(at(s.para, start, true)));
      // runs of character styles inside the paragraph
      let inner = '';
      let runStart = start;
      const bounds = new Set([start, i, ...s.chars.map((e) => e.at).filter((x) => x > start && x < i)]);
      const cuts = [...bounds].sort((a, b) => a - b);
      for (let k = 0; k < cuts.length - 1; k++) {
        runStart = cuts[k];
        const piece = text.slice(runStart, cuts[k + 1])
          .replace(/[\u0000-\u0008\u000B\u000E-\u001F\uFFFC]/g, '') // attachments and control marks
          .replace(/\u2028/g, '\n');
        if (!piece) continue;
        const cs = style(at(s.chars, runStart, false));
        let t = esc(piece).replace(/\n/g, '<br>').replace(/\t/g, ' ');
        if (cs) {
          const n = `${cs.name} ${cs.ident}`.toLowerCase();
          if (cs.caps === 2) t = `<span class="sc">${t}</span>`;
          if (cs.sup === 1) t = `<sup>${t}</sup>`; else if (cs.sup === 2) t = `<sub>${t}</sub>`;
          if (cs.strike) t = `<s>${t}</s>`;
          if (cs.underline) t = `<u>${t}</u>`;
          if (cs.italic || /emphasis/.test(n)) t = `<em>${t}</em>`;
          if (cs.bold || /strong/.test(n)) t = `<strong>${t}</strong>`;
        }
        inner += t;
      }
      if (inner.replace(/<[^>]+>/g, '').trim()) {
        const [name, cls] = tag.split('.');
        html.push(name === 'blockquote' ? `<blockquote><p>${inner}</p></blockquote>` : `<${name}${cls ? ` class="${cls}"` : ''}>${inner}</${name}>`);
      }
      start = i + 1;
    }
    return html.join('');
  }
}

/** Pages '09 (XML): paragraphs from index.xml. */
export function pagesXmlToHtml(xml) {
  const out = [];
  const body = xml.match(/<sf:text-body[\s\S]*?<\/sf:text-body>/)?.[0] || xml;
  for (const m of body.matchAll(/<sf:p\b([^>]*)>([\s\S]*?)<\/sf:p>/g)) {
    const style = m[1].match(/sf:style="([^"]*)"/)?.[1] || '';
    const text = m[2].replace(/<sf:(br|lnbr)\s*\/>/g, '\n').replace(/<sf:tab\s*\/>/g, ' ').replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    if (!text.trim()) continue;
    const tag = blockFor({ name: style, ident: style });
    const inner = esc(text).replace(/\n/g, '<br>');
    const [name, cls] = tag.split('.');
    out.push(name === 'blockquote' ? `<blockquote><p>${inner}</p></blockquote>` : `<${name}${cls ? ` class="${cls}"` : ''}>${inner}</${name}>`);
  }
  return out.join('');
}

/** Read a .pages file (as a JSZip instance). Returns HTML, or throws with advice. */
export async function readPagesZip(zip) {
  const iwa = Object.keys(zip.files).filter((n) => /\.iwa$/i.test(n));
  if (iwa.length) {
    const archives = [];
    for (const name of iwa) {
      try { archives.push(...iwaArchives(iwaDecompress(await zip.file(name).async('uint8array')))); } catch { /* skip an unreadable part */ }
    }
    const html = pagesArchivesToHtml(archives);
    if (html) return html;
  }
  // Pages 5.0–5.2 kept the archives in an inner Index.zip
  const inner = zip.file(/Index\.zip$/i)[0];
  if (inner) {
    const JSZip = (await import('jszip')).default;
    return readPagesZip(await JSZip.loadAsync(await inner.async('uint8array')));
  }
  const xmlFile = zip.file(/(^|\/)index\.xml$/i)[0];
  if (xmlFile) return pagesXmlToHtml(await xmlFile.async('string'));
  const gz = zip.file(/(^|\/)index\.xml\.gz$/i)[0];
  if (gz && typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([await gz.async('uint8array')]).stream().pipeThrough(new DecompressionStream('gzip'));
    return pagesXmlToHtml(await new Response(stream).text());
  }
  throw new Error('No text was found in this Pages file.');
}
