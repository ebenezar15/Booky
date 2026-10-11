// Feedback mode: invite reviewers with private review copies, collect their comments and
// work through every note in reading order until nothing is missed.
import { h, icon, btn, iconBtn, clear, add, field, input, textarea, select, segmented, modal, toast, confirmDialog, pickFile, downloadBlob, slugify, readAsText, timeAgo, color } from './dom.js';
import { state, on, touch, setApp } from '../core/store.js';
import { ensureReviews, addReviewer, importReviewFile, orderedComments, COMMENT_TYPES } from '../core/feedback.js';
import { displayTitle, escapeHtml } from '../core/model.js';
import { makePasscode } from '../share/crypto.js';
import { reviewerById, goToComment, setStatus, applySuggestion, goNext } from './feedback-actions.js';

const STATUS = { open: 'To do', resolved: 'Done', wontfix: 'Won’t fix' };
let lastTab = 'comments';
const filters = { reviewers: new Set(), types: new Set(), status: 'open', q: '' };

/** One comment, with every action needed to deal with it. */
export function commentCard(c, { compact = false, onChange } = {}) {
  const rev = reviewerById(c.reviewerId) || { name: 'Reviewer', color: '#888' };
  const el = state.book.elements.find((e) => e.id === c.elId);
  const t = COMMENT_TYPES[c.type] || COMMENT_TYPES.comment;
  const changed = () => onChange?.();
  const card = h(`div.fb-card.st-${c.status}`, { style: { '--rv': rev.color }, dataset: { id: c.id } },
    h('div.fb-head',
      h('span.fb-dot'), h('b', rev.name), h('span.fb-type', icon(t.icon, 12), t.label),
      h('span.grow'), !compact && el ? h('span.muted.small', displayTitle(state.book, el)) : null,
      c.status !== 'open' ? h('span.fb-status', STATUS[c.status]) : null),
    h('button.fb-quote', { type: 'button', title: 'Show in the manuscript', on: { click: () => goToComment(c) } },
      c.suggestion != null ? [h('s', c.quote), h('span.fb-arrow', ' → '), h('ins', c.suggestion || '(delete)')] : `“${c.quote.length > 240 ? c.quote.slice(0, 240) + '…' : c.quote}”`),
    c.note ? h('div.fb-note', c.note) : null,
    h('div.fb-actions',
      btn('Show in text', { icon: 'eye', cls: 'btn-sm', kind: 'ghost', onClick: () => goToComment(c) }),
      c.suggestion != null && c.status === 'open' ? btn('Apply edit', { icon: 'check', cls: 'btn-sm', onClick: () => { applySuggestion(c); setTimeout(changed, 600); } }) : null,
      c.status === 'open'
        ? [btn('Done', { icon: 'circle-check', cls: 'btn-sm', kind: 'primary', onClick: () => { setStatus(c, 'resolved'); changed(); } }),
          btn('Won’t fix', { cls: 'btn-sm', kind: 'ghost', onClick: () => { setStatus(c, 'wontfix'); changed(); } })]
        : btn('Reopen', { icon: 'rotate-ccw', cls: 'btn-sm', kind: 'ghost', onClick: () => { setStatus(c, 'open'); changed(); } }),
      h('span.grow'),
      iconBtn('pencil', 'Private note to yourself', () => {
        const ta = textarea(c.reply || '', (v) => { c.reply = v; touch('reviews'); }, { rows: 3, placeholder: 'e.g. Rewrite this paragraph after chapter 9' });
        const m = modal({ title: 'Your note', width: 440, body: field('Only you see this', ta), footer: [btn('Done', { kind: 'primary', onClick: () => { m.close(); changed(); } })] });
      }, { size: 15 })),
    c.reply ? h('div.fb-reply', icon('pencil', 12), ' ', c.reply) : null);
  return card;
}

