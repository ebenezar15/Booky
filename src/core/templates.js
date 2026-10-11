// Starter book templates (structure + design theme) shown on "New Book".
import { createBook, createElement } from './model.js';

const ch = (title = '', content) => createElement('chapter', { title, ...(content ? { content } : {}) });
const p = (t) => `<p>${t}</p>`;

export const BOOK_TEMPLATES = [
  {
    id: 'novel', name: 'Novel', theme: 'classic', icon: 'book-open-text',
    desc: 'Fiction with full front & back matter and numbered chapters.',
    build: () => [
      'half-title', 'also-by', 'title', 'copyright', 'dedication', 'epigraph', 'toc',
    ].map((t) => createElement(t)).concat([
      createElement('prologue'),
      ch('', `<p class="ps-noindent">It began, as most things do, with a door that should have stayed closed.</p>${p('Start writing your story here. Use the toolbar above to format text, insert scene breaks, images and more.')}`),
      ch(), ch(),
      createElement('epilogue'),
      createElement('acknowledgments'), createElement('about-author'), createElement('newsletter'),
    ]),
  },
  {
    id: 'novel-parts', name: 'Novel in Parts', theme: 'fantasy', icon: 'layers',
    desc: 'Epic structure with part dividers, maps and glossary.',
    build: () => [
      createElement('half-title'), createElement('title'), createElement('copyright'), createElement('dedication'), createElement('toc'),
      createElement('frontispiece', { title: 'Map' }),
      createElement('part', { title: 'The Gathering Storm' }), ch(), ch(),
      createElement('part', { title: 'The Long Road' }), ch(), ch(),
      createElement('part', { title: 'The Reckoning' }), ch(),
      createElement('glossary'), createElement('acknowledgments'), createElement('about-author'),
    ],
  },
  {
    id: 'nonfiction', name: 'Non-fiction', theme: 'nonfiction', icon: 'graduation-cap',
    desc: 'Foreword, introduction, chapters, notes and bibliography.',
    build: () => [
      createElement('half-title'), createElement('title'), createElement('copyright'), createElement('dedication'), createElement('toc'),
      createElement('foreword'), createElement('introduction'),
      ch('The Problem', `<p class="ps-noindent">Lead with the question your reader came here to answer.</p><h2>A Section Heading</h2><p>Use Heading 2 and 3 for sub-sections; they appear in the ebook navigation.</p>`),
      ch('The Framework'), ch('Putting It Into Practice'),
      createElement('afterword'), createElement('acknowledgments'), createElement('endnotes'), createElement('bibliography'), createElement('index'), createElement('about-author'),
    ],
  },
  {
    id: 'memoir', name: 'Memoir', theme: 'memoir', icon: 'feather',
    desc: 'Personal story with preface, chapters and reading guide.',
    build: () => [
      createElement('half-title'), createElement('title'), createElement('copyright'), createElement('dedication'), createElement('epigraph'), createElement('toc'),
      createElement('preface'), ch('Where It Started'), ch('The Years Between'), ch('Coming Home'),
      createElement('acknowledgments'), createElement('book-club'), createElement('about-author'),
    ],
  },
  {
    id: 'poetry', name: 'Poetry Collection', theme: 'poetry', icon: 'pen-tool',
    desc: 'Each poem is its own page with verse formatting.',
    build: () => [
      createElement('title'), createElement('copyright'), createElement('dedication'), createElement('toc'),
      ...['First Light', 'Salt and Iron', 'Small Hours'].map((t) => createElement('chapter', {
        title: t, numbered: false,
        content: '<p class="ps-verse">Write the first line of the poem,<br>and the second one beneath it,<br>let white space do its quiet work.</p><p class="ps-verse">A new stanza begins here.</p>',
      })),
      createElement('acknowledgments'), createElement('about-author'),
    ],
  },
  {
    id: 'children', name: "Children's Chapter Book", theme: 'children', icon: 'baby',
    desc: 'Large type, illustrations and short chapters.',
    build: () => [
      createElement('title'), createElement('copyright'), createElement('dedication'), createElement('toc'),
      ch('The Big Adventure'), ch('A Surprising Friend'), ch('Home Again'), createElement('about-author'),
    ],
  },
  {
    id: 'stories', name: 'Short Story Collection', theme: 'literary', icon: 'library',
    desc: 'Titled, unnumbered stories with an introduction.',
    build: () => [
      createElement('half-title'), createElement('title'), createElement('copyright'), createElement('toc'), createElement('introduction'),
      createElement('chapter', { title: 'The First Story', numbered: false }),
      createElement('chapter', { title: 'The Second Story', numbered: false }),
      createElement('chapter', { title: 'The Third Story', numbered: false }),
      createElement('acknowledgments'), createElement('about-author'),
    ],
  },
  {
    id: 'academic', name: 'Textbook / Academic', theme: 'academic', icon: 'flask-conical',
    desc: 'Preface, numbered chapters, appendix, glossary and index.',
    build: () => [
      createElement('title'), createElement('copyright'), createElement('toc'), createElement('list-figures'), createElement('preface'),
      ch('Foundations', '<p class="ps-noindent">Learning objectives…</p><h2>1.1 Key Concepts</h2><p>Text…</p>'), ch('Methods'), ch('Applications'),
      createElement('appendix'), createElement('glossary'), createElement('bibliography'), createElement('index'),
    ],
  },
  {
    id: 'blank', name: 'Blank Book', theme: 'classic', icon: 'file',
    desc: 'Just a title page and one chapter — build it your way.',
    build: () => [createElement('title'), createElement('copyright'), ch()],
  },
];

export function bookFromTemplate(tplId, meta = {}) {
  const tpl = BOOK_TEMPLATES.find((t) => t.id === tplId) || BOOK_TEMPLATES[0];
  const book = createBook({ theme: tpl.theme, meta });
  book.elements = tpl.build();
  book.template = tpl.id;
  return book;
}
