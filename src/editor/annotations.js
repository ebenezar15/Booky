// Shows reviewers' open comments inside the editor, tinted with each reviewer's colour.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { textBlocks } from './proofing.js';
import { locateQuote } from '../core/feedback.js';

export const annotKey = new PluginKey('annotations');

/** Map a comment to a document range in the editor, or null. */
export function rangeForComment(doc, c) {
  const blocks = textBlocks(doc);
  let text = '';
  const map = [];
  for (const b of blocks) { text += b.text; map.push(...b.map); }
  const hit = locateQuote(text, c);
  if (!hit) return null;
  return { from: map[hit.start], to: map[hit.end - 1] + 1, partial: !!hit.partial };
}

export const Annotations = Extension.create({
  name: 'annotations',
  addOptions() {
    return { getComments: () => [], getReviewer: () => null };
  },
  addStorage() {
    return { refresh: () => {} };
  },
  addProseMirrorPlugins() {
    const ext = this;
    const build = (doc) => {
      const decos = [];
      for (const c of ext.options.getComments()) {
        const r = rangeForComment(doc, c);
        if (!r || r.from == null || r.to == null || r.from >= r.to) continue;
        const rev = ext.options.getReviewer(c.reviewerId);
        const color = rev?.color || '#7c3aed';
        decos.push(Decoration.inline(r.from, r.to, {
          class: 'rv-annot',
          style: `background: color-mix(in srgb, ${color} 16%, transparent); border-bottom: 2px solid ${color};`,
          'data-comment': c.id,
          title: `${rev?.name || 'Reviewer'}: ${c.note || c.type}`,
        }, { comment: c }));
      }
      return DecorationSet.create(doc, decos);
    };
    return [new Plugin({
      key: annotKey,
      state: {
        init: (_, state) => build(state.doc),
        apply(tr, old, _, state) {
          if (tr.getMeta(annotKey)) return build(state.doc);
          return tr.docChanged ? old.map(tr.mapping, tr.doc) : old;
        },
      },
      props: { decorations: (s) => annotKey.getState(s) },
      view(view) {
        ext.storage.refresh = () => { if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(annotKey, true).setMeta('addToHistory', false)); };
        return {};
      },
    })];
  },
});
