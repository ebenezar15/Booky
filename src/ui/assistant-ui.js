// The Writing assistant: paraphrase (seven modes), fix grammar & punctuation, summarise, sentence ideas,
// and a hand-off to other writing apps (QuillBot, Grammarly, LanguageTool, DeepL Write) with paste-back.
// Everything except "Other apps" runs on the device.
import { h, icon, btn, clear, add, modal, toast, menu, slider, segmented } from './dom.js';
import { state, setApp } from '../core/store.js';
import { langInfo, isEnglish, isRtl } from '../core/languages.js';
import { paraphrase, fixGrammar, summarize, alternativesFor, MODES, OTHER_APPS } from '../lang/assistant.js';
import { harperIssues, loadHarper } from '../lang/harper.js';

/** Booky's rules plus, for English, the Harper engine's fixes (agreement, word choice, articles…). */
async function deepFix(text, lang) {
  let t = text;
  if (isEnglish(lang) && state.app.harper !== false && await loadHarper()) {
    for (let pass = 0; pass < 3; pass++) {
      const paras = t.split('\n');
      let changed = false;
      for (let p = 0; p < paras.length; p++) {
        const issues = ((await harperIssues(paras[p])) || []).filter((i) => i.kind === 'grammar' && i.replacements.length).sort((a, b) => b.start - a.start);
        let last = Infinity;
        for (const i of issues) {
          if (i.end > last) continue;
          paras[p] = paras[p].slice(0, i.start) + i.replacements[0] + paras[p].slice(i.end);
          last = i.start; changed = true;
        }
      }
      t = paras.join('\n');
      if (!changed) break;
    }
  }
  return fixGrammar(t, lang);
}
import { rephrase } from '../lang/rephrase.js';
import { diffWords } from '../core/diff.js';

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The text to work on: the selection, or the paragraph (or sentence range) given. */
function sourceRange(editor, range) {
  const { state: st } = editor;
  if (range?.from != null && range.to > range.from) return { from: range.from, to: range.to };
  const sel = st.selection;
  if (!sel.empty) return { from: sel.from, to: sel.to };
  const $p = st.doc.resolve(range?.at ?? sel.from);
  if (!$p.parent.isTextblock) return null;
  return { from: $p.start(), to: $p.end() };
}

/** Replace a range with text; several paragraphs become several paragraphs. */
function putBack(editor, r, text) {
  const paras = String(text).split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const content = paras.length > 1 ? paras.map((p) => `<p>${escHtml(p)}</p>`).join('') : escHtml(paras[0] || '');
  editor.chain().focus().insertContentAt(r, content).run();
}

