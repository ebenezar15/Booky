// Online review sharing through the author's own Supabase project.
// Implements the transport interface from transport.js: publish · pull (invite = the email the author sends).
// Only encrypted boxes are uploaded; the passcode never leaves the author's computer.
import { state, setApp } from '../core/store.js';
import { registerTransport } from './transport.js';
import { decryptJson, normEmail } from './crypto.js';

export const DEFAULT_VIEWER = 'https://ebenezar15.github.io/Booky/review.html';
// The author's Supabase project. The publishable key is public by design (row level security protects the data).
export const DEFAULT_PROJECT = { url: 'https://ptoletclsllykfpzlyhi.supabase.co', anonKey: 'sb_publishable_ELwv4_uL1I19yStlBdVOjA_-96K7jLT' };

const cfg = () => { const c = state.app.cloud || {}; return { ...c, url: c.url || DEFAULT_PROJECT.url, anonKey: c.anonKey || DEFAULT_PROJECT.anonKey }; };
const setCfg = (patch) => setApp({ cloud: { ...cfg(), ...patch } });
const base = () => normalizeUrl(cfg().url);
// Accept the project URL in any common form, e.g. with /rest/v1/ copied from the dashboard.
export const normalizeUrl = (u) => String(u || '').trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/i, '');

export const cloudConfigured = () => !!(base() && cfg().anonKey);
export const cloudUser = () => (cfg().session?.email ? cfg().session : null);
export const viewerUrl = () => (cfg().viewerUrl || DEFAULT_VIEWER).trim();

async function call(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  if (!cloudConfigured()) throw new Error('Connect your Supabase project first (Settings → Online sharing).');
  const h = { apikey: cfg().anonKey, 'Content-Type': 'application/json', ...headers };
  if (auth) {
    const token = await accessToken();
    if (!token) throw new Error('Sign in to online sharing first (Settings → Online sharing).');
    h.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(base() + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Could not reach Supabase. Check the project URL and your internet connection.');
  }
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    const msg = data?.msg || data?.message || data?.error_description || data?.error || res.statusText;
    if (/relation .* does not exist|Could not find the table/i.test(msg)) throw new Error('The Booky tables are missing. Run the setup SQL (Settings → Online sharing → Database setup).');
    throw new Error(msg || `Supabase error ${res.status}`);
  }
  return data;
}

// ---------- auth (email one-time code) ----------
export async function sendCode(email) {
  await call('/auth/v1/otp', { method: 'POST', auth: false, body: { email: normEmail(email), create_user: true } });
}

export async function verifyCode(email, token) {
  const s = await call('/auth/v1/verify', { method: 'POST', auth: false, body: { type: 'email', email: normEmail(email), token: String(token).trim() } });
  setCfg({ session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + (s.expires_in || 3600) * 1000, email: s.user?.email || normEmail(email) } });
}

export function signOut() { setCfg({ session: null }); }

async function accessToken() {
  const s = cfg().session;
  if (!s) return null;
  if (Date.now() < s.expires_at - 60000) return s.access_token;
  try {
    const n = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: s.refresh_token } });
    setCfg({ session: { ...s, access_token: n.access_token, refresh_token: n.refresh_token, expires_at: Date.now() + (n.expires_in || 3600) * 1000 } });
    return n.access_token;
  } catch {
    setCfg({ session: null });
    return null;
  }
}

export function saveConnection({ url, anonKey, viewerUrl: v }) {
  setCfg({ url: normalizeUrl(url), anonKey: (anonKey || '').trim(), viewerUrl: (v || '').trim() });
}

/** Checks the URL, key and tables. Returns a short status string. */
export async function testConnection() {
  await call('/rest/v1/review_copies?select=id&limit=1', { auth: !!cloudUser() });
  return cloudUser() ? `Connected and signed in as ${cloudUser().email}.` : 'Connected — tables found. Sign in to start sharing.';
}

// ---------- publish / pull / revoke ----------
/** Upload an encrypted review copy. Returns { id, url } — the link to send the reviewer. */
export async function publishCopy({ book, reviewer, box, roundId, expiresDays }) {
  const [row] = await call('/rest/v1/review_copies', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: {
      book_id: book.id, round_id: roundId, reviewer_email: normEmail(reviewer.email), title: book.meta.title || '', author: book.meta.author || '',
      box, expires_at: expiresDays ? new Date(Date.now() + expiresDays * 86400000).toISOString() : null,
    },
  });
  return { id: row.id, url: shareLink(row.id) };
}

export function shareLink(id) {
  const q = new URLSearchParams({ c: id, u: base(), a: cfg().anonKey });
  return `${viewerUrl()}?${q}`;
}

export async function revokeCopy(id) {
  await call(`/rest/v1/review_copies?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: { revoked: true } });
}

/** Fetch and decrypt comments reviewers sent online for this book. Returns review-file payloads not seen before. */
export async function pullComments(book, reviewers) {
  const rows = await call(`/rest/v1/review_submissions?select=id,copy_id,box,created_at,review_copies!inner(book_id)&review_copies.book_id=eq.${encodeURIComponent(book.id)}&order=created_at.asc`);
  const seen = new Set(book.reviews.pulled || []);
  const out = [];
  for (const row of rows || []) {
    if (seen.has(row.id)) continue;
    const owner = reviewers.find((r) => (r.copies || []).some((c) => c.cloudId === row.copy_id));
    const copy = owner?.copies.find((c) => c.cloudId === row.copy_id);
    if (!copy) continue;
    try {
      out.push({ id: row.id, data: await decryptJson(row.box, owner.email, copy.passcode) });
    } catch { /* not decryptable with our passcode: ignore */ }
  }
  return out;
}

registerTransport({ id: 'supabase', label: 'Online link (your Supabase project)', online: true, publish: publishCopy, pull: pullComments });
