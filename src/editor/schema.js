// The set of editor extensions that defines what a Booky document can contain.
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { generateHTML, generateJSON } from '@tiptap/core';
import { ParagraphStyle, SceneBreak, PageBreak, Footnote, SmallCaps, BookImage, IndexMark, CrossRef, AuthorNote } from './extensions.js';

export function baseExtensions() {
  return [
    StarterKit.configure({
      horizontalRule: false,
      codeBlock: false,
      code: false,
      heading: { levels: [1, 2, 3, 4] },
      link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener', target: null } },
    }),
    TextStyleKit,
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    ParagraphStyle,
    SceneBreak,
    PageBreak,
    Footnote,
    SmallCaps,
    BookImage,
    IndexMark,
    CrossRef,
    AuthorNote,
  ];
}

let cached;
const exts = () => (cached ||= baseExtensions());

// Clean arbitrary HTML (imports, pastes) into Booky's document schema.
export function normalizeHtml(html) {
  try {
    return generateHTML(generateJSON(html || '<p></p>', exts()), exts());
  } catch (e) {
    console.warn('normalize failed', e);
    return html;
  }
}
