// Book details (metadata) used on title/copyright pages, EPUB metadata and covers.
import { h, btn, modal, field, input, textarea, segmented, clear, select, add } from './dom.js';
import { state, touch } from '../core/store.js';
import { LANGUAGES, langInfo, applyLanguageDesign } from '../core/languages.js';
import { confirmDialog, toast } from './dom.js';
import { parseIsbn, isbnFindings } from '../core/isbn.js';

const LANGS = LANGUAGES.map((l) => [l.code, l.native === l.name ? l.name : `${l.name} — ${l.native}`]);

export function openDetails(tab = 'basics') {
  const b = state.book;
  const m = b.meta;
  const set = (k) => (v) => { m[k] = v; touch('meta'); };
  const f = (label, key, attrs = {}, hint) => field(label, input(m[key], set(key), attrs), hint);
  // ISBN field with live feedback (check digit, ISBN-10 → 13, duplicates between formats).
  const isbnField = (label, key) => {
    const msg = h('small.hint.isbn-msg');
    const show = () => {
      const p = parseIsbn(m[key]);
      const dup = isbnFindings(m).find((x) => x.field === key && x.ok === 'warn');
      msg.textContent = p.empty ? '' : !p.ok ? `✗ ${p.message}` : dup ? `⚠ ${dup.text}` : `✓ ${p.message}`;
      msg.className = `hint isbn-msg ${p.empty ? '' : !p.ok ? 'bad' : dup ? 'warn' : 'ok'}`;
    };
    const i = input(m[key], (v) => { m[key] = v; touch('meta'); show(); body.querySelectorAll('.isbn-msg').forEach((n) => n.dispatchEvent(new Event('recheck'))); }, { placeholder: '978-…', inputmode: 'numeric' });
    i.addEventListener('blur', () => { const p = parseIsbn(m[key]); if (p.ok && p.formatted !== m[key]) { m[key] = p.formatted; i.value = p.formatted; touch('meta'); show(); } });
    msg.addEventListener('recheck', show);
    show();
    return h('label.field', h('span.field-label', label), i, msg);
  };
  const body = h('div');
  const draw = (t) => {
    clear(body);
    if (t === 'basics') add(body, 
      f('Title', 'title'),
      f('Subtitle', 'subtitle'),
      h('div.grid-2', f('Author / pen name', 'author'), f('Copyright holder', 'copyrightHolder', { placeholder: m.author || 'Defaults to author' })),
      h('div.grid-2', f('Series', 'series'), f('Number in series', 'seriesNumber', { placeholder: 'e.g. 1' })),
      h('div.grid-2', field('Language', select(LANGS, m.language, async (v) => {
        m.language = v; touch('meta');
        const L = langInfo(v);
        if (await confirmDialog(`Set up the book for ${L.name}?`, `Switch the fonts to ${L.body} / ${L.heading}, use “${L.labels.chapter}” for chapter numbers and “${L.labels.contents}” for the contents page${L.dir === 'rtl' ? ', and lay pages out right-to-left' : ''}. You can change everything afterwards in Format.`, { okLabel: 'Apply' })) {
          applyLanguageDesign(b, v); touch('format'); touch('elements'); toast('Book set up for ' + L.name, 'success');
        }
      })), f('Genre', 'genre', { placeholder: 'e.g. Fantasy' })),
    );
    if (t === 'publishing') add(body, 
      h('div.grid-2', f('Publisher / imprint', 'publisher'), f('Publisher city', 'publisherCity')),
      f('Publisher website', 'publisherWebsite'),
      h('div.grid-2', isbnField('ISBN — paperback', 'isbnPrint'), isbnField('ISBN — hardcover', 'isbnHardcover')),
      h('div.grid-2', isbnField('ISBN — ebook', 'isbnEbook'), h('div')),
      h('p.hint', 'Each format needs its own ISBN. KDP can assign free ISBNs for paperback and hardcover; IngramSpark needs one you own. ISBN-10s are converted to ISBN-13 when you leave the field.'),
      h('div.grid-2', f('Edition', 'edition'), f('Copyright year', 'year')),
      h('p.hint', 'These fields fill the {{placeholders}} on your title page and copyright page automatically. Empty fields are hidden.'),
    );
    if (t === 'people') add(body, 
      h('div.grid-2', f('Editor', 'editor'), f('Illustrator', 'illustrator')),
      h('div.grid-2', f('Cover designer', 'coverDesigner'), f('Translator', 'translator')),
      field('Other contributors', textarea(m.contributors, set('contributors'), { rows: 3, placeholder: 'One per line, e.g.\nPriya Raman — Foreword\nArun K — Photographs' }), 'Name — role. Listed in the platform metadata sheet.'),
      f('Author website', 'website'),
      field('Author bio (used on “About the Author”)', textarea(m.authorBio, set('authorBio'), { rows: 5 })),
    );
    if (t === 'marketing') add(body, 
      field('Book description / blurb', textarea(m.description, set('description'), { rows: 7 }), 'Used in EPUB metadata and on the back cover.'),
      f('Keywords', 'keywords', { placeholder: 'comma, separated, keywords' }, 'KDP lets you enter up to 7 keywords or short phrases (50 characters each).'),
      f('Categories (store categories)', 'categories', { placeholder: 'FICTION / Fantasy / Epic' }),
      f('BISAC subject codes', 'bisac', { placeholder: 'FIC009000, FIC002000' }, 'Up to 3 codes from bisg.org, used by IngramSpark, B&N and libraries.'),
      h('div.grid-2', f('Reading age — from', 'ageMin', { type: 'number', min: 0, max: 18, placeholder: 'e.g. 8' }), f('Reading age — to', 'ageMax', { type: 'number', min: 0, max: 18, placeholder: 'e.g. 12' })),
    );
  };
  draw(tab);
  const md = modal({
    title: 'Book details', width: 620,
    body: [h('div', { style: { marginBottom: '16px' } }, segmented([['basics', 'Basics'], ['publishing', 'Publishing'], ['people', 'Contributors'], ['marketing', 'Marketing']], tab, draw)), body],
    footer: [btn('Done', { kind: 'primary', onClick: () => md.close() })],
  });
}
