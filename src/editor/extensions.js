// Custom TipTap extensions for book writing.
import { Node, Mark, Extension, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
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
