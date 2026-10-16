// Live proofing: underlines spelling, grammar and style issues while you write.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { checkText } from '../lang/grammar.js';
import { checkPunctuation } from '../lang/punctuation.js';
import { harperIssues, mergeIssues, loadHarper, onHarperReady, harperStatus } from '../lang/harper.js';
import { findMisspelled, WORD_RE, shouldSkip } from '../lang/spell.js';

export const proofKey = new PluginKey('proofing');
const grammarCache = new Map();
// Issues the writer dismissed this session, keyed by `rule:text`.
export const dismissed = new Set();

function cachedCheck(text, opts) {
  const key = `${opts.grammar ? 1 : 0}${opts.style ? 1 : 0}${opts.fiction ? 1 : 0}|${text}`;
  let r = grammarCache.get(key);
  if (!r) {
    r = checkText(text, opts);
    grammarCache.set(key, r);
    if (grammarCache.size > 3000) grammarCache.delete(grammarCache.keys().next().value);
  }
  return r;
}

export function textBlocks(doc) {
  const blocks = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      if (node.type.name === 'codeBlock') return false;
      let text = '';
      const map = [];
      node.forEach((child, offset) => {
        if (child.isText) {
          for (let i = 0; i < child.text.length; i++) map.push(pos + 1 + offset + i);
          text += child.text;
        } else {
          text += '￼';
          map.push(pos + 1 + offset);
        }
      });
      blocks.push({ text, map, pos, node });
      return false;
    }
    return true;
  });
  return blocks;
}

async function analyze(doc, settings) {
  const blocks = textBlocks(doc);
  const decos = [];
  const spellHits = [];
  for (const b of blocks) {
    if (!b.text.trim()) continue;
    const range = (s, e) => [b.map[s], b.map[e - 1] + 1];
    if (settings.spell) {
      for (const m of b.text.matchAll(WORD_RE)) {
        const w = m[0].replace(/['’]+$/, '');
        if (shouldSkip(w)) continue;
        // skip {{placeholders}}
        const before = b.text.lastIndexOf('{{', m.index), close = b.text.lastIndexOf('}}', m.index);
        if (before > close) continue;
        spellHits.push({ w, from: b.map[m.index], to: b.map[m.index + w.length - 1] + 1 });
      }
    }
    let found = settings.grammar || settings.style ? [...cachedCheck(b.text, { grammar: settings.grammar, style: settings.style, fiction: settings.fiction })] : [];
    // the Harper engine, when it's loaded (English only)
    if (settings.grammar && settings.harper && settings.lang === 'en') {
      const hi = await harperIssues(b.text);
      if (hi) found = mergeIssues(found, hi.filter((x) => settings.style || x.kind !== 'style'));
    }
    if (settings.punct) found.push(...checkPunctuation(b.text, settings.lang, { skipEnglish: settings.grammar }).filter((is) => settings.punctStyle || is.kind !== 'style'));
    if (found.length) {
      for (const is of found) {
        if (dismissed.has(`${is.rule}:${b.text.slice(is.start, is.end)}`)) continue;
        const [from, to] = range(is.start, is.end);
        if (from == null || to == null || from >= to) continue;
        const sentence = sentenceAround(b.text, is.start);
        decos.push(Decoration.inline(from, to, { class: `pf pf-${is.kind}` }, { issue: { ...is, from, to, sentence: sentence.text, sentenceFrom: b.map[sentence.start], sentenceTo: b.map[sentence.end - 1] + 1 } }));
      }
    }
  }
  if (spellHits.length) {
    const bad = await findMisspelled(spellHits.map((h) => h.w));
    for (const h of spellHits) {
      if (bad.has(h.w)) {
        decos.push(Decoration.inline(h.from, h.to, { class: 'pf pf-spelling' }, { issue: { kind: 'spelling', rule: 'spelling', title: 'Spelling', message: `“${h.w}” is not in the dictionary.`, word: h.w, from: h.from, to: h.to, replacements: null } }));
      }
    }
  }
  return decos;
}

export function sentenceAround(text, idx) {
  let start = idx, end = idx;
  while (start > 0 && !/[.!?]/.test(text[start - 1])) start--;
  while (end < text.length && !/[.!?]/.test(text[end])) end++;
  while (end < text.length && /[.!?"”’)]/.test(text[end])) end++;
  while (start < end && /\s/.test(text[start])) start++;
  return { start, end, text: text.slice(start, end) };
}

export const Proofing = Extension.create({
  name: 'proofing',
  addOptions() {
    return { getSettings: () => ({ spell: true, grammar: true, style: true, fiction: true }), onUpdate: () => {} };
  },
  addStorage() {
    return { schedule: () => {} };
  },
  addProseMirrorPlugins() {
    const ext = this;
    return [new Plugin({
      key: proofKey,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, old) {
          const meta = tr.getMeta(proofKey);
          if (meta) return meta;
          return old.map(tr.mapping, tr.doc);
        },
      },
      props: {
        decorations(state) { return proofKey.getState(state); },
      },
      view(view) {
        let timer = null;
        let running = false;
        let again = false;
        const run = async () => {
          if (running) { again = true; return; }
          running = true;
          const doc = view.state.doc;
          let decos = [];
          try { decos = await analyze(doc, ext.options.getSettings()); } catch (e) { console.warn(e); }
          running = false;
          if (view.isDestroyed) return;
          if (view.state.doc !== doc || again) { again = false; schedule(250); return; }
          const set = DecorationSet.create(doc, decos);
          view.dispatch(view.state.tr.setMeta(proofKey, set).setMeta('addToHistory', false).setMeta('proofing', true));
          ext.options.onUpdate(set);
        };
        const schedule = (ms = 600) => { clearTimeout(timer); timer = setTimeout(run, ms); };
        ext.storage.schedule = schedule;
        const st = ext.options.getSettings();
        let offReady = () => {};
        if (st.grammar && st.harper && st.lang === 'en' && harperStatus() !== 'ready') {
          offReady = onHarperReady(() => schedule(50));
          loadHarper(st.variety);
        }
        schedule(50);
        return {
          update(v, prev) { if (!prev.doc.eq(v.state.doc)) schedule(); },
          destroy() { clearTimeout(timer); offReady(); },
        };
      },
    })];
  },
});

export function issuesAt(state, pos) {
  const set = proofKey.getState(state);
  if (!set) return [];
  return set.find(pos, pos).map((d) => d.spec.issue).filter(Boolean);
}

export function allIssues(state) {
  const set = proofKey.getState(state);
  if (!set) return [];
  return set.find().map((d) => d.spec.issue).filter(Boolean).sort((a, b) => a.from - b.from);
}
