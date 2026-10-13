// Custom TipTap extensions for book writing.
import { Node, Mark, Extension, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import Image from '@tiptap/extension-image';

// Paragraph styles (verse, epigraph, caption, …) stored as a class on blocks.
export const PARAGRAPH_STYLES = [
  { id: '', label: 'Body text' },
  { id: 'noindent', label: 'Body — no indent' },
  { id: 'verse', label: 'Verse / Poetry' },
  { id: 'epigraph', label: 'Epigraph' },
  { id: 'attribution', label: 'Attribution' },
  { id: 'letter', label: 'Letter / Inset text' },
  { id: 'signature', label: 'Signature' },
  { id: 'caption', label: 'Caption' },
  { id: 'callout', label: 'Callout box' },
  { id: 'hanging', label: 'Hanging indent' },
  { id: 'small', label: 'Small print' },
  { id: 'display', label: 'Display title' },
  { id: 'subtitle', label: 'Display subtitle' },
  { id: 'author', label: 'Author line' },
  { id: 'spacer', label: 'Vertical space' },
];

export const ParagraphStyle = Extension.create({
  name: 'paragraphStyle',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        pstyle: {
          default: '',
          parseHTML: (el) => (el.getAttribute('class') || '').match(/\bps-([\w-]+)/)?.[1] || '',
          renderHTML: (attrs) => (attrs.pstyle ? { class: `ps-${attrs.pstyle}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setParagraphStyle: (pstyle) => ({ commands, editor }) => {
        if (!editor.isActive('paragraph')) commands.setParagraph();
        return commands.updateAttributes('paragraph', { pstyle });
      },
    };
  },
});

export const SceneBreak = Node.create({
  name: 'sceneBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-type="scene-break"]' }, { tag: 'hr' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'scene-break', class: 'scene-break' })];
  },
  addCommands() {
    return {
      insertSceneBreak: () => ({ chain }) => chain().insertContent([{ type: this.name }, { type: 'paragraph' }]).run(),
    };
  },
  addKeyboardShortcuts() {
    return { 'Mod-Alt-8': () => this.editor.commands.insertSceneBreak() };
  },
});

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-type="page-break"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'page-break', class: 'page-break' })];
  },
  addCommands() {
    return {
      insertPageBreak: () => ({ chain }) => chain().insertContent([{ type: this.name }, { type: 'paragraph' }]).run(),
    };
  },
  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => this.editor.commands.insertPageBreak() };
  },
});

export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { note: { default: '', parseHTML: (el) => el.getAttribute('data-note') || el.textContent || '', renderHTML: (a) => ({ 'data-note': a.note }) } };
  },
  parseHTML() {
    return [{ tag: 'span[data-type="footnote"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'footnote', class: 'footnote-marker', title: HTMLAttributes['data-note'] || '' })];
  },
  addCommands() {
    return {
      insertFootnote: (note) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { note } }),
    };
  },
});

export const SmallCaps = Mark.create({
  name: 'smallCaps',
  parseHTML() {
    return [{ tag: 'span.sc' }, { style: 'font-variant', getAttrs: (v) => (/small-caps/.test(v) ? {} : false) }];
  },
  renderHTML() {
    return ['span', { class: 'sc' }, 0];
  },
  addCommands() {
    return { toggleSmallCaps: () => ({ commands }) => commands.toggleMark(this.name) };
  },
  addKeyboardShortcuts() {
    return { 'Mod-Shift-k': () => this.editor.commands.toggleSmallCaps() };
  },
});

export const BookImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: '100', parseHTML: (el) => el.getAttribute('data-width') || '100', renderHTML: (a) => ({ 'data-width': a.width, style: `width:${a.width === 'page' ? 100 : a.width}%` }) },
      align: { default: 'center', parseHTML: (el) => el.getAttribute('data-align') || 'center', renderHTML: (a) => ({ 'data-align': a.align }) },
    };
  },
}).configure({ allowBase64: true, inline: false });

// Typewriter mode: keep the caret line vertically centred while typing.
export const Typewriter = Extension.create({
  name: 'typewriter',
  addOptions() {
    return { enabled: () => false, scroller: () => null };
  },
  onSelectionUpdate() {
    if (!this.options.enabled()) return;
    const view = this.editor.view;
    const scroller = this.options.scroller();
    if (!scroller) return;
    try {
      const coords = view.coordsAtPos(view.state.selection.head);
      const box = scroller.getBoundingClientRect();
      const target = box.top + box.height * 0.45;
      scroller.scrollTop += coords.top - target;
    } catch { /* position not rendered */ }
  },
});

// Phonetic typing: Latin letters become the book's script when a word is finished
// (space, Enter or punctuation). Toggle in the toolbar; Ctrl/⌘ + Shift + Space.
export const PhoneticTyping = Extension.create({
  name: 'phoneticTyping',
  addOptions() {
    return { enabled: () => false, convert: (w) => w, onToggle: () => {} };
  },
  addKeyboardShortcuts() {
    const convertPending = () => {
      if (!this.options.enabled()) return false;
      const { state, view } = this.editor;
      const { $from, empty } = state.selection;
      if (!empty || !$from.parent.isTextblock) return false;
      const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
      const m = before.match(/[A-Za-z~]+$/);
      if (!m) return false;
      const out = this.options.convert(m[0]);
      if (out === m[0]) return false;
      view.dispatch(state.tr.insertText(out, $from.pos - m[0].length, $from.pos));
      return false; // let Enter continue normally
    };
    return {
      Enter: convertPending,
      'Mod-Shift-Space': () => { this.options.onToggle(); return true; },
    };
  },
  addProseMirrorPlugins() {
    const ext = this;
    return [new Plugin({
      props: {
        handleTextInput(view, from, to, text) {
          if (!ext.options.enabled() || !/^[\s.,!?;:'"“”‘’()\-–—…।॥]$/.test(text)) return false;
          const $from = view.state.doc.resolve(from);
          if (!$from.parent.isTextblock) return false;
          const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
          const m = before.match(/[A-Za-z~]+$/);
          if (!m) return false;
          const out = ext.options.convert(m[0]);
          view.dispatch(view.state.tr.insertText(out + text, from - m[0].length, to));
          return true;
        },
      },
    })];
  },
});

// Index entry: an invisible mark in the text (shown as a small ◆ in the editor).
export const IndexMark = Node.create({
  name: 'indexMark',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    const a = (name, html) => ({ default: '', parseHTML: (el) => el.getAttribute(html) || '', renderHTML: (v) => (v[name] ? { [html]: v[name] } : {}) });
    return {
      id: { default: '', parseHTML: (el) => el.getAttribute('data-id') || '', renderHTML: (v) => ({ 'data-id': v.id || Math.random().toString(36).slice(2, 10) }) },
      term: a('term', 'data-term'), sub: a('sub', 'data-sub'), see: a('see', 'data-see'), seeAlso: a('seeAlso', 'data-see-also'),
    };
  },
  parseHTML() { return [{ tag: 'span[data-type="index"]' }]; },
  renderHTML({ HTMLAttributes, node }) {
    const a = node.attrs;
    const title = `Index: ${a.term}${a.sub ? ` › ${a.sub}` : ''}${a.see ? ` (see ${a.see})` : ''}${a.seeAlso ? ` (see also ${a.seeAlso})` : ''}`;
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'index', class: 'ix-mark', title })];
  },
  addCommands() {
    return { insertIndexMark: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { id: Math.random().toString(36).slice(2, 10), ...attrs } }) };
  },
});

// Cross-reference to a chapter, heading or figure: "see page N" in print, a link in the ebook.
export const CrossRef = Node.create({
  name: 'crossRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      target: { default: '', parseHTML: (el) => el.getAttribute('data-target') || '', renderHTML: (v) => ({ 'data-target': v.target }) },
      label: { default: '', parseHTML: (el) => el.getAttribute('data-label') || '', renderHTML: (v) => ({ 'data-label': v.label }) },
    };
  },
  parseHTML() { return [{ tag: 'span[data-type="xref"]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'xref', class: 'xref-chip' })]; },
  addCommands() {
    return { insertCrossRef: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs }) };
  },
});

// A note to self: a small marker with a tooltip. Never printed or exported.
export const AuthorNote = Node.create({
  name: 'authorNote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { text: { default: '', parseHTML: (el) => el.getAttribute('data-text') || '', renderHTML: (v) => ({ 'data-text': v.text }) } };
  },
  parseHTML() { return [{ tag: 'span[data-type="authornote"]' }]; },
  renderHTML({ HTMLAttributes, node }) { return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'authornote', class: 'author-note', title: `Note to self: ${node.attrs.text}` })]; },
  addCommands() {
    return { insertAuthorNote: (text) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { text } }) };
  },
});

// Highlights the sentence being read aloud.
export const readAloudKey = new PluginKey('readAloud');
export const ReadAloudHighlight = Extension.create({
  name: 'readAloudHighlight',
  addProseMirrorPlugins() {
    const key = readAloudKey;
    return [new Plugin({
      key,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, set) {
          const r = tr.getMeta(key);
          if (r === null) return DecorationSet.empty;
          if (r) return DecorationSet.create(tr.doc, [Decoration.inline(r.from, r.to, { class: 'read-aloud-now' })]);
          return set.map(tr.mapping, tr.doc);
        },
      },
      props: { decorations(state) { return key.getState(state); } },
    })];
  },
  addCommands() {
    // range { from, to } highlights; null clears
    return { setReadAloudRange: (range) => ({ tr, dispatch }) => { if (dispatch) tr.setMeta(readAloudKey, range).setMeta('addToHistory', false); return true; } };
  },
});

// Character styles: named inline styles defined once in Format (span.cs-<id>).
export const CharStyle = Mark.create({
  name: 'charStyle',
  excludes: 'charStyle',
  addAttributes() {
    return { cs: { default: '', parseHTML: (el) => el.getAttribute('data-cs') || (el.className.match(/\bcs-([\w-]+)/) || [])[1] || '', renderHTML: (a) => ({ 'data-cs': a.cs, class: `cs-${a.cs}` }) } };
  },
  parseHTML() { return [{ tag: 'span[data-cs]' }, { tag: 'span', getAttrs: (el) => (/\bcs-[\w-]+/.test(el.className) ? {} : false) }]; },
  renderHTML({ HTMLAttributes }) { return ['span', HTMLAttributes, 0]; },
  addCommands() {
    return {
      setCharStyle: (cs) => ({ commands }) => (cs ? commands.setMark(this.name, { cs }) : commands.unsetMark(this.name)),
      unsetCharStyle: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
});

// Block options: print-only / ebook-only content, and layout overrides for fixing page breaks.
const dataAttr = (name, attr, parse = (v) => v) => ({ default: null, parseHTML: (el) => (el.hasAttribute(attr) ? parse(el.getAttribute(attr)) : null), renderHTML: (a) => (a[name] == null || a[name] === false || a[name] === '' ? {} : { [attr]: a[name] === true ? 'true' : String(a[name]) }) });
export const BlockOptions = Extension.create({
  name: 'blockOptions',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading', 'blockquote', 'image', 'bulletList', 'orderedList'],
      attributes: {
        only: dataAttr('only', 'data-only'),
        keepNext: dataAttr('keepNext', 'data-keep-next', () => true),
        keepLines: dataAttr('keepLines', 'data-keep-lines', () => true),
        breakBefore: dataAttr('breakBefore', 'data-break-before', () => true),
        tracking: dataAttr('tracking', 'data-tracking', (v) => +v || null),
      },
    }];
  },
  addCommands() {
    // set an option on the blocks touched by the selection (top-level blocks)
    return {
      setBlockOption: (key, value) => ({ tr, state, dispatch }) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos, parent) => {
          if (parent !== state.doc) return false;
          if (!node.type.spec.attrs?.[key] && !(key in node.attrs)) return false;
          tr.setNodeMarkup(pos, null, { ...node.attrs, [key]: value });
          changed = true;
          return false;
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      },
    };
  },
});

// Editor-only badges on blocks with options, so print-only text and layout fixes are never forgotten.
export const BlockBadges = Extension.create({
  name: 'blockBadges',
  addProseMirrorPlugins() {
    const build = (doc) => {
      const decos = [];
      doc.forEach((node, offset) => {
        const a = node.attrs || {};
        const chips = [];
        if (a.only) chips.push([a.only === 'print' ? 'Print only' : 'Ebook only', `only-${a.only}`]);
        if (a.keepNext) chips.push(['Keep with next', 'fix']);
        if (a.keepLines) chips.push(['Keep lines together', 'fix']);
        if (a.breakBefore) chips.push(['Page break before', 'fix']);
        if (a.tracking) chips.push([`Tracking ${a.tracking > 0 ? '+' : ''}${a.tracking}`, 'fix']);
        if (!chips.length) return;
        decos.push(Decoration.node(offset, offset + node.nodeSize, { class: `has-block-badge${a.only ? ` block-only-${a.only}` : ''}` }));
        decos.push(Decoration.widget(offset + (node.isLeaf ? 0 : 1), () => {
          const box = document.createElement('span');
          box.className = 'block-badges';
          box.contentEditable = 'false';
          for (const [t, c] of chips) { const s = document.createElement('span'); s.className = `block-badge ${c}`; s.textContent = t; box.appendChild(s); }
          return box;
        }, { side: -1, ignoreSelection: true, key: chips.map((c) => c[0]).join('|') }));
      });
      return DecorationSet.create(doc, decos);
    };
    return [new Plugin({
      state: { init: (_, st) => build(st.doc), apply: (tr, set) => (tr.docChanged ? build(tr.doc) : set) },
      props: { decorations(state) { return this.getState(state); } },
    })];
  },
});
