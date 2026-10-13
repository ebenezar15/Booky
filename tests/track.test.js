import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptHtml, rejectHtml, finalHtml, listChanges, applyParagraphChanges, readWordParagraphs, readWordComments, placeParagraphs, changeSpan, countChanges } from '../src/core/track.js';

const ins = (id, t, a = 'Ed') => changeSpan('ins', { id, author: a, at: 1 }, t);
const del = (id, t, a = 'Ed') => changeSpan('del', { id, author: a, at: 1 }, t);

test('accept and reject, all or one', () => {
  const html = `<p>The ${del('a', 'old')}${ins('a', 'new')} lamp ${ins('b', '<strong>very</strong> ')}bright.</p>`;
  assert.equal(acceptHtml(html), '<p>The new lamp <strong>very</strong> bright.</p>');
  assert.equal(rejectHtml(html), '<p>The old lamp bright.</p>');
  assert.equal(acceptHtml(html, 'b'), `<p>The ${del('a', 'old')}${ins('a', 'new')} lamp <strong>very</strong> bright.</p>`);
  assert.equal(finalHtml('<p>plain</p>'), '<p>plain</p>');
  // other spans inside and around are kept
  assert.equal(acceptHtml(`<p><span class="cs-foreign" data-cs="foreign">${del('c', 'x')}y</span></p>`), '<p><span class="cs-foreign" data-cs="foreign">y</span></p>');
});

test('list changes', () => {
  const html = `<p>A ${del('a', 'old')}${ins('a', 'new')} and ${ins('b', 'more')}</p><p>${ins('b', ' text')}</p>`;
  assert.deepEqual(listChanges(html).map((c) => `${c.id}:${c.kind}:${c.text}`), ['a:del:old', 'a:ins:new', 'b:ins:more text']);
  assert.equal(countChanges([{ content: html }, { content: '<p>x</p>' }]), 3);
});

test('apply Word changes to a paragraph', () => {
  const ch = { id: 'w1', author: 'Ed', at: 5 };
  // replace "old" with "new", crossing no tags
  assert.equal(applyParagraphChanges('<p>The old lamp.</p>', [{ ...ch, offset: 4, del: 'old', ins: 'new' }]), `<p>The ${del('w1', 'old').replace('data-at="1"', 'data-at="5"')}${ins('w1', 'new').replace('data-at="1"', 'data-at="5"')} lamp.</p>`);
  // pure insertion, and a deletion crossing an inline tag
  const r = applyParagraphChanges('<p>The <em>old</em> lamp.</p>', [{ ...ch, offset: 4, del: 'old lamp', ins: '' }, { ...ch, id: 'w2', offset: 0, del: '', ins: 'See: ' }]);
  assert.equal(acceptHtml(r), '<p>See: The <em></em>.</p>');
  assert.equal(rejectHtml(r), '<p>The <em>old</em> lamp.</p>');
  assert.equal(acceptHtml(applyParagraphChanges('<p>End</p>', [{ ...ch, offset: 3, del: '', ins: '!' }])), '<p>End!</p>');
});

const W = (body) => `<w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`;
test('read a Word document with revisions and comments', () => {
  const xml = W(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:bookmarkStart w:id="1" w:name="bk_el_1"/><w:bookmarkEnd w:id="1"/><w:r><w:t>Chapter</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">The </w:t></w:r><w:del w:id="5" w:author="Ed" w:date="2026-01-02T00:00:00Z"><w:r><w:delText>old</w:delText></w:r></w:del><w:ins w:id="6" w:author="Ed" w:date="2026-01-02T00:00:00Z"><w:r><w:t>new</w:t></w:r></w:ins><w:r><w:t xml:space="preserve"> lamp </w:t></w:r><w:commentRangeStart w:id="0"/><w:r><w:t>burned</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r><w:r><w:t>.</w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> XE "lamp" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`);
  const paras = readWordParagraphs(xml);
  assert.equal(paras.length, 2);
  assert.deepEqual(paras[0].bookmarks, ['bk_el_1']);
  assert.equal(paras[1].original, 'The old lamp burned.');
  assert.deepEqual(paras[1].changes.map((c) => [c.offset, c.del, c.ins, c.author]), [[4, 'old', 'new', 'Ed']]);
  assert.deepEqual(paras[1].comments, [{ id: '0', start: 13, end: 19 }]);
  const comments = readWordComments('<w:comments><w:comment w:id="0" w:author="Ed" w:date="2026-01-02T00:00:00Z"><w:p><w:r><w:t>Too strong?</w:t></w:r></w:p></w:comment></w:comments>');
  assert.equal(comments.get('0').text, 'Too strong?');
  const { placed, unplaced } = placeParagraphs(paras, [{ elId: 'el_1', title: 'Chapter', blocks: ['Intro.', 'The old lamp burned.'] }]);
  assert.deepEqual(placed.map((p) => [p.elId, p.block]), [['el_1', 1]]);
  assert.equal(unplaced.length, 0);
});

test('paragraphs are found by text when there are no bookmarks', () => {
  const paras = readWordParagraphs(W('<w:p><w:r><w:t>Second</w:t></w:r><w:ins w:author="A"><w:r><w:t>!</w:t></w:r></w:ins></w:p><w:p><w:r><w:t>Changed by hand</w:t></w:r><w:ins w:author="A"><w:r><w:t>?</w:t></w:r></w:ins></w:p>'));
  const r = placeParagraphs(paras, [{ elId: 'a', title: 'A', blocks: ['First'] }, { elId: 'b', title: 'B', blocks: ['Second'] }]);
  assert.deepEqual(r.placed.map((p) => p.elId), ['b']);
  assert.equal(r.unplaced.length, 1);
});

test('old books have track changes off', async () => {
  const { normalizeBook } = await import('../src/core/model.js');
  assert.equal(!!normalizeBook({ id: 'x', meta: {}, elements: [] }).settings.trackChanges, false);
});
