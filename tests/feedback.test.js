import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureReviews, addReviewer, importReviewFile, orderedComments, locateQuote } from '../src/core/feedback.js';
import { encryptJson, decryptJson, makePasscode } from '../src/share/crypto.js';

const book = () => ({ id: 'bk1', elements: [{ id: 'a', section: 'body' }, { id: 'b', section: 'body' }, { id: 'f', section: 'front' }] });

test('locateQuote uses prefix/suffix to pick the right occurrence', () => {
  const text = 'The sea was calm. Later the sea was wild.';
  const r = locateQuote(text, { quote: 'the sea', prefix: 'Later ', suffix: ' was wild', offset: 0 });
  assert.equal(text.slice(r.start, r.end), 'the sea');
  assert.equal(r.start, 24);
});

test('import merges comments, keeps author status, gives each reviewer a colour', () => {
  const b = book();
  const r1 = addReviewer(b, { name: 'A', email: 'a@x.com' });
  const r2 = addReviewer(b, { name: 'B', email: 'b@x.com' });
  assert.notEqual(r1.color, r2.color);
  const file = { type: 'booky-review', bookId: 'bk1', roundId: 'r1', reviewer: { id: r1.id, name: 'A', email: 'a@x.com' },
    comments: [{ id: 'c1', elId: 'b', quote: 'x', offset: 5, type: 'comment', note: 'hi' }, { id: 'c2', elId: 'a', quote: 'y', offset: 1, type: 'suggestion', suggestion: 'z' }],
    overall: { rating: 4, text: 'Good' } };
  let res = importReviewFile(b, file);
  assert.equal(res.added, 2);
  ensureReviews(b).comments.find((c) => c.id === 'c1').status = 'resolved';
  res = importReviewFile(b, { ...file, comments: [{ ...file.comments[0], note: 'edited' }] });
  const R = ensureReviews(b);
  assert.equal(R.comments.length, 1, 'withdrawn open comment removed');
  assert.equal(R.comments[0].status, 'resolved', 'author status kept');
  assert.equal(R.comments[0].note, 'edited');
  assert.equal(R.overall[0].rating, 4);
  assert.throws(() => importReviewFile(b, { ...file, bookId: 'other' }));
});

test('comments are ordered front → body, then by position', () => {
  const b = book();
  const list = [{ elId: 'b', offset: 3 }, { elId: 'f', offset: 9 }, { elId: 'a', offset: 50 }, { elId: 'a', offset: 2 }];
  assert.deepEqual(orderedComments(b, list).map((c) => c.elId + c.offset), ['f9', 'a2', 'a50', 'b3']);
});

test('review copy encryption: only the right email + passcode opens it', async () => {
  const pass = makePasscode();
  const box = await encryptJson({ secret: 'chapter text' }, 'Reader@Example.com', pass);
  assert.ok(!JSON.stringify(box).includes('chapter text'));
  assert.equal((await decryptJson(box, 'reader@example.com ', pass.toLowerCase())).secret, 'chapter text');
  await assert.rejects(decryptJson(box, 'other@example.com', pass));
  await assert.rejects(decryptJson(box, 'reader@example.com', 'AAAA-BBBB'));
});
