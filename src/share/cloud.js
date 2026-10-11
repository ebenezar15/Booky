// Online review sharing through a Supabase project (free plan is enough). No accounts, no emails:
//  · the review copy is encrypted on the author's computer with the reviewer's email + passcode;
//  · two random secrets protect it on the server — the owner secret stays with the author,
//    the write secret travels inside the encrypted copy so only the real reviewer can send comments.
// See supabase/migrations/*_booky_sharing_no_signin.sql for the server side.
import { state, setApp } from '../core/store.js';
import { registerTransport } from './transport.js';
import { decryptJson, normEmail } from './crypto.js';

export const DEFAULT_VIEWER = 'https://ebenezar15.github.io/Booky/review.html';
// The author's Supabase project. The publishable key is public by design; the database only allows the booky_* functions.
export const DEFAULT_PROJECT = { url: 'https://ptoletclsllykfpzlyhi.supabase.co', anonKey: 'sb_publishable_ELwv4_uL1I19yStlBdVOjA_-96K7jLT' };
export const SCHEMA_VERSION = 2;

const cfg = () => { const c = state.app.cloud || {}; return { ...c, url: c.url || DEFAULT_PROJECT.url, anonKey: c.anonKey || DEFAULT_PROJECT.anonKey }; };
const setCfg = (patch) => setApp({ cloud: { ...cfg(), ...patch } });
// Accept the project URL in any common form, e.g. with /rest/v1/ copied from the dashboard.
export const normalizeUrl = (u) => String(u || '').trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/i, '');
const base = () => normalizeUrl(cfg().url);

export const cloudConfigured = () => !!(base() && cfg().anonKey);
export const viewerUrl = () => (cfg().viewerUrl || DEFAULT_VIEWER).trim();

/** Random secret, 43 URL-safe characters (256 bits). */
export function makeSecret() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function rpc(name, args = {}) {
  if (!cloudConfigured()) throw new Error('Add your Supabase project in Settings → Online sharing.');
  let res;
  try {
    res = await fetch(`${base()}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: cfg().anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(args),
    });
  } catch {
    throw new Error('Could not reach Supabase. Check your internet connection. (Free Supabase projects pause after a week without use — open supabase.com and press “Restore project”.)');
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.message || data?.msg || data?.error || res.statusText || `error ${res.status}`;
    if (res.status === 404 || /Could not find the function|schema cache/i.test(msg)) throw new Error('Online sharing isn’t set up in Supabase yet. Settings → Online sharing → Copy setup SQL, then run it in Supabase → SQL Editor.');
    if (/Invalid API key|No API key/i.test(msg)) throw new Error('Supabase rejected the key. Use the project’s publishable (or anon) key.');
    throw new Error(msg);
  }
  return data;
}

export function saveConnection({ url, anonKey, viewerUrl: v }) {
  setCfg({ url: normalizeUrl(url), anonKey: (anonKey || '').trim(), viewerUrl: (v || '').trim() });
}

/** Checks the project, key and setup. Returns a short status string. */
export async function testConnection() {
  const v = await rpc('booky_version');
  if (v < SCHEMA_VERSION) throw new Error('Your Supabase setup is out of date — run the setup SQL again.');
  return 'Connected — online sharing is ready.';
}

/** Upload an encrypted review copy. Returns { id, url, ownerSecret }. writeSecret must already be inside the encrypted box. */
export async function publishCopy({ book, box, expiresDays, writeSecret }) {
  const ownerSecret = makeSecret();
  const id = await rpc('booky_create_copy', {
    p_box: box, p_title: book.meta.title || '', p_owner_secret: ownerSecret, p_write_secret: writeSecret,
    p_expires_at: expiresDays ? new Date(Date.now() + expiresDays * 86400000).toISOString() : null,
  });
  return { id, url: shareLink(id), ownerSecret };
}

export function shareLink(id) {
  const q = new URLSearchParams({ c: id, u: base(), a: cfg().anonKey });
  return `${viewerUrl()}?${q}`;
}

export async function revokeCopy(id, ownerSecret) {
  return rpc('booky_delete_copy', { p_id: id, p_owner_secret: ownerSecret });
}

/** Fetch and decrypt comments reviewers sent online for this book. Returns review-file payloads not seen before. */
export async function pullComments(book, reviewers) {
  const seen = new Set(book.reviews.pulled || []);
  const out = [];
  for (const r of reviewers) {
    for (const copy of r.copies || []) {
      if (!copy.cloudId || !copy.ownerSecret || copy.revoked) continue;
      const rows = await rpc('booky_get_comments', { p_id: copy.cloudId, p_owner_secret: copy.ownerSecret });
      for (const row of rows || []) {
        if (seen.has(row.id)) continue;
        try { out.push({ id: row.id, data: await decryptJson(row.box, normEmail(r.email), copy.passcode) }); } catch { /* not ours */ }
      }
    }
  }
  return out;
}

registerTransport({ id: 'supabase', label: 'Online link (Supabase)', online: true, publish: publishCopy, pull: pullComments });