/** Output with the words that changed highlighted; clicking one offers other words. */
function diffView(before, after, onChange) {
  const box = h('div.as-out', { lang: 'und' });
  const draw = () => {
    clear(box);
    for (const part of diffWords(before, after.value)) {
      if (part.op === '-') continue;
      if (part.op === '=') { box.appendChild(document.createTextNode(part.text)); continue; }
      for (const tok of part.text.split(/(\s+)/)) {
        if (!tok) continue;
        if (/^\s+$/.test(tok)) { box.appendChild(document.createTextNode(tok)); continue; }
        const word = tok.match(/[A-Za-z][A-Za-z'-]*/)?.[0];
        const alts = word ? alternativesFor(word) : [];
        const mark = h(`mark.as-chg${alts.length ? '.has-alts' : ''}`, { title: alts.length ? 'Click for other words' : 'Changed' }, tok);
        if (alts.length) mark.addEventListener('click', () => menu(mark, [{ header: 'Other words' }, ...alts.slice(0, 8).map((a) => ({ label: a, onClick: () => { after.value = after.value.replace(new RegExp(`\\b${word}\\b`), a); onChange?.(); draw(); } }))]));
        box.appendChild(mark);
      }
    }
  };
  draw();
  return { box, draw };
}

export function openAssistant(editor, book, range = null, startTab = 'paraphrase') {
  if (!editor) return;
  const r = sourceRange(editor, range);
  const original = r ? editor.state.doc.textBetween(r.from, r.to, '\n') : '';
  if (!r || !original.trim()) { toast('Select some text, or put the cursor in a paragraph, then open the Writing assistant.', 'warn'); return; }
  const lang = book.meta.language || 'en';
  const en = isEnglish(lang);
  let tab = startTab;
  let seed = 1;
  const prefs = () => state.app.assistant || {};
  const savePrefs = (p) => setApp({ assistant: { ...prefs(), ...p } });

  const input = h('textarea.input.as-in', { rows: 5, 'aria-label': 'Text to work on', spellcheck: 'true', lang, dir: isRtl(lang) ? 'rtl' : 'auto' });
  input.value = original;
  const body = h('div.as-body');
  const stats = h('span.small.muted');
  const result = { value: '' };

  const actions = (getText, { summary = false } = {}) => h('div.row.as-actions', { style: { gap: '8px', flexWrap: 'wrap' } },
    btn(summary ? 'Insert below the paragraph' : 'Replace in book', { kind: 'primary', icon: summary ? 'corner-down-left' : 'check', onClick: () => {
      const t = getText();
      if (!t.trim()) return;
      if (summary) {
        const at = editor.state.doc.resolve(r.to).after();
        editor.chain().focus().insertContentAt(at, `<p>${escHtml(t)}</p>`).run();
      } else putBack(editor, r, t);
      m.close();
      toast(summary ? 'Summary added — Ctrl Z to undo' : 'Replaced — Ctrl Z to undo', 'success');
    } }),
    btn('Copy', { icon: 'copy', onClick: async () => { try { await navigator.clipboard.writeText(getText()); toast('Copied', 'success', 1200); } catch { toast('Couldn’t copy — select the text and press Ctrl C.', 'warn'); } } }));

  const panes = {
    paraphrase() {
      const mode = prefs().mode || 'standard';
      const strength = prefs().strength || 2;
      const out = h('div');
      let token = 0;
      const run = async () => {
        const my = ++token;
        const src = prefs().mode === 'casual' || prefs().mode === 'formal' ? input.value : await deepFix(input.value, lang);
        if (my !== token) return;
        const res = paraphrase(src, { mode: prefs().mode || 'standard', strength: prefs().strength || 2, seed, lang });
        if (src !== input.value) res.changed = res.text !== input.value;
        result.value = res.text;
        clear(out);
        if (!res.changed) { add(out, h('div.as-out.muted', en ? 'Nothing to change in this mode — try another mode or “Try again”.' : 'No changes needed. (Rewording modes work in English; for this language Booky fixes punctuation and spacing.)')); return; }
        const v = diffView(input.value, result, () => {});
        add(out, v.box);
        const n = diffWords(input.value, result.value).filter((p) => p.op === '+').length;
        stats.textContent = `${n} change${n === 1 ? '' : 's'}`;
      };
      add(body,
        h('div.row.as-modes', { style: { gap: '6px', flexWrap: 'wrap' } }, ...MODES.map((md) => h(`button.as-mode${md.id === mode ? '.on' : ''}`, { type: 'button', title: md.hint, disabled: !en && !['fluency', 'shorten'].includes(md.id), on: { click: (e) => { savePrefs({ mode: md.id }); body.querySelectorAll('.as-mode').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); run(); } } }, md.label))),
        h('div.row', { style: { gap: '10px', alignItems: 'center', margin: '10px 0' } },
          en ? h('span.small', 'Synonyms') : null, en ? slider(strength, 1, 3, 1, (v) => { savePrefs({ strength: v }); run(); }, (v) => ['', 'Few', 'Some', 'More'][v]) : null,
          h('span.grow'), stats,
          btn('Try again', { icon: 'refresh-cw', kind: 'ghost', onClick: () => { seed++; run(); } })),
        out, actions(() => result.value));
      run();
    },
    grammar() {
      const out = h('div');
      let token = 0;
      const run = async () => {
        const my = ++token;
        clear(out); add(out, h('div.as-out.muted', 'Checking…'));
        const fixed = await deepFix(input.value, lang);
        if (my !== token) return;
        result.value = fixed;
        clear(out);
        if (result.value === input.value) { add(out, h('div.as-out.as-ok', icon('circle-check', 18), h('span', 'No grammar or punctuation errors found.'))); return; }
        add(out, diffView(input.value, result).box);
      };
      add(body, h('p.small.muted', en ? 'Fixes repeated words, a/an, capitals, spacing, doubled marks and other punctuation.' : `Fixes spacing and punctuation for ${langInfo(lang).name || lang}.`), out, actions(() => result.value));
      run();
    },
    summary() {
      const out = h('div.as-out');
      const ratio = prefs().ratio || 0.35;
      const run = () => { result.value = summarize(input.value, { ratio: prefs().ratio || 0.35, lang }); out.textContent = result.value; stats.textContent = `${Math.round((result.value.length / Math.max(1, input.value.length)) * 100)}% of the length`; };
      add(body, h('div.row', { style: { gap: '10px', alignItems: 'center', marginBottom: '10px' } }, h('span.small', 'Length'), slider(ratio, 0.15, 0.75, 0.05, (v) => { savePrefs({ ratio: v }); run(); }, (v) => (v < 0.3 ? 'Short' : v < 0.5 ? 'Medium' : 'Long')), h('span.grow'), stats),
        h('p.small.muted', 'Keeps the sentences that carry the passage, in their original order. Select several paragraphs or a whole scene for the best result. Works in every language.'),
        out, actions(() => result.value, { summary: true }));
      run();
    },
    ideas() {
      const list = h('div.rephrase-list');
      const opts = en ? rephrase(input.value.replace(/\n+/g, ' ')) : [];
      if (!opts.length) add(list, h('p.muted', en ? 'This already reads cleanly — no alternatives found.' : 'Sentence ideas work in English.'));
      opts.forEach((o) => list.appendChild(h('button.rephrase-opt', { type: 'button', on: { click: () => { putBack(editor, r, o.text); m.close(); toast('Replaced — Ctrl Z to undo', 'success'); } } }, h('small', o.label), h('span', o.text))));
      add(body, list);
    },
    apps() {
      const desktop = !!globalThis.bookyDesktop;
      add(body,
        h('p.small', 'Send this passage to another writing tool. Booky copies the text and opens the tool; paste it there (Ctrl V / ⌘ V), copy the improved version, then come back and press “Paste result back”.'),
        h('div.as-apps', OTHER_APPS.map((a) => h('button.as-app', { type: 'button', on: { click: async () => {
          try { await navigator.clipboard.writeText(input.value); } catch { /* the user can copy by hand */ }
          window.open(a.url, '_blank', 'noopener');
          toast(`Text copied — paste it into ${a.name}`, 'info', 4000);
        } } }, icon('share', 16), h('span', a.name)))),
        h('div.row', { style: { gap: '8px', marginTop: '14px' } }, btn('Paste result back', { kind: 'primary', icon: 'corner-down-left', onClick: async () => {
          let t = '';
          try { t = await navigator.clipboard.readText(); } catch { /* blocked */ }
          if (!t.trim()) { toast('The clipboard is empty or Booky can’t read it. Click in the book and press Ctrl V / ⌘ V instead.', 'warn', 6000); return; }
          putBack(editor, r, t);
          m.close();
          toast('Replaced with the pasted text — Ctrl Z to undo', 'success');
        } })),
        h('p.hint', { style: { marginTop: '12px' } }, desktop
          ? 'Tip: Booky in Chrome or Edge also works with the QuillBot and Grammarly browser extensions — they check the text right in the editor. Turn off Booky’s own underlines in the editor view settings if they get in the way.'
          : 'The QuillBot, Grammarly and LanguageTool browser extensions also work right in Booky’s editor. Turn off Booky’s own underlines (editor view settings → Check spelling/grammar/punctuation) if you prefer theirs.'));
    },
  };

  const tabs = segmented([['paraphrase', 'Paraphrase'], ['grammar', 'Grammar & punctuation'], ['summary', 'Summarize'], ...(en ? [['ideas', 'Sentence ideas']] : []), ['apps', 'Other apps']], tab, (v) => { tab = v; draw(); });
  const draw = () => { clear(body); stats.textContent = ''; result.value = ''; body.classList.remove('as-enter'); void body.offsetWidth; body.classList.add('as-enter'); panes[tab](); };
  let timer;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { if (tab !== 'apps' && tab !== 'ideas') draw(); }, 400); });

  const m = modal({
    title: 'Writing assistant', width: 820, cls: 'as-modal',
    body: [
      h('div.as-tabs', tabs),
      h('label.small.muted', { style: { display: 'block', margin: '10px 0 4px' } }, 'Your text'), input,
      body,
      h('p.hint', { style: { marginTop: '12px' } }, icon('lock', 13), ' Runs on this device — no internet, no account, no AI service. Always check the meaning is kept.'),
    ],
  });
  draw();
  return m;
}
