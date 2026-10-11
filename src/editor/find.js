// Find & replace highlighting for the editor.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { textBlocks } from './proofing.js';

const key = new PluginKey('find');

export function findMatches(doc, query, { caseSensitive = false, wholeWord = false, regex = false } = {}) {
  let src = regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (wholeWord) src = `\\b${src}\\b`;
  let re;
  try { re = new RegExp(src, caseSensitive ? 'g' : 'gi'); } catch { return []; }
  const out = [];
  for (const b of textBlocks(doc)) {
    for (const m of b.text.matchAll(re)) {
      if (!m[0].length) continue;
      out.push({ from: b.map[m.index], to: b.map[m.index + m[0].length - 1] + 1 });
    }
  }
  return out;
}

export function setFindState(editor, matches, current) {
  const decos = matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === current ? 'find-hit current' : 'find-hit' }));
  editor.view.dispatch(editor.state.tr.setMeta(key, DecorationSet.create(editor.state.doc, decos)).setMeta('addToHistory', false));
}

export const FindHighlight = Extension.create({
  name: 'findHighlight',
  addProseMirrorPlugins() {
    return [new Plugin({
      key,
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, old) => tr.getMeta(key) || old.map(tr.mapping, tr.doc),
      },
      props: { decorations: (s) => key.getState(s) },
    })];
  },
});
