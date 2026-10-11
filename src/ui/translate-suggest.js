// Context-aware translation suggestions for a selected word or sentence.
//  · In any book: translate the selection into another language, using its paragraph as context.
//  · In a translation project: suggest better wordings for part of the translation, using the original paragraph.
import { h, btn, icon, popover, closeMenu, select, toast, clear, add } from './dom.js';
import { state, setApp, currentElement } from '../core/store.js';
import { LANGUAGES, langInfo } from '../core/languages.js';
import { fontStack } from '../core/fonts.js';
import { suggestTranslations, bookContext, PROVIDERS } from '../lang/translate.js';

const keys = () => state.app.translate || {};

function bestProvider(book) {
  const k = keys();
  if (k.claudeKey) return 'claude';
  const p = book.translation?.provider !== 'manual' && book.translation?.provider || k.provider;
  if (p === 'google' && k.googleKey) return 'google';
  if (p === 'libre' && k.libreUrl) return 'libre';
  if (globalThis.Translator) return 'browser';
  if (k.googleKey) return 'google';
  if (k.libreUrl) return 'libre';
  return null;
}

const sameLang = (a, b) => String(a || 'en').split('-')[0] === String(b || 'en').split('-')[0];

// Text of the n-th top-level block of some HTML (browser only).
function blockText(html, n) {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  const kids = [...doc.body.children];
  return [kids[n - 1], kids[n], kids[n + 1]].filter(Boolean).map((k) => k.textContent.trim()).filter(Boolean).join('\n');
}

/** From the editor: suggestions for the selection (or the word at the cursor). */
export function suggestForSelection(ed, book) {
  if (!ed) return;
  let { from, to, empty } = ed.state.selection;
  const $from = ed.state.doc.resolve(from);
  if (empty) {
    const para = $from.parent.textContent, off = $from.parentOffset;
    const left = para.slice(0, off).match(/[\p{L}\p{M}\p{N}'’-]*$/u)[0].length, right = para.slice(off).match(/^[\p{L}\p{M}\p{N}'’-]*/u)[0].length;
    if (!left && !right) { toast('Select a word or sentence to translate', 'info'); return; }
    from -= left; to = from + left + right;
  }
  const text = ed.state.doc.textBetween(from, to, ' ').trim();
  if (!text) return;
  const context = $from.parent.textContent;
  const tr = book.translation;
  const improve = !!(tr && sameLang(book.meta.language, tr.target) && currentElement()?.source);
  const coords = ed.view.coordsAtPos(to);
  const replace = (t) => ed.chain().focus().command(({ tr: t2 }) => { t2.insertText(t, from, to); return true; }).run();
  openSuggest({
    anchorRect: { left: coords.left, right: coords.right, top: coords.top, bottom: coords.bottom },
    text, context, mode: improve ? 'improve' : 'translate',
    original: improve ? blockText(currentElement().source.content, $from.index(0)) : '',
    source: improve ? tr.source : book.meta.language || 'en',
    target: improve ? tr.target : null,
    onPick: replace, pickLabel: 'Replace',
  });
}

/**
 * opts: { anchorRect, text, context, original, mode, source, target (null = let the writer choose), onPick(text), pickLabel }
 */
export function openSuggest(opts) {
  const book = state.book;
  let target = opts.target || state.app.suggestTarget || (sameLang(opts.source, 'en') ? 'ta' : 'en');
  if (sameLang(target, opts.source) && !opts.target) target = sameLang(opts.source, 'en') ? 'ta' : 'en';
  const provider = bestProvider(book);
  const list = h('div.ts-list');
  const box = h('div.ts-box',
    h('div.ts-head', icon('languages', 15),
      h('b', opts.mode === 'improve' ? 'Better wording' : 'Translate'),
      h('span.ts-quote', `“${opts.text.length > 60 ? opts.text.slice(0, 60) + '…' : opts.text}”`)),
    opts.target ? null : h('div.row', { style: { gap: '6px', margin: '6px 0' } }, h('span.small.muted', 'into'),
      select(LANGUAGES.filter((l) => !sameLang(l.code, opts.source)).map((l) => ({ value: l.code, label: `${l.name} — ${l.native}` })), target, (v) => { target = v; setApp({ suggestTarget: v }); run(); }, { class: 'input-sm' })),
    list,
    h('div.ts-foot.small.muted', provider ? `${PROVIDERS.find((p) => p.id === provider)?.label}${provider === 'claude' ? ' · reads the whole paragraph for context' : ' · add an Anthropic key for several suggestions with explanations'}` : ''));
  popover(opts.anchorRect, box, { cls: 'ts-pop' });

  async function run() {
    clear(list);
    if (!provider) {
      add(list, h('p.small', 'Choose a translator first: add an Anthropic (Claude) or Google key, or use Chrome/Edge for the free built-in translator.'),
        btn('Open settings', { cls: 'btn-sm', onClick: () => { closeMenu(); import('./settings.js').then((m) => m.openSettings('translate')); } }));
      return;
    }
    add(list, ...[0, 1, 2].map(() => h('div.ts-skel')));
    const ctx = { provider, source: opts.source, target, keys: keys(), glossary: book.translation?.glossary || '', book: bookContext(book) };
    try {
      const res = await suggestTranslations({ text: opts.text, context: opts.context, original: opts.original, mode: opts.mode }, ctx);
      clear(list);
      if (!res.length) { add(list, h('p.small.muted', 'No suggestions — try selecting a whole sentence.')); return; }
      const T = langInfo(target);
      res.forEach((r, i) => add(list, h('div.ts-item', { style: { animationDelay: `${i * 60}ms` } },
        h('div.ts-text', { lang: target, style: { fontFamily: fontStack(T.body) } }, r.text),
        r.note ? h('div.ts-note', r.note) : null,
        h('div.row', { style: { gap: '6px' } },
          btn(opts.pickLabel || 'Insert', { icon: 'check', cls: 'btn-sm', kind: i === 0 ? 'primary' : '', onClick: () => { opts.onPick?.(r.text); closeMenu(); } }),
          btn('Copy', { icon: 'copy', cls: 'btn-sm', kind: 'ghost', onClick: () => navigator.clipboard?.writeText(r.text).then(() => toast('Copied', 'success', 1200)) })))));
    } catch (e) {
      clear(list);
      add(list, h('p.small', { style: { color: 'var(--danger, #dc2626)' } }, e.message));
    }
  }
  run();
}
