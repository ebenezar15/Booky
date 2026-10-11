// Settings → Online sharing: connect Booky to the author's Supabase project.
import { h, btn, icon, field, input, toast, clear, add } from './dom.js';
import { state } from '../core/store.js';
import { saveConnection, testConnection, sendCode, verifyCode, signOut, cloudConfigured, cloudUser, DEFAULT_VIEWER, DEFAULT_PROJECT } from '../share/cloud.js';
import setupSql from '../../supabase/migrations/20261011000000_booky_review_sharing.sql?raw';

export function cloudSettingsPanel() {
  const c = state.app.cloud || {};
  let url = c.url || DEFAULT_PROJECT.url, anonKey = c.anonKey || DEFAULT_PROJECT.anonKey, viewer = c.viewerUrl || '';
  const status = h('div');
  const account = h('div');
  const showStatus = (kind, msg) => { clear(status); add(status, h(`div.notice${kind === 'error' ? '.notice-error' : ''}`, icon(kind === 'error' ? 'triangle-alert' : 'circle-check', 16), h('span', msg))); };

  const drawAccount = () => {
    clear(account);
    if (!cloudConfigured()) { add(account, h('p.muted.small', 'Save the connection first.')); return; }
    const u = cloudUser();
    if (u) {
      add(account, h('div.row', icon('circle-check', 16), h('span.grow', 'Signed in as ', h('b', u.email)), btn('Sign out', { icon: 'log-out', cls: 'btn-sm', kind: 'ghost', onClick: () => { signOut(); drawAccount(); } })));
      return;
    }
    let email = state.app.authorEmail || '', code = '';
    const codeRow = h('div.row', { style: { display: 'none', alignItems: 'flex-end', gap: '8px' } },
      field('Code from the email', input('', (v) => { code = v; }, { inputmode: 'numeric', placeholder: '123456', autocomplete: 'one-time-code' })),
      btn('Sign in', { kind: 'primary', icon: 'log-in', onClick: async () => {
        try { await verifyCode(email, code); toast('Signed in', 'success'); drawAccount(); } catch (e) { toast(e.message, 'error', 6000); }
      } }));
    add(account,
      h('div.row', { style: { alignItems: 'flex-end', gap: '8px' } },
        field('Your email', input(email, (v) => { email = v; }, { type: 'email', placeholder: 'you@example.com' })),
        btn('Email me a code', { icon: 'send', onClick: async () => {
          try { await sendCode(email); codeRow.style.display = 'flex'; toast('Code sent — check your inbox', 'success'); } catch (e) { toast(e.message, 'error', 6000); }
        } })),
      codeRow);
  };

  const steps = [
    ['1', 'Create the tables', h('span', 'If your Supabase project is linked to this GitHub repository, the tables are created automatically from ', h('code', 'supabase/migrations'), ' when the branch is merged. Otherwise open Supabase → SQL Editor, paste the setup SQL and click Run.')],
    ['2', 'Turn on email codes', h('span', 'Supabase → Authentication → Emails → “Magic Link” template: add ', h('code', '{{ .Token }}'), ' so emails contain a 6-digit code. For reviewers outside your team, set up custom SMTP (Authentication → Emails → SMTP) — the built-in sender only emails your project’s team members.')],
    ['3', 'Allow the review page', h('span', 'Authentication → URL Configuration → add ', h('code', viewer || DEFAULT_VIEWER), ' to Redirect URLs.')],
    ['4', 'Connect & sign in', h('span', 'Paste the Project URL and the anon / publishable key from Project Settings → API (never the service-role or secret key).')],
  ];

  const panel = h('div.col', { style: { gap: '12px' } },
    h('p.muted', 'Share a review link instead of a file. Reviewers sign in with the invited email (they get a code), enter the passcode, and their comments come straight back to you. The book and comments are encrypted on your computer — Supabase only stores scrambled data.'),
    h('div.col', { style: { gap: '8px' } }, steps.map(([n, t, d]) => h('div.row', { style: { alignItems: 'flex-start', gap: '10px' } }, h('span.badge', n), h('div', h('b', t), h('div.small.muted', d))))),
    h('div.row', { style: { gap: '8px', flexWrap: 'wrap' } },
      btn('Copy setup SQL', { icon: 'copy', cls: 'btn-sm', onClick: () => navigator.clipboard?.writeText(setupSql).then(() => toast('Setup SQL copied — paste it in Supabase → SQL Editor', 'success', 4000)) }),
      h('details', h('summary.small', 'Show SQL'), h('pre.small', { style: { maxHeight: '200px', overflow: 'auto', whiteSpace: 'pre-wrap' } }, setupSql))),
    field('Supabase project URL', input(url, (v) => { url = v; }, { placeholder: 'https://abcdefgh.supabase.co' })),
    field('Anon / publishable key', input(anonKey, (v) => { anonKey = v; }, { placeholder: 'eyJhbGciOi… or sb_publishable_…', autocomplete: 'off' }), 'This key is public by design — your data is protected by row level security.'),
    field('Review page address', input(viewer, (v) => { viewer = v; }, { placeholder: DEFAULT_VIEWER }), 'Where review.html is hosted. The included GitHub Pages workflow publishes it at the default address.'),
    h('div.row', { style: { gap: '8px' } },
      btn('Save & test connection', { kind: 'primary', icon: 'database', onClick: async () => {
        if (/service_role|sb_secret_/.test(anonKey) || /"role"\s*:\s*"service_role"/.test(atobSafe(anonKey.split('.')[1]))) { showStatus('error', 'That is a secret (service-role) key. Use the anon / publishable key instead.'); return; }
        saveConnection({ url, anonKey, viewerUrl: viewer });
        try { showStatus('ok', await testConnection()); } catch (e) { showStatus('error', e.message); }
        drawAccount();
      } })),
    status,
    h('div.section-title', 'Your account'),
    account,
  );
  drawAccount();
  return panel;

  function atobSafe(s) { try { return atob((s || '').replace(/-/g, '+').replace(/_/g, '/')); } catch { return ''; } }
}