export function renderFeedback(host) {
  const book = state.book;
  const R = ensureReviews(book);
  const wrap = h('section.plan.feedback');
  host.appendChild(wrap);
  const body = h('div');
  let tab = lastTab;
  const head = h('div.plan-head',
    h('h2', 'Feedback'),
    segmented([['comments', 'Comments'], ['reviewers', 'Reviewers & sharing'], ['overall', 'Overall reviews']], tab, (v) => { tab = lastTab = v; draw(); }),
    h('span.grow'),
    btn('Import comments', { icon: 'file-up', onClick: () => importFiles() }),
    btn('Invite reviewer', { icon: 'plus', kind: 'primary', onClick: () => reviewerDialog() }));
  add(wrap, head, body);

  // Drag & drop .bookyreview files anywhere on this screen
  wrap.addEventListener('dragover', (e) => { e.preventDefault(); wrap.classList.add('drop'); });
  wrap.addEventListener('dragleave', (e) => { if (e.target === wrap) wrap.classList.remove('drop'); });
  wrap.addEventListener('drop', (e) => { e.preventDefault(); wrap.classList.remove('drop'); importFiles([...e.dataTransfer.files]); });

  function draw() {
    clear(body);
    if (tab === 'comments') drawComments();
    if (tab === 'reviewers') drawReviewers();
    if (tab === 'overall') drawOverall();
  }

  async function importFiles(files) {
    files = files || (await pickFile('.bookyreview,.json', { multiple: true }));
    if (!files?.length) return;
    const msgs = [];
    for (const f of files) {
      try {
        const res = importReviewFile(book, JSON.parse(await readAsText(f)));
        msgs.push(`${res.reviewer.name}: ${res.added} new${res.updated ? `, ${res.updated} updated` : ''}${res.removed ? `, ${res.removed} withdrawn` : ''}`);
      } catch (e) { toast(`${f.name}: ${e.message}`, 'error', 5000); }
    }
    if (msgs.length) { touch('reviews'); toast(`Imported — ${msgs.join(' · ')}`, 'success', 5000); tab = lastTab = 'comments'; draw(); }
  }

  // ---------------- comments organiser ----------------
  function drawComments() {
    const all = R.comments;
    if (!all.length) {
      add(body, h('div.empty-state',
        icon('messages-square', 34), h('h3', 'No comments yet'),
        h('p', 'Invite reviewers to get a private, read-only copy of your book. When they send their comments back, drop the .bookyreview file here.'),
        h('div.row', { style: { justifyContent: 'center' } }, btn('Invite reviewer', { icon: 'plus', kind: 'primary', onClick: () => reviewerDialog() }), btn('Import comments', { icon: 'file-up', onClick: () => importFiles() }))));
      return;
    }
    const done = all.filter((c) => c.status !== 'open').length;
    const matches = (c) => (!filters.reviewers.size || filters.reviewers.has(c.reviewerId))
      && (!filters.types.size || filters.types.has(c.type))
      && (filters.status === 'all' || (filters.status === 'open' ? c.status === 'open' : c.status !== 'open'))
      && (!filters.q || `${c.quote} ${c.note} ${c.suggestion || ''}`.toLowerCase().includes(filters.q.toLowerCase()));
    const shown = orderedComments(book, all.filter(matches));
    const openList = orderedComments(book, all.filter((c) => c.status === 'open'));
    const chip = (on, label, onClick, dot) => h(`button.filter-pill${on ? '.on' : ''}`, { type: 'button', on: { click: onClick } }, dot ? h('i', { style: { background: dot } }) : null, label);
    const list = h('div.fb-list');
    add(body,
      h('div.fb-summary',
        h('div',
          h('div.fb-big', `${done} / ${all.length}`), h('div.muted.small', 'comments dealt with'),
          h('div.progress', { style: { marginTop: '8px', width: '220px' } }, h('div', { style: { width: `${(done / all.length) * 100}%` } }))),
        h('div.fb-byrev', R.reviewers.filter((r) => all.some((c) => c.reviewerId === r.id)).map((r) => {
          const mine = all.filter((c) => c.reviewerId === r.id);
          return h('div.fb-rev', { style: { '--rv': r.color } }, h('span.fb-dot'), h('b', r.name), h('span.muted.small', `${mine.filter((c) => c.status === 'open').length} open · ${mine.length} total`));
        })),
        h('div.col',
          btn(openList.length ? `Start correcting (${openList.length} left)` : 'All done 🎉', { icon: 'play', kind: 'primary', disabled: !openList.length, onClick: () => goToComment(openList[0]) }),
          h('small.hint', 'Opens each comment in the editor, in book order. Use “Next open comment” in the side panel to move on.'))),
      h('div.fb-filters',
        h('div.filter-row', chip(filters.status === 'open', `To do · ${all.length - done}`, () => { filters.status = 'open'; draw(); }), chip(filters.status === 'done', `Done · ${done}`, () => { filters.status = 'done'; draw(); }), chip(filters.status === 'all', `All · ${all.length}`, () => { filters.status = 'all'; draw(); })),
        h('div.filter-row', R.reviewers.filter((r) => all.some((c) => c.reviewerId === r.id)).map((r) => chip(filters.reviewers.has(r.id), r.name, () => { filters.reviewers.has(r.id) ? filters.reviewers.delete(r.id) : filters.reviewers.add(r.id); draw(); }, r.color))),
        h('div.filter-row', Object.entries(COMMENT_TYPES).filter(([k]) => all.some((c) => c.type === k)).map(([k, t]) => chip(filters.types.has(k), `${t.label} · ${all.filter((c) => c.type === k).length}`, () => { filters.types.has(k) ? filters.types.delete(k) : filters.types.add(k); draw(); }))),
        h('div.row',
          h('input.input', { type: 'search', placeholder: 'Search comments…', value: filters.q, style: { maxWidth: '280px' }, on: { input: (e) => { filters.q = e.target.value; drawList(); } } }),
          h('span.grow'),
          btn('Mark highlights & praise as done', { cls: 'btn-sm', kind: 'ghost', onClick: () => { all.filter((c) => c.status === 'open' && (c.type === 'highlight' || c.type === 'praise') && !c.note).forEach((c) => setStatus(c, 'resolved')); draw(); } }),
          btn('Download checklist', { icon: 'download', cls: 'btn-sm', kind: 'ghost', onClick: () => downloadReport() }))),
      list);

    function drawList() {
      clear(list);
      const items = orderedComments(book, all.filter(matches));
      if (!items.length) { add(list, h('p.muted', filters.status === 'open' ? 'Nothing left to do with these filters. 🎉' : 'No comments match.')); return; }
      let last = null;
      for (const c of items) {
        if (c.elId !== last) {
          last = c.elId;
          const el = book.elements.find((e) => e.id === c.elId);
          const inCh = items.filter((x) => x.elId === c.elId);
          add(list, h('div.fb-chapter', icon('file-pen', 14), el ? displayTitle(book, el) : c.sectionTitle || 'Removed page', h('span.badge', inCh.length)));
        }
        list.appendChild(commentCard(c, { onChange: draw }));
      }
    }
    void shown;
    drawList();
  }

  function downloadReport() {
    const rows = orderedComments(book, R.comments);
    const html = `<!doctype html><meta charset="utf-8"><title>Review checklist — ${escapeHtml(book.meta.title)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:860px;margin:30px auto;padding:0 20px;color:#1b1033}h1{font-family:Georgia,serif}h2{margin-top:28px;border-bottom:1px solid #ddd}
.c{border-left:4px solid;padding:8px 12px;margin:10px 0;background:#faf8ff;break-inside:avoid}.q{font-family:Georgia,serif}.m{color:#666;font-size:12px}s{color:#b91c1c}ins{color:#059669;text-decoration:none}input{margin-right:8px}</style>
<h1>${escapeHtml(book.meta.title)} — review checklist</h1><p>${rows.length} comments · ${rows.filter((c) => c.status !== 'open').length} done · ${R.reviewers.map((r) => `<span style="color:${r.color}">● ${escapeHtml(r.name)}</span>`).join(' ')}</p>
${(() => { let last = null, out = ''; for (const c of rows) { const el = book.elements.find((e) => e.id === c.elId); if (c.elId !== last) { last = c.elId; out += `<h2>${escapeHtml(el ? displayTitle(book, el) : c.sectionTitle)}</h2>`; } const r = reviewerById(c.reviewerId) || {}; out += `<div class="c" style="border-color:${r.color}"><label><input type="checkbox" ${c.status !== 'open' ? 'checked' : ''}><b>${escapeHtml(r.name || '')}</b> · ${COMMENT_TYPES[c.type]?.label}</label><div class="q">${c.suggestion != null ? `<s>${escapeHtml(c.quote)}</s> → <ins>${escapeHtml(c.suggestion)}</ins>` : `“${escapeHtml(c.quote)}”`}</div>${c.note ? `<div>${escapeHtml(c.note)}</div>` : ''}<div class="m">${STATUS[c.status]}${c.reply ? ' · My note: ' + escapeHtml(c.reply) : ''}</div></div>`; } return out; })()}`;
    downloadBlob(new Blob([html], { type: 'text/html' }), `${slugify(book.meta.title)}-review-checklist.html`);
  }

  // ---------------- reviewers & sharing ----------------
  function drawReviewers() {
    add(body,
      h('div.card', { style: { marginBottom: '16px' } },
        h('div.fb-how',
          ...[['user', '1. Invite', 'Add the reviewer’s name and email. Booky creates a private copy locked to that email and a passcode.'],
            ['mail', '2. Share', 'Send the file as an email attachment or upload it to Google Drive / Dropbox / OneDrive and send the link. Send the passcode separately.'],
            ['messages-square', '3. They review', 'They open it, highlight, comment and suggest edits. They can’t edit, copy or print your text.'],
            ['file-up', '4. Collect', 'They click “Send to author”. Import the .bookyreview file here — every reviewer has their own colour.']]
            .map(([ic, t, d]) => h('div.fb-step', h('span.tpl-ic', icon(ic, 18)), h('b', t), h('span.muted.small', d))))),
      h('div.row', { style: { marginBottom: '12px', alignItems: 'flex-end' } },
        field('Your email (reviewers send comments here)', input(state.app.authorEmail || '', (v) => setApp({ authorEmail: v.trim() }), { type: 'email', placeholder: 'you@example.com' }))));
    if (!R.reviewers.length) { add(body, h('p.muted', 'No reviewers yet.')); return; }
    add(body, h('div.fb-reviewers', R.reviewers.map((r) => {
      const mine = R.comments.filter((c) => c.reviewerId === r.id);
      return h('div.card.fb-revcard', { style: { '--rv': r.color } },
        h('div.row',
          color(r.color, (v) => { r.color = v; touch('reviews'); }),
          h('div.grow', h('b', r.name), h('div.muted.small', r.email)),
          iconBtn('trash', 'Remove reviewer', async () => {
            if (await confirmDialog('Remove reviewer?', `${r.name} and their ${mine.length} comment(s) will be removed from this book. Review copies already sent keep working until they expire.`, { okLabel: 'Remove', danger: true })) {
              R.reviewers = R.reviewers.filter((x) => x !== r); R.comments = R.comments.filter((c) => c.reviewerId !== r.id); R.overall = R.overall.filter((o) => o.reviewerId !== r.id); touch('reviews'); draw();
            }
          })),
        h('div.small.muted', { style: { margin: '8px 0' } },
          `${mine.length} comment${mine.length === 1 ? '' : 's'} · ${mine.filter((c) => c.status === 'open').length} to do`,
          r.copies?.length ? ` · copy sent ${timeAgo(r.copies[r.copies.length - 1].at)}` : ' · no copy sent yet',
          r.lastImport ? ` · comments received ${timeAgo(r.lastImport)}` : ''),
        h('div.row', { style: { flexWrap: 'wrap' } },
          btn(r.copies?.length ? 'New review copy' : 'Create review copy', { icon: 'lock', kind: 'primary', cls: 'btn-sm', onClick: () => shareDialog(r) }),
          r.copies?.length ? btn('Show passcode', { cls: 'btn-sm', kind: 'ghost', onClick: () => toast(`Passcode for ${r.name}: ${r.copies[r.copies.length - 1].passcode}`, 'info', 8000) }) : null));
    })));
  }

  function reviewerDialog() {
    let name = '', email = '';
    const m = modal({
      title: 'Invite a reviewer', width: 480,
      body: [
        field('Name', input('', (v) => { name = v; }, { placeholder: 'e.g. Priya (editor)' })),
        field('Email address', input('', (v) => { email = v; }, { type: 'email', placeholder: 'priya@example.com' }), 'Only this email address (with the passcode) can open the review copy.'),
      ],
      footer: [btn('Cancel', { onClick: () => m.close() }), btn('Next: create review copy', { kind: 'primary', onClick: () => {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { toast('Please enter a valid email address', 'warn'); return; }
        if (R.reviewers.some((r) => r.email.toLowerCase() === email.trim().toLowerCase())) { toast('This reviewer is already on the list', 'warn'); return; }
        const r = addReviewer(book, { name: name.trim() || email.trim().split('@')[0], email });
        touch('reviews');
        m.close();
        tab = lastTab = 'reviewers'; draw();
        shareDialog(r);
      } })],
    });
  }

  function shareDialog(r) {
    let passcode = makePasscode(), expires = 30, message = '', link = '';
    const pass = h('code.fb-pass', passcode);
    const m = modal({
      title: `Review copy for ${r.name}`, width: 560,
      body: [
        h('p.muted.small', { style: { marginTop: 0 } }, `Locked to ${r.email}. The book is encrypted inside the file — without this email and passcode it can’t be read.`),
        field('Passcode', h('div.row', pass, btn('New', { cls: 'btn-sm', kind: 'ghost', onClick: () => { passcode = makePasscode(); pass.textContent = passcode; } }))),
        field('Access expires', select([[0, 'Never'], [7, 'After 7 days'], [14, 'After 14 days'], [30, 'After 30 days'], [90, 'After 90 days']], expires, (v) => { expires = +v; })),
        field('Message to the reviewer (optional)', textarea('', (v) => { message = v; }, { rows: 3, placeholder: 'What would you like them to focus on?' })),
      ],
      footer: [btn('Cancel', { onClick: () => m.close() }), btn('Create & download', { kind: 'primary', icon: 'lock', onClick: async () => {
        const { buildReviewHtml } = await import('../share/review-file.js');
        const { html, roundId } = await buildReviewHtml(book, r, { passcode, expiresDays: expires, message, authorEmail: state.app.authorEmail || '', authorName: book.meta.author });
        const fileName = `${slugify(book.meta.title)}-review-copy-${slugify(r.name)}.html`;
        downloadBlob(new Blob([html], { type: 'text/html' }), fileName);
        r.copies = [...(r.copies || []), { roundId, at: Date.now(), passcode, expires }];
        R.rounds.push({ id: roundId, reviewerId: r.id, at: Date.now() });
        touch('reviews');
        m.close();
        draw();
        sendDialog(r, fileName, passcode, message);
      } })],
    });
    void link;
  }

  function sendDialog(r, fileName, passcode, message) {
    let link = '';
    const title = book.meta.title;
    const mailBody = () => `Hi ${r.name},\n\n${message ? message + '\n\n' : ''}I’d love your feedback on my book “${title}”. ${link ? `You can download your private review copy here:\n${link}\n` : `Your private review copy is attached (${fileName}).`}\n\nHow to review:\n1. Download and open the file in your web browser (Chrome, Edge, Safari or Firefox).\n2. Unlock it with this email address (${r.email}) and the passcode I’ll send you separately.\n3. Select any text to highlight it, comment, ask a question or suggest an edit.\n4. When you’re done, click “Send to author” and email me the comments file it saves.\n\nThank you!\n${book.meta.author || ''}`;
    const mailto = () => `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(`Review copy: ${title}`)}&body=${encodeURIComponent(mailBody())}`;
    const passMail = `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(`Passcode for “${title}”`)}&body=${encodeURIComponent(`Your passcode for the review copy of “${title}” is: ${passcode}`)}`;
    const mailBtn = h('a.btn.btn-primary', { href: mailto(), target: '_blank' }, icon('mail', 16), h('span', 'Write invitation email'));
    const m = modal({
      title: 'Share the review copy', width: 600,
      body: [
        h('div.notice', icon('circle-check', 16), h('span', h('b', fileName), ' was saved to your Downloads folder.')),
        h('div.fb-share-step', h('b', 'Option A — share a link'), h('p.small.muted', 'Upload the file to Google Drive, Dropbox or OneDrive, set it to “anyone with the link can view”, and paste the link here. Even if the link is forwarded, nobody can read the book without the email + passcode.'),
          input('', (v) => { link = v.trim(); mailBtn.href = mailto(); }, { placeholder: 'https://drive.google.com/…' })),
        h('div.fb-share-step', h('b', 'Option B — email attachment'), h('p.small.muted', 'Leave the link empty and attach the downloaded file to the email yourself (email apps don’t allow attaching files automatically).')),
        h('div.row', { style: { flexWrap: 'wrap', marginTop: '10px' } }, mailBtn),
        h('div.fb-share-step', h('b', 'Send the passcode separately'), h('p.small.muted', 'For real privacy send it by text message, WhatsApp, or a separate email.'),
          h('div.row', h('code.fb-pass', passcode),
            btn('Copy', { cls: 'btn-sm', onClick: () => navigator.clipboard?.writeText(passcode).then(() => toast('Passcode copied', 'success')) }),
            h('a.btn.btn-sm', { href: passMail, target: '_blank' }, icon('mail', 14), h('span', 'Email passcode')))),
      ],
      footer: [btn('Done', { kind: 'primary', onClick: () => m.close() })],
    });
  }

  // ---------------- overall reviews ----------------
  function drawOverall() {
    if (!R.overall.length) { add(body, h('p.muted', 'Overall reviews (star rating and summary) appear here when reviewers send them.')); return; }
    const avg = R.overall.filter((o) => o.rating).reduce((s, o, _, a) => s + o.rating / a.length, 0);
    add(body,
      avg ? h('div.fb-summary', h('div', h('div.fb-big', `${avg.toFixed(1)} ★`), h('div.muted.small', `average of ${R.overall.filter((o) => o.rating).length} rating(s)`))) : null,
      h('div.fb-reviewers', R.overall.map((o) => {
        const r = reviewerById(o.reviewerId) || { name: 'Reviewer', color: '#888' };
        return h('div.card.fb-revcard', { style: { '--rv': r.color } },
          h('div.row', h('span.fb-dot'), h('b', r.name), h('span.grow'), h('span.fb-stars', '★'.repeat(o.rating) + '☆'.repeat(5 - o.rating))),
          h('p', { style: { whiteSpace: 'pre-wrap', fontFamily: 'var(--font-serif)' } }, o.text || '(no written review)'),
          h('div.muted.small', timeAgo(o.at)));
      })));
  }

  draw();
  const offs = [on('reviews', () => { if (!document.activeElement?.closest?.('.feedback input, .feedback textarea')) draw(); })];
  return () => offs.forEach((f) => f());
}

export { goNext };
