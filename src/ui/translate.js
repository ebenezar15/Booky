// Translate a book into a new project, then review it page by page against the original.
import { h, btn, icon, modal, field, select, textarea, input, toast, clear, add, segmented, confirmDialog } from './dom.js';
import { state, setApp, touch, emit, selectElement, save } from '../core/store.js';
import { db } from '../core/db.js';
import { LANGUAGES, langInfo, applyLanguageDesign, isRtl } from '../core/languages.js';
import { fontStack } from '../core/fonts.js';
import { orderedElements } from '../core/model.js';
import { PROVIDERS, prepareTranslation, runTranslation, translateHtml, translationProgress } from '../lang/translate.js';

const keys = () => state.app.translate || {};
const setKeys = (patch) => setApp({ translate: { ...keys(), ...patch } });

/** Settings → Translation: provider keys, stored only in this browser. */
export function translationSettingsPanel() {
  const k = keys();
  return h('div.col', { style: { gap: '12px' } },
    h('p.muted', 'Keys are saved only in this browser and are sent only to the service you choose. The built-in browser translator and manual mode need no key.'),
    field('Anthropic API key (Claude)', input(k.claudeKey || '', (v) => setKeys({ claudeKey: v.trim() }), { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off' }),
      'Create one at console.anthropic.com → API keys. Usage is billed to your Anthropic account.'),
    field('Google Cloud Translation API key', input(k.googleKey || '', (v) => setKeys({ googleKey: v.trim() }), { type: 'password', placeholder: 'AIza…', autocomplete: 'off' })),
    field('LibreTranslate server', input(k.libreUrl || '', (v) => setKeys({ libreUrl: v.trim() }), { placeholder: 'https://libretranslate.com' })),
    field('LibreTranslate API key (if needed)', input(k.libreKey || '', (v) => setKeys({ libreKey: v.trim() }), { type: 'password', autocomplete: 'off' })),
  );
}

function providerReady(id) {
  const k = keys();
  if (id === 'browser') return !!globalThis.Translator;
  if (id === 'claude') return !!k.claudeKey;
  if (id === 'google') return !!k.googleKey;
  if (id === 'libre') return !!k.libreUrl;
  return true;
}

/** Translate a book as a new project. */
export function openTranslateDialog(book, { onCreated } = {}) {
  const src = book.meta.language || 'en';
  const choices = LANGUAGES.filter((l) => l.code !== src);
  let target = (src.startsWith('en') ? 'ta' : 'en');
  let provider = keys().provider || (globalThis.Translator ? 'browser' : 'claude');
  let glossary = book.translation?.glossary || '';
  const hint = h('small.hint');
  const warn = h('div');
  const drawHint = () => {
    hint.textContent = PROVIDERS.find((p) => p.id === provider)?.hint || '';
    clear(warn);
    if (!providerReady(provider)) {
      add(warn, h('div.generated-note', icon('triangle-alert', 16), h('div',
        provider === 'browser' ? 'This browser has no built-in translator. Use desktop Chrome/Edge, or choose another provider.' : 'Add your key first: ',
        provider === 'browser' ? null : h('a', { href: '#', on: { click: async (e) => { e.preventDefault(); const { openSettings } = await import('./settings.js'); openSettings('translate'); } } }, 'Settings → Translation'))));
    }
  };
  drawHint();
  const m = modal({
    title: 'Translate book', width: 560,
    body: h('div.col', { style: { gap: '14px' } },
      h('p.muted', `Creates a new project — “${book.meta.title}” stays as it is. Every page keeps its original beside the translation so you can compare, retranslate and correct.`),
      field(`From ${langInfo(src).name} into`, select(choices.map((l) => ({ value: l.code, label: `${l.name} — ${l.native}` })), target, (v) => { target = v; })),
      field('Translate with', select(PROVIDERS.map((p) => ({ value: p.id, label: p.label })), provider, (v) => { provider = v; setKeys({ provider: v }); drawHint(); }), hint),
      warn,
      field('Notes for the translator (optional)', textarea(glossary, (v) => { glossary = v; }, { rows: 3, placeholder: 'e.g. Keep character names in English. Use informal “நீ” between friends. “The Keep” = “கோட்டை”.' }),
        'Used by Claude. Names, tone, a glossary of special terms — anything a human translator would want to know.'),
    ),
    footer: [
      btn('Cancel', { onClick: () => m.close() }),
      btn('Create translation', { kind: 'primary', icon: 'languages', onClick: async () => {
        if (!providerReady(provider)) { drawHint(); return; }
        m.close();
        const copy = prepareTranslation(book, target, provider);
        copy.translation.glossary = glossary;
        applyLanguageDesign(copy, target);
        copy.meta.title = book.meta.title;
        await db.putBook(copy);
        if (provider === 'manual') { toast('Translation project created — the original is shown beside each page', 'success', 4000); onCreated?.(copy); location.hash = `#/book/${copy.id}`; return; }
        const ok = await progressRun(copy, { onSave: () => db.putBook(JSON.parse(JSON.stringify(copy))) });
        onCreated?.(copy);
        location.hash = `#/book/${copy.id}`;
        if (ok) toast(`Translated into ${langInfo(target).name}. Review each page against the original — Original tab on the right.`, 'success', 6000);
      } }),
    ],
  });
}

// Run a translation with a progress dialog. Resolves true when finished, false if stopped or failed.
function progressRun(book, { onSave, only } = {}) {
  return new Promise((resolve) => {
    const ctrl = new AbortController();
    const bar = h('div.progress-fill', { style: { width: '0%' } });
    const label = h('p.muted', 'Starting…');
    let finished = false;
    const m = modal({
      title: `Translating into ${langInfo(book.translation.target).name}`, width: 480,
      body: h('div.col', { style: { gap: '10px' } }, label, h('div.progress', bar),
        h('p.hint', 'You can stop at any time — finished pages are kept, and “Continue translation” picks up where it stopped.')),
      footer: [btn('Stop', { onClick: () => ctrl.abort() })],
      onClose: () => { if (!finished) ctrl.abort(); },
    });
    runTranslation(book, {
      keys: keys(), signal: ctrl.signal, onSave, only,
      onStatus: (s) => { label.textContent = s; },
      onProgress: (done, total, el) => {
        bar.style.width = `${total ? Math.round((done / total) * 100) : 100}%`;
        label.textContent = `${done} of ${total} pages · ${el.source?.title || el.title || el.type}`;
      },
    }).then(() => { finished = true; m.close(); resolve(true); })
      .catch((e) => {
        finished = true; m.close();
        if (e?.name === 'AbortError' || ctrl.signal.aborted) toast('Translation paused — continue it any time from the Original tab', 'info', 4000);
        else toast(e.message || String(e), 'error', 8000);
        resolve(false);
      });
  });
}

/** Continue (or start) machine translation of pages still pending in the open project. */
export async function continueTranslation(only) {
  const book = state.book;
  if (!book?.translation) return;
  if (book.translation.provider === 'manual' || !providerReady(book.translation.provider)) {
    const pick = await chooseProvider(book);
    if (!pick) return;
  }
  if (only) only.forEach((id) => { const el = book.elements.find((e) => e.id === id); if (el) el.trStatus = 'pending'; });
  await progressRun(book, { only, onSave: async () => { touch('elements'); await save(); } });
  emit('replace-content');
  touch('elements');
}

function chooseProvider(book) {
  return new Promise((resolve) => {
    let provider = PROVIDERS.find((p) => p.id !== 'manual' && providerReady(p.id))?.id || 'claude';
    const m = modal({
      title: 'Translate with', width: 440,
      body: field('Provider', select(PROVIDERS.filter((p) => p.id !== 'manual').map((p) => ({ value: p.id, label: p.label })), provider, (v) => { provider = v; })),
      footer: [btn('Cancel', { onClick: () => { m.close(); resolve(false); } }), btn('Continue', { kind: 'primary', onClick: () => {
        if (!providerReady(provider)) { toast('Add a key for this provider in Settings → Translation', 'warn'); return; }
        book.translation.provider = provider; setKeys({ provider }); m.close(); resolve(true);
      } })],
    });
  });
}

const STATUS = { pending: ['Not translated yet', 'var(--muted)'], todo: ['To translate', 'var(--warning, #d97706)'], machine: ['Machine translated — check it', 'var(--accent)'], reviewed: ['Reviewed', 'var(--success)'] };

/** Inspector tab: original text of the page, status and actions. */
export function drawOriginalTab(body, el) {
  const book = state.book;
  const tr = book.translation;
  if (!tr) {
    add(body, h('p.muted', 'Translate this book into another language as a new project. The original stays untouched.'),
      btn('Translate book…', { icon: 'languages', kind: 'primary', onClick: () => openTranslateDialog(book) }));
    return;
  }
  const p = translationProgress(book);
  const S = langInfo(tr.source);
  add(body,
    h('div.card', { style: { padding: '10px 12px', marginBottom: '12px' } },
      h('div.small', h('b', `${S.name} → ${langInfo(tr.target).name}`), h('span.muted', ` · from “${tr.fromTitle}”`)),
      h('div.progress', { style: { margin: '8px 0 6px' } }, h('div.progress-fill', { style: { width: `${p.total ? Math.round((p.reviewed / p.total) * 100) : 0}%` } })),
      h('div.small.muted', `${p.reviewed} of ${p.total} pages reviewed${p.machine ? ` · ${p.machine} to check` : ''}${p.pending ? ` · ${p.pending} not translated` : ''}${p.todo ? ` · ${p.todo} to translate by hand` : ''}`),
      h('div.row', { style: { gap: '6px', marginTop: '8px', flexWrap: 'wrap' } },
        p.pending ? btn('Continue translation', { icon: 'play', kind: 'primary', cls: 'btn-sm', onClick: () => continueTranslation() }) : null,
        btn('Next page to review', { icon: 'arrow-right', cls: 'btn-sm', onClick: () => {
          const list = orderedElements(book);
          const i = list.findIndex((e) => e.id === state.currentId);
          const next = [...list.slice(i + 1), ...list.slice(0, i + 1)].find((e) => e.source && e.trStatus !== 'reviewed');
          if (next) selectElement(next.id); else toast('Every page is reviewed 🎉', 'success');
        } }),
      ),
    ),
  );
  if (!el?.source) { add(body, h('p.muted.small', 'This page was added after translating, so it has no original.')); return; }
  const [label, col] = STATUS[el.trStatus] || STATUS.pending;
  add(body,
    h('div.row', { style: { gap: '8px', alignItems: 'center', marginBottom: '8px' } }, h('span', { style: { width: '9px', height: '9px', borderRadius: '50%', background: col, flex: 'none' } }), h('b.small', label)),
    segmented([['machine', 'Needs check'], ['reviewed', 'Reviewed']], el.trStatus === 'reviewed' ? 'reviewed' : 'machine', (v) => { el.trStatus = v; touch('elements'); }),
    h('div.row', { style: { gap: '6px', margin: '10px 0', flexWrap: 'wrap' } },
      btn(el.trStatus === 'pending' || el.trStatus === 'todo' ? 'Translate this page' : 'Retranslate page', { icon: 'refresh-cw', cls: 'btn-sm', onClick: async () => {
        if (el.trStatus === 'machine' || el.trStatus === 'reviewed') {
          if (!(await confirmDialog('Retranslate this page?', 'Your corrections on this page will be replaced by a fresh translation. (A snapshot is saved in History first.)', { okLabel: 'Retranslate' }))) return;
          const { takeSnapshot } = await import('../core/actions.js');
          takeSnapshot(el, 'Before retranslating');
        }
        continueTranslation([el.id]);
      } }),
      btn(state.app.showOriginal ? 'Hide side-by-side' : 'Side by side', { icon: 'columns-2', cls: 'btn-sm', onClick: () => setApp({ showOriginal: !state.app.showOriginal }) }),
    ),
    h('div.section-title', `Original (${S.name})`),
    el.source.title ? h('h4', { lang: tr.source, style: { margin: '6px 0', fontFamily: fontStack(S.heading) } }, el.source.title) : null,
    h('div.original-text', { lang: tr.source, dir: isRtl(tr.source) ? 'rtl' : 'ltr', style: { fontFamily: fontStack(S.body) }, html: el.source.content || '' }),
  );
}

/** Side-by-side pane in the editor: the original, with click-to-translate for single paragraphs. */
export function originalPane(el, { insert } = {}) {
  const tr = state.book.translation;
  const S = langInfo(tr.source);
  const pane = h('aside.original-pane', { lang: tr.source, dir: isRtl(tr.source) ? 'rtl' : 'ltr', style: { fontFamily: fontStack(S.body) } },
    h('div.op-head', icon('languages', 14), ` Original · ${S.name}`),
    el.source.title ? h('h2.op-title', { style: { fontFamily: fontStack(S.heading) } }, el.source.title) : null,
    h('div.op-body', { html: el.source.content || '' }));
  pane.querySelectorAll('.op-body > *').forEach((block) => {
    block.title = 'Click: translate this paragraph again and insert it at the cursor';
    block.addEventListener('click', async () => {
      if (tr.provider === 'manual' || !providerReady(tr.provider)) { toast('Choose a translation provider first (Original tab → Translate this page)', 'warn'); return; }
      block.classList.add('busy');
      try {
        const html = await translateHtml(block.outerHTML, { provider: tr.provider, source: tr.source, target: tr.target, glossary: tr.glossary, keys: keys() });
        insert?.(html);
        toast('Inserted at the cursor — Ctrl Z to undo', 'success', 2000);
      } catch (e) { toast(e.message, 'error', 6000); }
      block.classList.remove('busy');
    });
  });
  return pane;
}

