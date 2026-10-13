import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIsbn, normalizeIsbn, isbn10to13, ean13Modules, ean5Modules, ean5Check, priceAddon, isbnFindings, formatIsbn13 } from '../src/core/isbn.js';

test('ISBN-13 and ISBN-10 validation, conversion and formatting', () => {
  assert.equal(normalizeIsbn('ISBN 978-0-306-40615-7'), '9780306406157');
  const a = parseIsbn('978-0-306-40615-7');
  assert.equal(a.ok, true);
  assert.equal(a.formatted, '978-0-306-40615-7'); // the author's valid hyphenation is kept
  assert.equal(parseIsbn('9780306406157').formatted, '978-030640615-7');
  assert.equal(parseIsbn('978-0-306-40615-8').ok, false);
  assert.match(parseIsbn('978-0-306-40615-8').message, /check digit should be 7/);
  const b = parseIsbn('0-306-40615-2');
  assert.equal(b.ok, true);
  assert.equal(b.isbn13, '9780306406157');
  assert.equal(isbn10to13('080442957X'), '9780804429573');
  assert.equal(parseIsbn('080442957X').ok, true);
  assert.equal(parseIsbn('12345').ok, false);
  assert.equal(parseIsbn('').empty, true);
  assert.equal(parseIsbn('1234567890123').ok, false); // must start with 978/979
  assert.equal(formatIsbn13('9791000000008'), '979-100000000-8');
});

test('duplicate ISBNs across formats are flagged', () => {
  const f = isbnFindings({ isbnPrint: '978-0-306-40615-7', isbnEbook: '9780306406157', isbnHardcover: '' });
  assert.ok(f.some((x) => x.ok === 'warn' && /print and ebook/.test(x.text)));
  const g = isbnFindings({ isbnPrint: '9780306406157', isbnHardcover: '978 0 306 40615 7' });
  assert.ok(g.some((x) => /paperback and hardcover/.test(x.text)));
  assert.ok(isbnFindings({ isbnPrint: '9780306406158' }).some((x) => x.ok === false));
});

test('EAN-13 modules match an independent encoder (python-barcode)', () => {
  assert.equal(ean13Modules('9780306406157'), '10101110110001001010011101111010100111010111101010101110011100101010000110011010011101000100101');
  assert.equal(ean13Modules('400638133393'), '10100011010100111010111101111010001001011001101010100001010000101000010111010010000101100110101');
  assert.equal(ean13Modules('9791000000008'), '10101110110010111011001100011010100111000110101010111001011100101110010111001011100101001000101');
  assert.equal(ean13Modules('9780306406157').length, 95);
  assert.throws(() => ean13Modules('9780306406158'));
});

test('EAN-5 price add-on', () => {
  assert.equal(ean5Check('52495'), 1);
  assert.equal(ean5Check('90000'), 7);
  const m = ean5Modules('51499');
  assert.equal(m.length, 47);
  assert.ok(m.startsWith('1011'));
  // 9 0 0 0 0 with parity LGLGL (checksum 7)
  assert.equal(ean5Modules('90000'), '1011' + '0001011' + '01' + '0100111' + '01' + '0001101' + '01' + '0100111' + '01' + '0001101');
  assert.equal(priceAddon('$14.99'), '51499');
  assert.equal(priceAddon('US$ 9.5'), '50950');
  assert.equal(priceAddon(''), '90000');
});
