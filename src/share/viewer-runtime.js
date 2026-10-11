/* Booky review copy — runs inside the shared HTML file (no imports).
   Two ways in: the file itself (book embedded, no network), or the online review page
   (review.html?c=<copy>&u=<supabase url>&a=<public key>) which downloads the encrypted copy;
   either way only the invited email + passcode can unlock it.
   The book is encrypted; only the invited reviewer's email + passcode can open it.
   Reviewers can highlight, comment, suggest edits and leave an overall review, but
   cannot edit the text, and copying/printing are blocked. */
(function () {
  'use strict';
  var DATA = window.__BOOKY_REVIEW__;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var el = function (tag, attrs, html) { var n = document.createElement(tag); if (attrs) for (var k in attrs) { if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); } if (html != null) n.innerHTML = html; return n; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var uid = function () { return 'cm_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); };

  // ---------- crypto (mirrors src/share/crypto.js) ----------
  function b64d(str) { var bin = atob(str), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  function b64e(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  async function keyFor(email, pass, salt, iter) {
    var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(email).trim().toLowerCase() + '\n' + String(pass).trim().toUpperCase()), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function decrypt(box, email, pass) {
    var key = await keyFor(email, pass, b64d(box.salt), box.iter);
    var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(box.iv) }, key, b64d(box.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }
  async function encrypt(obj, email, pass) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 250000;
    var key = await keyFor(email, pass, salt, iter);
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
    return { v: 1, kdf: 'PBKDF2-SHA256', iter: iter, salt: b64e(salt), iv: b64e(iv), ct: b64e(ct) };
  }

  // ---------- online mode (Supabase functions, no library, no sign-in) ----------
  var ONLINE = null, EMAIL = '', PASS = '';
  async function rpc(name, args) {
    var res;
    try {
      res = await fetch(ONLINE.url + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: ONLINE.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
    } catch (e) { throw new Error('No internet connection — please try again.'); }
    var text = await res.text(), data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) throw new Error((data && (data.message || data.msg || data.error)) || ('Error ' + res.status));
    return data;
  }
  function card(html) {
    var old = $('.rv-lock'); if (old) old.remove();
    var lock = el('div', { class: 'rv-lock' }, '<div class="rv-lock-card"><div class="rv-logo">B</div>' + html + '</div>');
    document.body.appendChild(lock);
    return lock;
  }
  function boot() {
    if (DATA) { showLock(); return; }
    var q = new URLSearchParams(location.search);
    if (!q.get('c') || !q.get('u') || !q.get('a')) { card('<h1>Booky review</h1><p>Open the review link the author sent you.</p>'); return; }
    ONLINE = { copy: q.get('c'), url: q.get('u').replace(/\/+$/, ''), key: q.get('a') };
    fetchCopy();
  }
  async function fetchCopy() {
    card('<p>Opening your review copy…</p>');
    try {
      var rows = await rpc('booky_get_copy', { p_id: ONLINE.copy });
      if (!rows || !rows.length) { card('<h1>Review copy not available</h1><p>The author has withdrawn this review copy, or it has expired. Please ask them for a new link.</p>'); return; }
      DATA = rows[0];
      var lock = $('.rv-lock'); if (lock) lock.remove();
      showLock();
    } catch (err) {
      card('<h1>Couldn’t open the review copy</h1><p>' + esc(err.message) + '</p><button class="rv-btn primary" id="rv-retry">Try again</button>');
      $('#rv-retry').onclick = fetchCopy;
    }
  }

  var P = null; // decrypted payload
  var store = { comments: [], overall: { rating: 0, text: '' } };
  var KEY = '';
  var TYPES = { comment: 'Comment', suggestion: 'Suggested edit', question: 'Question', error: 'Error / typo', praise: 'Praise', highlight: 'Highlight' };
  var HL = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74'];

  function toast(msg) {
    var t = $('#rv-toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* storage blocked */ } renderList(); }

  // ---------- unlock ----------
  function showLock() {
    document.title = DATA.title + ' — review copy';
    var lock = el('div', { class: 'rv-lock' }, '<div class="rv-lock-card"><div class="rv-logo">B</div><h1>' + esc(DATA.title) + '</h1>' +
      '<p class="rv-muted">' + (DATA.author ? 'by ' + esc(DATA.author) + ' · ' : '') + 'Private review copy</p>' +
      '<p>This copy is shared privately. Enter the email address it was sent to and the passcode you received from the author.</p>' +
      '<form id="rv-form"><label>Email address<input id="rv-email" type="email" autocomplete="email" required></label>' +
      '<label>Passcode<input id="rv-pass" autocomplete="off" placeholder="XXXX-XXXX" required></label>' +
      '<button class="rv-btn primary" type="submit">Open book</button><p id="rv-err" class="rv-err"></p></form>' +
      '<p class="rv-small rv-muted">Your notes are saved in this browser until you send them to the author.</p></div>');
    document.body.appendChild(lock);
    $('#rv-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('#rv-form button'); btn.disabled = true; btn.textContent = 'Unlocking…'; $('#rv-err').textContent = '';
      try {
        P = await decrypt(DATA.box, $('#rv-email').value, $('#rv-pass').value);
        EMAIL = $('#rv-email').value; PASS = $('#rv-pass').value;
        if (P.expiresAt && Date.now() > P.expiresAt) { $('#rv-err').textContent = 'This review copy has expired. Please ask the author for a new one.'; btn.disabled = false; btn.textContent = 'Open book'; return; }
        lock.remove();
        start();
      } catch (err) {
        $('#rv-err').textContent = 'That email and passcode don’t match this review copy.';
        btn.disabled = false; btn.textContent = 'Open book';
      }
    });
  }

  // ---------- protection ----------
  function protect() {
    var block = function (e) { e.preventDefault(); toast('Copying is disabled in this review copy.'); };
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('dragstart', function (e) { e.preventDefault(); });
    document.addEventListener('contextmenu', function (e) { if (!e.target.closest('textarea, input')) e.preventDefault(); });
    document.addEventListener('keydown', function (e) {
      var k = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'a', 's', 'p', 'u'].indexOf(k) >= 0 && !e.target.closest('textarea, input')) { e.preventDefault(); toast(k === 'p' ? 'Printing is disabled in this review copy.' : 'This action is disabled in this review copy.'); }
    });
    window.addEventListener('beforeprint', function () { document.body.classList.add('rv-noprint'); });
  }

  function watermark(text) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200"><text x="20" y="120" transform="rotate(-24 180 100)" font-family="sans-serif" font-size="13" fill="rgba(120,100,160,0.09)">' + esc(text) + '</text></svg>';
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
  }

  // ---------- layout ----------
  function start() {
    KEY = 'bookyReview:' + P.roundId + ':' + P.reviewer.id;
    try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && saved.comments) store = saved; } catch (e) { /* ignore */ }
    var st = el('style'); st.textContent = (P.fontsCss || '') + '\n' + P.css; document.head.appendChild(st);
    document.documentElement.style.setProperty('--rv-me', P.reviewer.color);
    protect();
    var app = el('div', { class: 'rv-app' });
    app.innerHTML =
      '<header class="rv-top"><button class="rv-icon" id="rv-toc-btn" title="Contents">☰</button>' +
      '<div class="rv-title"><b>' + esc(P.bookTitle) + '</b><small>Review copy for ' + esc(P.reviewer.name) + '</small></div>' +
      '<div class="rv-actions"><button class="rv-icon" id="rv-smaller" title="Smaller text">A−</button><button class="rv-icon" id="rv-bigger" title="Larger text">A+</button>' +
      '<button class="rv-icon" id="rv-theme" title="Light / sepia / dark">☾</button>' +
      '<button class="rv-btn" id="rv-overall">★ Overall review</button><button class="rv-btn primary" id="rv-send">Send to author</button></div></header>' +
      '<div class="rv-body"><nav class="rv-toc" id="rv-toc"></nav><main class="rv-main" id="rv-main"><div class="rv-help">Select any text to highlight it or add a comment, question or suggested edit. Your notes are shown in <span class="rv-me-dot"></span> your colour.</div><article class="rv-article" id="rv-article"></article></main>' +
      '<aside class="rv-side"><div class="rv-side-head"><b>My notes</b><span id="rv-count"></span></div><div id="rv-list"></div></aside></div>' +
      '<div class="rv-sel" id="rv-sel"></div><div class="rv-pop" id="rv-pop"></div><div id="rv-toast" class="rv-toast"></div>';
    document.body.appendChild(app);
    var art = $('#rv-article');
    art.style.backgroundImage = watermark(P.reviewer.email + ' · ' + P.bookTitle);
    art.innerHTML = P.sections.map(function (s) { return s.html; }).join('');
    $('#rv-toc').innerHTML = '<b>Contents</b>' + P.sections.filter(function (s) { return s.title; }).map(function (s) { return '<a href="#' + s.anchor + '">' + esc(s.title) + '</a>'; }).join('');
    $('#rv-toc').addEventListener('click', function (e) { var a = e.target.closest('a'); if (!a) return; e.preventDefault(); var t = document.getElementById(a.getAttribute('href').slice(1)); if (t) t.scrollIntoView({ behavior: 'smooth' }); document.body.classList.remove('rv-toc-open'); });
    $('#rv-toc-btn').onclick = function () { document.body.classList.toggle('rv-toc-open'); };
    var size = 18;
    $('#rv-bigger').onclick = function () { size = Math.min(28, size + 1); art.style.fontSize = size + 'px'; };
    $('#rv-smaller').onclick = function () { size = Math.max(13, size - 1); art.style.fontSize = size + 'px'; };
    var themes = ['light', 'sepia', 'dark'], ti = 0;
    $('#rv-theme').onclick = function () { ti = (ti + 1) % 3; document.documentElement.dataset.rv = themes[ti]; };
    $('#rv-overall').onclick = overallDialog;
    $('#rv-send').onclick = send;
    art.addEventListener('mouseup', onSelect);
    art.addEventListener('touchend', function () { setTimeout(onSelect, 50); });
    art.addEventListener('click', function (e) { var m = e.target.closest('mark.rv-mark'); if (m) showComment(m.getAttribute('data-id'), m.getBoundingClientRect()); });
    document.addEventListener('mousedown', function (e) { if (!e.target.closest('#rv-sel, #rv-pop')) { $('#rv-sel').classList.remove('show'); if (!e.target.closest('mark.rv-mark')) $('#rv-pop').classList.remove('show'); } });
    paintAll();
    renderList();
  }

  // ---------- text offsets ----------
  function textNodes(root) { var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); while (w.nextNode()) out.push(w.currentNode); return out; }
  function contentOf(elId) { return document.querySelector('section[data-el="' + elId + '"]'); }
  function offsetIn(root, node, off) { var n = 0, list = textNodes(root); for (var i = 0; i < list.length; i++) { if (list[i] === node) return n + off; n += list[i].data.length; } return -1; }

  function onSelect() {
    var sel = getSelection();
    var bar = $('#rv-sel');
    if (!sel.rangeCount || sel.isCollapsed) { bar.classList.remove('show'); return; }
    var r = sel.getRangeAt(0);
    var sec = (r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode).closest('section[data-el]');
    if (!sec) { bar.classList.remove('show'); return; }
    var start = offsetIn(sec, r.startContainer, r.startOffset), end = offsetIn(sec, r.endContainer, r.endOffset);
    if (r.startContainer.nodeType !== 3 || r.endContainer.nodeType !== 3 || start < 0 || end <= start) { bar.classList.remove('show'); return; }
    var text = sec.textContent;
    var pending = { elId: sec.getAttribute('data-el'), sectionTitle: sec.getAttribute('data-title') || '', offset: start, quote: text.slice(start, end), prefix: text.slice(Math.max(0, start - 40), start), suffix: text.slice(end, end + 40) };
    if (!pending.quote.trim()) return;
    var rect = r.getBoundingClientRect();
    bar.innerHTML = HL.map(function (c) { return '<button class="rv-sw" data-c="' + c + '" style="background:' + c + '" title="Highlight"></button>'; }).join('') +
      '<span class="rv-sep"></span><button data-t="comment">💬 Comment</button><button data-t="suggestion">✎ Suggest</button><button data-t="question">? Ask</button><button data-t="error">⚠ Error</button><button data-t="praise">♥ Like</button>';
    bar.style.left = Math.max(8, Math.min(innerWidth - 470, rect.left + rect.width / 2 - 230)) + 'px';
    bar.style.top = Math.max(60, rect.top - 52) + 'px';
    bar.classList.add('show');
    bar.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      bar.classList.remove('show');
      if (b.dataset.c) { addComment(Object.assign({}, pending, { type: 'highlight', color: b.dataset.c, note: '' })); getSelection().removeAllRanges(); return; }
      editDialog(Object.assign({}, pending, { type: b.dataset.t, note: '', suggestion: b.dataset.t === 'suggestion' ? pending.quote : null }), rect);
    };
  }

  function addComment(c) {
    c.id = c.id || uid(); c.createdAt = c.createdAt || Date.now();
    store.comments.push(c); save(); paintAll();
  }

  function editDialog(c, rect, existing) {
    var pop = $('#rv-pop');
    pop.innerHTML = '<div class="rv-pop-quote">“' + esc(c.quote.length > 160 ? c.quote.slice(0, 160) + '…' : c.quote) + '”</div>' +
      '<label>Type<select id="rv-type">' + Object.keys(TYPES).filter(function (t) { return t !== 'highlight' || existing; }).map(function (t) { return '<option value="' + t + '"' + (t === c.type ? ' selected' : '') + '>' + TYPES[t] + '</option>'; }).join('') + '</select></label>' +
      '<label id="rv-sug-wrap"' + (c.type === 'suggestion' ? '' : ' hidden') + '>Replace with<textarea id="rv-sug" rows="3">' + esc(c.suggestion || '') + '</textarea></label>' +
      '<label>Note<textarea id="rv-note" rows="4" placeholder="Your comment for the author…">' + esc(c.note || '') + '</textarea></label>' +
      '<div class="rv-row">' + (existing ? '<button class="rv-btn danger" id="rv-del">Delete</button>' : '') + '<span style="flex:1"></span><button class="rv-btn" id="rv-cancel">Cancel</button><button class="rv-btn primary" id="rv-save">Save</button></div>';
    placePop(rect);
    $('#rv-type').onchange = function () { $('#rv-sug-wrap').hidden = this.value !== 'suggestion'; if (this.value === 'suggestion' && !$('#rv-sug').value) $('#rv-sug').value = c.quote; };
    $('#rv-cancel').onclick = function () { pop.classList.remove('show'); };
    if (existing) $('#rv-del').onclick = function () { store.comments = store.comments.filter(function (x) { return x.id !== c.id; }); save(); paintAll(); pop.classList.remove('show'); };
    $('#rv-save').onclick = function () {
      c.type = $('#rv-type').value; c.note = $('#rv-note').value.trim();
      c.suggestion = c.type === 'suggestion' ? $('#rv-sug').value : null;
      if (existing) { save(); paintAll(); } else addComment(c);
      pop.classList.remove('show'); getSelection().removeAllRanges();
    };
    setTimeout(function () { $('#rv-note').focus(); }, 30);
  }

  function placePop(rect) {
    var pop = $('#rv-pop');
    pop.classList.add('show');
    var top = rect.bottom + 10; if (top + pop.offsetHeight > innerHeight - 10) top = Math.max(60, rect.top - pop.offsetHeight - 10);
    pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, rect.left)) + 'px';
    pop.style.top = top + 'px';
  }

  function showComment(id, rect) {
    var c = store.comments.filter(function (x) { return x.id === id; })[0];
    if (c) editDialog(c, rect, true);
  }

  // ---------- painting highlights ----------
  function locate(text, c) {
    if (text.substr(c.offset, c.quote.length) === c.quote) return c.offset;
    var best = -1, bestScore = -1, i = -1;
    while ((i = text.indexOf(c.quote, i + 1)) !== -1) {
      var s = 0, b = text.slice(Math.max(0, i - 40), i), a = text.slice(i + c.quote.length, i + c.quote.length + 40);
      for (var k = 1; k <= Math.min(b.length, c.prefix.length); k++) { if (b[b.length - k] === c.prefix[c.prefix.length - k]) s++; else break; }
      for (k = 0; k < Math.min(a.length, c.suffix.length); k++) { if (a[k] === c.suffix[k]) s++; else break; }
      if (s > bestScore) { bestScore = s; best = i; }
    }
    return best;
  }
  function unpaint() {
    document.querySelectorAll('mark.rv-mark').forEach(function (m) { var p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize(); });
  }
  function paint(c) {
    var sec = contentOf(c.elId); if (!sec) return;
    var start = locate(sec.textContent, c); if (start < 0) return;
    var end = start + c.quote.length, pos = 0;
    textNodes(sec).forEach(function (t) {
      var a = pos, b = pos + t.data.length; pos = b;
      if (b <= start || a >= end) return;
      var s = Math.max(0, start - a), e = Math.min(t.data.length, end - a);
      var mid = t; if (s > 0) mid = t.splitText(s); if (e - s < mid.data.length) mid.splitText(e - s);
      var m = document.createElement('mark'); m.className = 'rv-mark rv-' + c.type; m.setAttribute('data-id', c.id);
      m.style.background = c.type === 'highlight' ? c.color + 'aa' : 'color-mix(in srgb, ' + P.reviewer.color + ' 22%, transparent)';
      m.style.borderBottom = c.type === 'highlight' ? '' : '2px solid ' + P.reviewer.color;
      mid.parentNode.insertBefore(m, mid); m.appendChild(mid);
    });
  }
  function paintAll() { unpaint(); store.comments.forEach(paint); }

  // ---------- my notes list ----------
  function renderList() {
    var list = $('#rv-list'); if (!list) return;
    var order = {}; P.sections.forEach(function (s, i) { order[s.id] = i; });
    var items = store.comments.slice().sort(function (a, b) { return (order[a.elId] - order[b.elId]) || (a.offset - b.offset); });
    $('#rv-count').textContent = items.length ? items.length + ' note' + (items.length === 1 ? '' : 's') : '';
    list.innerHTML = items.length ? items.map(function (c) {
      return '<button class="rv-note" data-id="' + c.id + '"><small>' + esc(c.sectionTitle) + ' · ' + TYPES[c.type] + '</small><span class="rv-q">“' + esc(c.quote.length > 90 ? c.quote.slice(0, 90) + '…' : c.quote) + '”</span>' +
        (c.suggestion != null ? '<span class="rv-s">→ ' + esc(c.suggestion) + '</span>' : '') + (c.note ? '<span>' + esc(c.note) + '</span>' : '') + '</button>';
    }).join('') : '<p class="rv-muted rv-small">No notes yet. Select text in the book to start.</p>';
    list.querySelectorAll('.rv-note').forEach(function (b) {
      b.onclick = function () { var m = document.querySelector('mark[data-id="' + b.dataset.id + '"]'); if (m) { m.scrollIntoView({ behavior: 'smooth', block: 'center' }); m.classList.add('rv-flash'); setTimeout(function () { m.classList.remove('rv-flash'); }, 1400); } };
    });
  }

  function overallDialog() {
    var pop = $('#rv-pop');
    var o = store.overall;
    pop.innerHTML = '<b>Overall review</b><div class="rv-stars">' + [1, 2, 3, 4, 5].map(function (n) { return '<button data-n="' + n + '" class="' + (n <= o.rating ? 'on' : '') + '">★</button>'; }).join('') + '</div>' +
      '<label>Your thoughts on the whole book<textarea id="rv-ov" rows="7" placeholder="What worked, what didn’t, what you’d change…">' + esc(o.text) + '</textarea></label>' +
      '<div class="rv-row"><span style="flex:1"></span><button class="rv-btn" id="rv-cancel">Close</button><button class="rv-btn primary" id="rv-save">Save</button></div>';
    var r = $('#rv-overall').getBoundingClientRect();
    placePop({ left: r.left - 260, bottom: r.bottom, top: r.top });
    pop.querySelectorAll('.rv-stars button').forEach(function (b) { b.onclick = function () { o.rating = +b.dataset.n; pop.querySelectorAll('.rv-stars button').forEach(function (x) { x.classList.toggle('on', +x.dataset.n <= o.rating); }); }; });
    $('#rv-cancel').onclick = function () { pop.classList.remove('show'); };
    $('#rv-save').onclick = function () { o.text = $('#rv-ov').value.trim(); save(); pop.classList.remove('show'); toast('Overall review saved'); };
  }

  function send() {
    var out = {
      type: 'booky-review', version: 1, bookId: P.bookId, bookTitle: P.bookTitle, roundId: P.roundId,
      reviewer: P.reviewer, sentAt: Date.now(), overall: store.overall,
      comments: store.comments.map(function (c) { return { id: c.id, elId: c.elId, sectionTitle: c.sectionTitle, quote: c.quote, prefix: c.prefix, suffix: c.suffix, offset: c.offset, type: c.type, color: c.color || '', note: c.note || '', suggestion: c.suggestion, createdAt: c.createdAt }; }),
    };
    if (ONLINE) { sendOnline(out); return; }
    var name = (P.bookTitle + ' - comments from ' + P.reviewer.name).replace(/[\\/:*?"<>|]+/g, '') + '.bookyreview';
    var blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
    var a = el('a', { href: URL.createObjectURL(blob), download: name }); document.body.appendChild(a); a.click(); a.remove();
    var pop = $('#rv-pop');
    var mail = 'mailto:' + encodeURIComponent(P.authorEmail || '') + '?subject=' + encodeURIComponent('My comments on “' + P.bookTitle + '”') +
      '&body=' + encodeURIComponent('Hi ' + (P.authorName || '') + ',\n\nMy comments on “' + P.bookTitle + '” are attached (' + name + ').\n\n' + store.comments.length + ' notes' + (store.overall.rating ? ', overall rating ' + store.overall.rating + '/5' : '') + '.\n\n' + P.reviewer.name);
    pop.innerHTML = '<b>Your comments are saved</b><p>The file <b>' + esc(name) + '</b> was downloaded (check your Downloads folder).</p>' +
      '<p>Attach it to an email to the author' + (P.authorEmail ? ' (<b>' + esc(P.authorEmail) + '</b>)' : '') + '.</p>' +
      '<div class="rv-row"><span style="flex:1"></span><button class="rv-btn" id="rv-cancel">Close</button>' + (P.authorEmail ? '<a class="rv-btn primary" href="' + mail + '">Write the email</a>' : '') + '</div>' +
      '<p class="rv-small rv-muted">You can keep reviewing and send again later — the author’s copy updates with your latest notes.</p>';
    var r = $('#rv-send').getBoundingClientRect();
    placePop({ left: r.right - 360, bottom: r.bottom, top: r.top });
    $('#rv-cancel').onclick = function () { pop.classList.remove('show'); };
  }

  async function sendOnline(out) {
    var b = $('#rv-send'); b.disabled = true; b.textContent = 'Sending…';
    var pop = $('#rv-pop');
    try {
      if (!P.writeSecret) throw new Error('This copy was made for sharing as a file.');
      await rpc('booky_send_comments', { p_id: ONLINE.copy, p_write_secret: P.writeSecret, p_box: await encrypt(out, EMAIL, PASS) });
      pop.innerHTML = '<b>Sent to ' + esc(P.authorName || 'the author') + ' ✓</b><p>' + out.comments.length + ' note' + (out.comments.length === 1 ? '' : 's') + (out.overall.rating ? ' and your ' + out.overall.rating + '★ review' : '') + (out.comments.length === 1 && !out.overall.rating ? ' was' : ' were') + ' delivered securely.</p>' +
        '<p class="rv-small rv-muted">You can keep reviewing and send again — the author always gets your latest notes.</p><div class="rv-row"><span style="flex:1"></span><button class="rv-btn primary" id="rv-cancel">OK</button></div>';
    } catch (err) {
      pop.innerHTML = '<b>Couldn’t send right now</b><p>' + esc(err.message) + '</p><p class="rv-small rv-muted">Your notes are safe in this browser. Try again, or save them as a file and email it.</p>' +
        '<div class="rv-row"><button class="rv-btn" id="rv-file">Save as file</button><span style="flex:1"></span><button class="rv-btn primary" id="rv-cancel">Close</button></div>';
      $('#rv-file').onclick = function () { var o = ONLINE; ONLINE = null; send(); ONLINE = o; };
    }
    b.disabled = false; b.textContent = 'Send to author';
    var r = b.getBoundingClientRect();
    placePop({ left: r.right - 360, bottom: r.bottom, top: r.top });
    $('#rv-cancel').onclick = function () { pop.classList.remove('show'); };
  }

  if (!window.crypto || !crypto.subtle) {
    document.body.innerHTML = '<p style="font:16px sans-serif;padding:40px">Please open this file in an up-to-date browser (Chrome, Edge, Firefox or Safari).</p>';
    return;
  }
  boot();
})();
