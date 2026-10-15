import test from 'node:test';
import assert from 'node:assert/strict';
import { snappyDecompress, iwaDecompress, iwaArchives, pagesArchivesToHtml, pagesXmlToHtml, pbDecode, blockFor } from '../src/import/pages.js';

// ---- tiny encoders to build Pages-like files by hand ----
const enc = new TextEncoder();
const vint = (n) => { const o = []; do { let b = n % 128; n = Math.floor(n / 128); if (n) b |= 128; o.push(b); } while (n); return o; };
const cat = (...a) => Uint8Array.from(a.flatMap((x) => [...x]));
const fv = (no, v) => cat(vint(no * 8), vint(v));
const fb = (no, bytes) => cat(vint(no * 8 + 2), vint(bytes.length), bytes);
const fs = (no, s) => fb(no, enc.encode(s));
const ref = (no, id) => fb(no, fv(1, id));
const tableOf = (no, entries) => fb(no, cat(...entries.map(([at, id]) => fb(1, cat(fv(1, at), ref(2, id))))));
// Snappy: a literal, then a copy of the previous 4 bytes (exercises both paths)
const snappy = (bytes) => {
  const n = bytes.length - 1;
  const tag = n < 60 ? [n << 2] : n < 256 ? [60 << 2, n] : [61 << 2, n & 255, n >> 8];
  return cat(vint(bytes.length), tag, bytes);
};
const frame = (raw) => { const c = snappy(raw); return cat([0, c.length & 255, (c.length >> 8) & 255, (c.length >> 16) & 255], c); };
const archive = (id, type, data) => { const info = cat(fv(1, id), fb(2, cat(fv(1, type), fv(3, data.length)))); return cat(vint(info.length), info, data); };

test('snappy copies and literals', () => {
  // "abcdabcdabcd": literal "abcd" then a 1-byte-offset copy of 8 bytes at offset 4
  const src = Uint8Array.from([12, (3 << 2), 97, 98, 99, 100, 1 | ((8 - 4) << 2), 4]);
  assert.equal(new TextDecoder().decode(snappyDecompress(src)), 'abcdabcdabcd');
});

test('a Pages document: headings, italics, bold, attachments and body vs text boxes', () => {
  const text = 'Chapter One\nIt was a dark night.\nShe said nothing\uFFFC.\n';
  const storage = cat(fv(1, 0), fs(3, text), tableOf(5, [[0, 10], [12, 11]]), tableOf(8, [[12, 20], [20, 0], [42, 21], [49, 0]]));
  const textbox = cat(fv(1, 3), fs(3, 'A caption in a text box'));
  const style = (name, ident, props) => cat(fb(1, cat(fs(1, name), fs(2, ident))), props ? fb(11, props) : new Uint8Array());
  const stream = cat(
    archive(1, 2001, storage), archive(2, 2001, textbox),
    archive(10, 2022, style('Heading', 'paragraph-style-heading')), archive(11, 2022, style('Body', 'paragraph-style-body')),
    archive(20, 2021, style('', '', fv(2, 1))), archive(21, 2021, style('', '', fv(1, 1))),
  );
  const archives = iwaArchives(iwaDecompress(frame(stream)));
  assert.equal(archives.length, 6);
  assert.equal(pbDecode(archives[0].data)[3].length, 1);
  const html = pagesArchivesToHtml(archives);
  assert.equal(html, '<h1>Chapter One</h1><p><em>It was a</em> dark night.</p><p>She said <strong>nothing</strong>.</p>');
  assert.ok(!html.includes('caption'), 'text boxes are left out when there is body text');
});

test('style names map to Booky blocks', () => {
  assert.equal(blockFor({ name: 'Title' }), 'h1');
  assert.equal(blockFor({ name: 'Heading 2' }), 'h2');
  assert.equal(blockFor({ ident: 'paragraph-style-subtitle' }), 'p.ps-subtitle');
  assert.equal(blockFor({ name: 'Quote' }), 'blockquote');
  assert.equal(blockFor({ name: 'Body' }), 'p');
  assert.equal(blockFor(null), 'p');
});

test('Pages 09 XML', () => {
  const xml = '<sf:text-body><sf:p sf:style="Heading 1">The Storm</sf:p><sf:p sf:style="Body">Rain &amp; wind<sf:br/>all night.</sf:p><sf:p sf:style="Body"> </sf:p></sf:text-body>';
  assert.equal(pagesXmlToHtml(xml), '<h1>The Storm</h1><p>Rain &amp; wind<br>all night.</p>');
});
