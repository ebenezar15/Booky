// ISBN checking and formatting, and EAN-13 / EAN-5 barcode encoding (no dependencies).

/** Strip spaces, hyphens and other separators; keep digits and a final X. */
export function normalizeIsbn(s) {
  return String(s || '').toUpperCase().replace(/^ISBN(-1[03])?:?\s*/, '').replace(/[^0-9X]/g, '');
}

export function isbn10Check(nine) {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * +nine[i];
  const c = (11 - (sum % 11)) % 11;
  return c === 10 ? 'X' : String(c);
}

export function ean13Check(twelve) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += +twelve[i] * (i % 2 ? 3 : 1);
  return String((10 - (sum % 10)) % 10);
}

export const isValidIsbn10 = (s) => /^\d{9}[\dX]$/.test(s) && isbn10Check(s.slice(0, 9)) === s[9];
export const isValidIsbn13 = (s) => /^97[89]\d{10}$/.test(s) && ean13Check(s.slice(0, 12)) === s[12];

export function isbn10to13(s10) {
  const body = '978' + s10.slice(0, 9);
  return body + ean13Check(body);
}

/** Hyphenate an ISBN-13. Keeps the author's own hyphenation when it is a valid 5-part split; otherwise 978-XXXXXXXXX-X. */
export function formatIsbn13(isbn13, original = '') {
  const parts = String(original).trim().split(/[-\s]+/).filter(Boolean);
  if (parts.length === 5 && parts.join('') === isbn13 && /^97[89]$/.test(parts[0])) return parts.join('-');
  return `${isbn13.slice(0, 3)}-${isbn13.slice(3, 12)}-${isbn13[12]}`;
}

/**
 * Check what the author typed.
 * @returns { empty, ok, isbn13, formatted, message } — message explains any problem or conversion.
 */
export function parseIsbn(input) {
  const raw = String(input || '').trim();
  if (!raw) return { empty: true, ok: false, message: '' };
  const n = normalizeIsbn(raw);
  if (n.length === 10) {
    if (!/^\d{9}[\dX]$/.test(n)) return { ok: false, message: 'An ISBN-10 has 9 digits and a final digit or X.' };
    if (!isValidIsbn10(n)) return { ok: false, message: `The check digit should be ${isbn10Check(n.slice(0, 9))} — please check for a typo.` };
    const isbn13 = isbn10to13(n);
    return { ok: true, isbn13, formatted: formatIsbn13(isbn13), message: `ISBN-10 is valid. Printers and stores use the ISBN-13: ${formatIsbn13(isbn13)}.` };
  }
  if (n.length === 13) {
    if (!/^\d{13}$/.test(n)) return { ok: false, message: 'An ISBN-13 has 13 digits.' };
    if (!/^97[89]/.test(n)) return { ok: false, message: 'An ISBN-13 starts with 978 or 979.' };
    if (!isValidIsbn13(n)) return { ok: false, message: `The check digit should be ${ean13Check(n.slice(0, 12))} — please check for a typo.` };
    return { ok: true, isbn13: n, formatted: formatIsbn13(n, raw), message: 'Valid ISBN-13.' };
  }
  return { ok: false, message: `An ISBN has 10 or 13 digits — this has ${n.replace(/X/g, '').length}.` };
}

/** Findings for a book's ISBNs: [{ ok: true | 'warn' | false, field, text }]. */
export function isbnFindings(meta) {
  const out = [];
  const fields = [['isbnPrint', 'Paperback ISBN'], ['isbnHardcover', 'Hardcover ISBN'], ['isbnEbook', 'Ebook ISBN']];
  const parsed = {};
  for (const [k, label] of fields) {
    const p = parseIsbn(meta[k]);
    parsed[k] = p;
    if (!p.empty && !p.ok) out.push({ ok: false, field: k, text: `${label}: ${p.message}` });
  }
  const same = (a, b) => parsed[a].ok && parsed[b].ok && parsed[a].isbn13 === parsed[b].isbn13;
  if (same('isbnPrint', 'isbnEbook')) out.push({ ok: 'warn', field: 'isbnEbook', text: 'The print and ebook ISBNs are the same. Each format needs its own ISBN (or leave the ebook one empty).' });
  if (same('isbnPrint', 'isbnHardcover')) out.push({ ok: 'warn', field: 'isbnHardcover', text: 'The paperback and hardcover share an ISBN. Each edition needs its own.' });
  if (same('isbnHardcover', 'isbnEbook')) out.push({ ok: 'warn', field: 'isbnEbook', text: 'The hardcover and ebook ISBNs are the same. Each format needs its own.' });
  return out;
}

// ---------- EAN-13 ----------
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((c) => [...c].map((b) => (b === '1' ? '0' : '1')).join(''));
const Gc = R.map((c) => [...c].reverse().join('')); // G code = R code reversed
const PARITY13 = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** EAN-13 as a string of 95 modules ('1' = bar). Accepts 12 or 13 digits. */
export function ean13Modules(code) {
  const digits = String(code).replace(/\D/g, '');
  if (!/^\d{12,13}$/.test(digits)) throw new Error('EAN-13 needs 12 or 13 digits');
  const d = digits.length === 12 ? digits + ean13Check(digits) : digits;
  if (ean13Check(d.slice(0, 12)) !== d[12]) throw new Error('Wrong EAN-13 check digit');
  const parity = PARITY13[+d[0]];
  let out = '101';
  for (let i = 1; i <= 6; i++) out += (parity[i - 1] === 'L' ? L : Gc)[+d[i]];
  out += '01010';
  for (let i = 7; i <= 12; i++) out += R[+d[i]];
  return out + '101';
}

// ---------- EAN-5 price add-on ----------
const PARITY5 = ['GGLLL', 'GLGLL', 'GLLGL', 'GLLLG', 'LGGLL', 'LLGGL', 'LLLGG', 'LGLGL', 'LGLLG', 'LLGLG'];
export function ean5Check(five) {
  const d = String(five).split('').map(Number);
  return ((d[0] + d[2] + d[4]) * 3 + (d[1] + d[3]) * 9) % 10;
}
/** EAN-5 add-on as 47 modules. */
export function ean5Modules(five) {
  if (!/^\d{5}$/.test(String(five))) throw new Error('The price add-on needs 5 digits');
  const parity = PARITY5[ean5Check(five)];
  let out = '1011';
  String(five).split('').forEach((c, i) => { if (i) out += '01'; out += (parity[i] === 'L' ? L : Gc)[+c]; });
  return out;
}

/** Price add-on code: 5 + amount in cents for US$ (e.g. 14.99 → 51499), 90000 = no price. */
export function priceAddon(price) {
  const m = String(price || '').match(/(\d+)(?:[.,](\d{1,2}))?/);
  if (!m) return '90000';
  const cents = +m[1] * 100 + +(m[2] || '0').padEnd(2, '0');
  if (!cents || cents > 9999) return '90000';
  return '5' + String(cents).padStart(4, '0');
}
