import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectIndexMarks, buildIndex, mergePageRanges, groupLetter, termCounts, parseXrefTarget, xrefResolves, collectXrefs } from '../src/core/index-gen.js';

const mk = (id, term, extra = '') => `<span data-type="index" data-id="${id}" data-term="${term}" ${extra}></span>`;

test('index marks are collected, grouped by letter and sorted for the language', () => {
  const els = [
    { id: 'a', content: `<p>${mk('1', 'apple')}Apples ${mk('2', 'Banana')} and ${mk('3', 'apple', 'data-sub="green"')} ${mk('4', 'Fruit', 'data-see="apple"')}</p>` },
    { id: 'b', content: `<p>${mk('5', 'Apple')} ${mk('6', '1984')} ${mk('7', 'Banana', 'data-see-also="Fruit"')}</p>` },
  ];
  const marks = collectIndexMarks(els);
  assert.equal(marks.length, 7);
  const idx = buildIndex(marks, 'en');
  assert.deepEqual(idx.map((g) => g.letter), ['#', 'A', 'B', 'F']);
  const apple = idx[1].entries[0];
  assert.deepEqual(apple.refs, ['1', '5']); // "apple" and "Apple" merge
  assert.equal(apple.subs[0].term, 'green');
  assert.deepEqual(idx[2].entries[0].seeAlso, ['Fruit']);
  assert.equal(idx[3].entries[0].see, 'apple');
  assert.deepEqual(idx[3].entries[0].refs, []);
  const counts = Object.fromEntries(termCounts(marks).map((t) => [t.term, t.count]));
  assert.deepEqual(counts, { 1984: 1, apple: 2, Apple: 1, Banana: 2, Fruit: 1 }); // the panel shows case variants so they can be merged
  assert.equal(termCounts(marks)[0].term, '1984');
});

test('Tamil terms are grouped by their first letter', () => {
  assert.equal(groupLetter('கடல்', 'ta'), 'க');
  assert.equal(groupLetter('éclair', 'fr'), 'É');
  assert.equal(groupLetter('42 things'), '#');
});

test('page numbers merge into ranges', () => {
  assert.equal(mergePageRanges(['12', '13', '14', '20', '20', 'ix', 'x', '3']), 'ix–x, 3, 12–14, 20');
  assert.equal(mergePageRanges(['5']), '5');
  assert.equal(mergePageRanges([]), '');
});

test('cross-reference targets and broken references', () => {
  const els = [{ id: 'c1', content: '<h2>The <em>Storm</em></h2><img src="x"><p>see <span data-type="xref" data-target="h:c1:The Storm" data-label="The Storm"></span></p>' }];
  assert.deepEqual(parseXrefTarget('h:c1:A: B'), { kind: 'heading', elId: 'c1', text: 'A: B' });
  assert.equal(xrefResolves(els, 'h:c1:The Storm'), true);
  assert.equal(xrefResolves(els, 'h:c1:Gone'), false);
  assert.equal(xrefResolves(els, 'f:c1:0'), true);
  assert.equal(xrefResolves(els, 'f:c1:1'), false);
  assert.equal(xrefResolves(els, 's:nope'), false);
  assert.equal(collectXrefs(els)[0].label, 'The Storm');
});

test('markAllInHtml marks whole words in text only, once', async () => {
  const { markAllInHtml } = await import('../src/core/index-gen.js');
  const r = markAllInHtml('<p>The lighthouse and <a href="lighthouse.html">Lighthouse</a>, lighthouses.</p>', 'lighthouse', 'Lighthouse');
  assert.equal(r.added, 2);
  assert.ok(r.html.includes('href="lighthouse.html"'));
  assert.ok(!/<span[^>]*><\/span>lighthouses/.test(r.html));
  const again = markAllInHtml(r.html, 'lighthouse', 'Lighthouse');
  assert.equal(again.added, 0);
});

test('xrefsToText keeps labels and drops index marks', async () => {
  const { xrefsToText } = await import('../src/core/index-gen.js');
  assert.equal(xrefsToText('<p>See <span data-type="xref" data-target="s:e1" data-label="Tom &amp; Jerry"></span>.<span data-type="index" data-term="x"></span></p>'), '<p>See Tom &amp; Jerry.</p>');
});
