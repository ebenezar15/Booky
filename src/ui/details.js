// Book details (metadata) used on title/copyright pages, EPUB metadata and covers.
import { h, btn, modal, field, input, textarea, segmented, clear, select, add } from './dom.js';
import { state, touch } from '../core/store.js';

const LANGS = [['en', 'English'], ['en-GB', 'English (UK)'], ['en-US', 'English (US)'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['nl', 'Dutch'], ['sv', 'Swedish'], ['pl', 'Polish'], ['hi', 'Hindi'], ['ta', 'Tamil'], ['ja', 'Japanese'], ['zh', 'Chinese']];

export function openDetails(tab = 'basics') {
  const b = state.book;
  const m = b.meta;
  const set = (k) => (v) => { m[k] = v; touch('meta'); };
  const f = (label, key, attrs = {}, hint) => field(label, input(m[key], set(key), attrs), hint);
  const body = h('div');
  const draw = (t) => {
    clear(body);
    if (t === 'basics') add(body, 
      f('Title', 'title'),
      f('Subtitle', 'subtitle'),
      h('div.grid-2', f('Author / pen name', 'author'), f('Copyright holder', 'copyrightHolder', { placeholder: m.author || 'Defaults to author' })),
      h('div.grid-2', f('Series', 'series'), f('Number in series', 'seriesNumber', { placeholder: 'e.g. 1' })),
      h('div.grid-2', field('Language', select(LANGS, m.language, set('language'))), f('Genre', 'genre', { placeholder: 'e.g. Fantasy' })),
    );
    if (t === 'publishing') add(body, 
      h('div.grid-2', f('Publisher / imprint', 'publisher'), f('Publisher city', 'publisherCity')),
      f('Publisher website', 'publisherWebsite'),
      h('div.grid-2', f('ISBN — print', 'isbnPrint', { placeholder: '978-…' }), f('ISBN — ebook', 'isbnEbook', { placeholder: '978-…' })),
      h('div.grid-2', f('Edition', 'edition'), f('Copyright year', 'year')),
      h('p.hint', 'These fields fill the {{placeholders}} on your title page and copyright page automatically. Empty fields are hidden.'),
    );
    if (t === 'people') add(body, 
      f('Editor', 'editor'), f('Illustrator', 'illustrator'), f('Cover designer', 'coverDesigner'),
      f('Author website', 'website'),
      field('Author bio (used on “About the Author”)', textarea(m.authorBio, set('authorBio'), { rows: 5 })),
    );
    if (t === 'marketing') add(body, 
      field('Book description / blurb', textarea(m.description, set('description'), { rows: 7 }), 'Used in EPUB metadata and on the back cover.'),
      f('Keywords', 'keywords', { placeholder: 'comma, separated, keywords' }),
      f('Categories (BISAC / store categories)', 'categories', { placeholder: 'FICTION / Fantasy / Epic' }),
    );
  };
  draw(tab);
  const md = modal({
    title: 'Book details', width: 620,
    body: [h('div', { style: { marginBottom: '16px' } }, segmented([['basics', 'Basics'], ['publishing', 'Publishing'], ['people', 'Contributors'], ['marketing', 'Marketing']], tab, draw)), body],
    footer: [btn('Done', { kind: 'primary', onClick: () => md.close() })],
  });
}
