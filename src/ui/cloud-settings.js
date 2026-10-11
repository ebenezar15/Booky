// Settings → Online sharing: connect Booky to a Supabase project (the free plan is enough).
import { h, btn, icon, field, input, toast, clear, add } from './dom.js';
import { state } from '../core/store.js';
import { saveConnection, testConnection, DEFAULT_VIEWER, DEFAULT_PROJECT } from '../share/cloud.js';
import setupSql from '../../supabase/migrations/20261011130000_booky_sharing_no_signin.sql?raw';

export function cloudSettingsPanel() {
  const c = state.app.cloud || {};
  let url = c.url || DEFAULT_PROJECT.url, anonKey = c.anonKey || DEFAULT_PROJECT.anonKey, viewer = c.viewerUrl || '';
  const status = h('div');
  const showStatus = (kind, msg) => { clear(status); add(status, h(`div.notice${kind === 'error' ? '.notice-error' : ''}`, icon(kind === 'error' ? 'triangle-alert' : 'circle-check', 16), h('span', msg))); };
  const atobSafe = (s) => { try { return atob((s || '').replace(/-/g, '+').replace(/_/g, '/')); } catch { return ''; } };

  const steps = [
    ['1', 'Run the setup SQL once', h('span', 'Click “Copy setup SQL”, open your project at supabase.com → SQL Editor → New query, paste and click Run. It is safe to run again.')],
    ['2', 'Check the connection', h('span', 'Click “Save & test connection” below. That’s it — no sign-in, no email settings, nothing to pay.')],
  ];

  return h('div.col', { style: { gap: '12px' } },
    h('p.muted', 'Share a review link instead of a file. Reviewers open the link, unlock the book with their email + passcode, and their comments come straight back to you. Everything is encrypted on your computer first — Supabase only stores scrambled data. Uses only Supabase’s free plan.'),
    h('div.col', { style: { gap: '8px' } }, steps.map(([n, t, d]) => h('div.row', { style: { alignItems: 'flex-start', gap: '10px' } }, h('span.badge', n), h('div', h('b', t), h('div.small.muted', d))))),
    h('div.row', { style: { gap: '8px', flexWrap: 'wrap' } },
      btn('Copy setup SQL', { icon: 'copy', cls: 'btn-sm', kind: 'primary', onClick: () => navigator.clipboard?.writeText(setupSql).then(() => toast('Setup SQL copied — paste it in Supabase → SQL Editor and click Run', 'success', 5000)) }),
      h('details', h('summary.small', 'Show SQL'), h('pre.small', { style: { maxHeight: '200px', overflow: 'auto', whiteSpace: 'pre-wrap' } }, setupSql))),
    field('Supabase project URL', input(url, (v) => { url = v; }, { placeholder: 'https://abcdefgh.supabase.co' })),
    field('Publishable (anon) key', input(anonKey, (v) => { anonKey = v; }, { placeholder: 'sb_publishable_… or eyJhbGciOi…', autocomplete: 'off' }), 'Public by design. Never paste the secret or service-role key here.'),
    field('Review page address', input(viewer, (v) => { viewer = v; }, { placeholder: DEFAULT_VIEWER }), 'Where review.html is published (GitHub Pages of this repository by default).'),
    h('div.row', { style: { gap: '8px' } },
      btn('Save & test connection', { kind: 'primary', icon: 'database', onClick: async () => {
        if (/service_role|sb_secret_/.test(anonKey) || /"role"\s*:\s*"service_role"/.test(atobSafe(anonKey.split('.')[1]))) { showStatus('error', 'That is a secret key. Use the publishable (anon) key instead.'); return; }
        saveConnection({ url, anonKey, viewerUrl: viewer });
        showStatus('ok', 'Checking…');
        try { showStatus('ok', await testConnection()); } catch (e) { showStatus('error', e.message); }
      } })),
    status,
    h('p.small.muted', 'Free-plan note: Supabase pauses a project after about a week with no activity. Booky’s GitHub workflow pings it every few days to keep it awake; if it ever pauses, open supabase.com and click “Restore project” (free).'),
  );
}
