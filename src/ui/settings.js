// App-wide settings: appearance, proofing, personal dictionary, custom fonts, shortcuts.
import { h, btn, icon, iconBtn, modal, toggle, field, pickFile, toast, segmented, clear, add } from './dom.js';
import { state, setApp } from '../core/store.js';
import { addCustomFont, removeCustomFont, BUNDLED_FONTS, fontStack } from '../core/fonts.js';
import { removeFromDictionary } from '../lang/spell.js';

export const SHORTCUTS = [
  ['Bold / Italic / Underline', 'Ctrl B / I / U'],
  ['Small caps', 'Ctrl Shift K'],
  ['Heading 1 / 2 / 3', 'Ctrl Alt 1 / 2 / 3'],
  ['Body paragraph', 'Ctrl Alt 0'],
  ['Scene break', 'Ctrl Alt 8'],
  ['Page break', 'Ctrl Enter'],
  ['Find & replace', 'Ctrl F'],
  ['Save now', 'Ctrl S'],
  ['Focus mode', 'Ctrl Shift F'],
  ['Next / previous chapter', 'Alt ↓ / Alt ↑'],
  ['Rephrase selected sentence', 'Ctrl Alt R'],
  ['Align left / centre / right / justify', 'Ctrl Shift L / E / R / J'],
  ['Undo / Redo', 'Ctrl Z / Ctrl Shift Z'],
];

export function openSettings(tab = 'general') {
  const body = h('div');
  const tabs = segmented([['general', 'General'], ['proofing', 'Proofing'], ['fonts', 'Fonts'], ['keys', 'Shortcuts'], ['about', 'About']], tab, (t) => draw(t));
  function draw(t) {
    clear(body);
    if (t === 'general') {
      add(body, 
        field('Appearance', segmented([['light', 'Light', 'sun'], ['sepia', 'Sepia', 'coffee'], ['dark', 'Dark', 'moon']].map(([v, l, i]) => [v, l]), state.app.theme, (v) => setApp({ theme: v }))),
        h('div.col', { style: { gap: '12px', marginTop: '6px' } },
          toggle(state.app.typewriter, (v) => setApp({ typewriter: v }), 'Typewriter scrolling (keep the cursor line centred)'),
          toggle(state.app.smartQuotes !== false, (v) => setApp({ smartQuotes: v }), 'Smart quotes & dashes while typing (“ ” ‘ ’ —)'),
        ),
        h('p.hint', { style: { marginTop: '16px' } }, 'Your books are saved automatically in this browser’s private storage. Use “Download backup” in the Publish tab to keep a copy elsewhere.'),
      );
    }
    if (t === 'proofing') {
      const dict = h('div', { style: { maxHeight: '220px', overflow: 'auto', border: '1px solid var(--border)', borderRadius: '8px' } });
      const drawDict = () => {
        clear(dict);
        const words = [...(state.app.dictionary || [])].sort();
        if (!words.length) dict.appendChild(h('p.muted', { style: { padding: '10px 12px', margin: 0 } }, 'No words yet. Right-click a flagged word → “Add to dictionary”.'));
        words.forEach((w) => dict.appendChild(h('div.row', { style: { padding: '5px 8px 5px 12px', borderBottom: '1px solid var(--border)' } }, h('span.grow', w), iconBtn('x', 'Remove', () => { removeFromDictionary(w); drawDict(); }))));
      };
      drawDict();
      add(body, 
        h('div.col', { style: { gap: '12px' } },
          toggle(state.app.spellcheck, (v) => setApp({ spellcheck: v }), 'Check spelling (offline English dictionary)'),
          toggle(state.app.grammar, (v) => setApp({ grammar: v }), 'Check grammar & punctuation'),
          toggle(state.app.styleHints, (v) => setApp({ styleHints: v }), 'Style suggestions (wordiness, passive voice, clichés, weak words)'),
          toggle(state.app.fictionHints !== false, (v) => setApp({ fictionHints: v }), 'Fiction hints (filter words like “felt”, “saw”, “realized”)'),
        ),
        h('div.section-title', { style: { marginTop: '22px' } }, 'Personal dictionary'),
        dict,
        state.app.ignored?.length ? btn(`Clear ${state.app.ignored.length} ignored word(s)`, { kind: 'ghost', cls: 'btn-sm', onClick: () => { setApp({ ignored: [] }); toast('Ignored words cleared'); } }) : null,
      );
    }
    if (t === 'fonts') {
      const list = h('div.col', { style: { gap: '6px' } });
      const drawFonts = () => {
        clear(list);
        state.app.customFonts.forEach((f) => list.appendChild(h('div.row.card', { style: { padding: '8px 12px' } },
          h('span.grow.font-sample', { style: { fontFamily: fontStack(f.name) } }, f.name), iconBtn('trash', 'Remove font', () => { removeCustomFont(f.name); drawFonts(); }))));
        if (!state.app.customFonts.length) list.appendChild(h('p.muted', 'No custom fonts yet.'));
      };
      drawFonts();
      add(body, 
        h('p.muted', `${BUNDLED_FONTS.length} professional book fonts are built in and work offline. You can also add your own (.ttf, .otf, .woff, .woff2) — make sure the licence allows embedding in books.`),
        btn('Add font file…', { icon: 'plus', kind: 'primary', onClick: async () => {
          const files = await pickFile('.ttf,.otf,.woff,.woff2', { multiple: true });
          for (const f of files || []) { const n = await addCustomFont(f); toast(`Added “${n}”`, 'success'); }
          drawFonts();
        } }),
        h('div.section-title', { style: { marginTop: '18px' } }, 'Your fonts'), list,
        h('div.section-title', { style: { marginTop: '18px' } }, 'Built-in fonts'),
        h('div', { style: { columns: 2, fontSize: '15px' } }, BUNDLED_FONTS.map((f) => h('div', { style: { fontFamily: fontStack(f), padding: '3px 0' } }, f))),
      );
    }
    if (t === 'keys') {
      add(body, h('div.shortcut-grid', SHORTCUTS.flatMap(([a, k]) => [h('span', a), h('span', k.split(' / ').map((x, i) => [i ? ' / ' : '', h('span.kbd', x)]))])));
    }
    if (t === 'about') {
      add(body, 
        h('div.row', { style: { gap: '14px', marginBottom: '12px' } }, h('span.brand-mark', { style: { width: '48px', height: '48px' } }, icon('book-open', 26)),
          h('div', h('h3', { style: { margin: 0 } }, 'Booky'), h('span.muted', 'Offline book writing, formatting & publishing studio'))),
        h('p', 'Write your manuscript, organise chapters, check spelling and grammar, design a professional interior, create a cover and export print-ready PDF, EPUB, DOCX and more — completely offline.'),
        h('p.muted.small', 'Built with TipTap / ProseMirror, Paged.js, nspell + Hunspell English dictionary, Mammoth, JSZip and open-licence fonts (SIL OFL).'),
      );
    }
  }
  draw(tab);
  modal({ title: 'Settings', width: 620, body: [h('div', { style: { marginBottom: '16px' } }, tabs), body] });
}
