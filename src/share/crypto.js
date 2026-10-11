// Encryption for review copies: AES-GCM with a key derived (PBKDF2-SHA256) from the
// reviewer's email + passcode. The same code runs inside the review file (see viewer-runtime.js).
export const KDF_ITERATIONS = 250000;

export const normEmail = (e) => String(e || '').trim().toLowerCase();

export function b64encode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function b64decode(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(email, passcode, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(`${normEmail(email)}\n${String(passcode).trim().toUpperCase()}`), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(obj, email, passcode) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(email, passcode, salt);
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: KDF_ITERATIONS, salt: b64encode(salt), iv: b64encode(iv), ct: b64encode(ct) };
}

export async function decryptJson(box, email, passcode) {
  const key = await deriveKey(email, passcode, b64decode(box.salt));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64decode(box.iv) }, key, b64decode(box.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

// Easy-to-read passcode without look-alike characters, e.g. "K7QM-29XD".
export function makePasscode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(8));
  const s = [...r].map((x) => chars[x % chars.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}
