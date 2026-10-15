// App-wide settings: appearance, proofing, personal dictionary, custom fonts, shortcuts.
import { h, btn, icon, iconBtn, modal, toggle, field, pickFile, toast, segmented, clear, add, input } from './dom.js';
import { state, setApp } from '../core/store.js';
import { addCustomFont, removeCustomFont, BUNDLED_FONTS, fontStack, SYSTEM_FONTS, isInstalled, scanComputerFonts, canScanFonts, lookalikeFor } from '../core/fonts.js';
import { removeFromDictionary } from '../lang/spell.js';
import { appearancePanel } from './appearance.js';
import { translationSettingsPanel } from './translate.js';
import { cloudSettingsPanel } from './cloud-settings.js';
import { backupSettingsPanel } from './backup-ui.js';
import { dictionaryPanel } from './editing-tools.js';

export const SHORTCUTS = [
  ['Bold / Italic / Underline', 'Ctrl B / I / U'],
  ['Small caps', 'Ctrl Shift K'],
  ['Heading 1 / 2 / 3', 'Ctrl Alt 1 / 2 / 3'],
  ['Body paragraph', 'Ctrl Alt 0'],
  ['Scene break', 'Ctrl Alt 8'],
  ['Page break', 'Ctrl Enter'],
  ['Find & replace', 'Ctrl F'],
  ['Quick jump (chapters, headings, story bible, “p 142”)', 'Ctrl P'],
  ['Read aloud from the cursor', 'Ctrl Alt A'],
  ['Save now', 'Ctrl S'],
  ['Focus mode', 'Ctrl Shift F'],
  ['Next / previous chapter', 'Alt ↓ / Alt ↑'],
  ['Rephrase selected sentence', 'Ctrl Alt R'],
  ['Align left / centre / right / justify', 'Ctrl Shift L / E / R / J'],
  ['Phonetic typing on / off (Indian languages)', 'Ctrl Shift Space'],
  ['Voice typing on / off', 'Ctrl Alt V'],
  ['Translate / suggest wording for the selection', 'Ctrl Alt T'],
  ['Undo / Redo', 'Ctrl Z / Ctrl Shift Z'],
];

export function openSettings(tab = 'general') {
  const body = h('div');
  const tabs = segmented([['general', 'General'], ['backups', 'Backups'], ['proofing', 'Proofing'], ['fonts', 'Fonts'], ['translate', 'Voice & translation'], ['cloud', 'Online sharing'], ['keys', 'Shortcuts'], ['about', 'About']], tab, (t) => draw(t));
  function draw(t) {
    clear(body);
    if (t === 'general') {
      add(body, 
        appearancePanel(),
        h('div.col', { style: { gap: '12px', marginTop: '6px' } },
          toggle(state.app.typewriter, (v) => setApp({ typewriter: v }), 'Typewriter scrolling (keep the cursor line centred)'),
          toggle(state.app.smartQuotes !== false, (v) => setApp({ smartQuotes: v }), 'Smart quotes & dashes while typing (“ ” ‘ ’ —)'),
          toggle(state.app.animations !== false, (v) => setApp({ animations: v }), 'Animations (page turns, transitions, celebrations)'),
        ),
        field('Your name (signs tracked changes and comments)', input(state.app.authorName || '', (v) => setApp({ authorName: v.trim() }), { placeholder: state.book?.meta.author || 'e.g. Ann Example' })),
        h('p.hint', { style: { marginTop: '16px' } }, 'Your books are saved automatically in this browser’s private storage. Set up automatic folder backups in the Backups tab, or use “Download backup” to keep a copy elsewhere.'),
      );
    }
    if (t === 'backups') add(body, backupSettingsPanel());
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
        h('div', { style: { marginTop: '18px' } }, dictionaryPanel()),
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
        h('div.section-title', { style: { marginTop: '18px' } }, 'Fonts on this computer'),
        h('p.muted.small', 'Fonts that came with your Mac or Windows PC (Avenir Next, Baskerville, Didot, Futura, Palatino, Segoe UI…) appear in every font menu under “On this computer”. They print perfectly from this computer. Ebooks can’t carry them (their licence doesn’t allow it), so ebooks use the free look-alike shown in brackets.'),
        h('div.sys-fonts', SYSTEM_FONTS.filter(isInstalled).map((f) => h('div', { style: { fontFamily: fontStack(f) }, title: lookalikeFor(f) ? `Ebooks use ${lookalikeFor(f)}` : '' }, f, lookalikeFor(f) ? h('small.muted', ` → ${lookalikeFor(f)}`) : null))),
        canScanFonts() ? btn(state.app.computerFonts?.length ? `Rescan all fonts (${state.app.computerFonts.length} found)` : 'Show every font on this computer…', { icon: 'search', onClick: async () => {
          try { const n = await scanComputerFonts(); toast(n ? `${n.length} fonts found — they’re now in every font menu` : 'This browser can’t list fonts', n ? 'success' : 'warn'); } catch { toast('Font access was blocked. Allow it when the browser asks, then try again.', 'warn', 6000); }
        } }) : null,
        h('div.section-title', { style: { marginTop: '18px' } }, 'Built-in fonts'),
        h('div', { style: { columns: 2, fontSize: '15px' } }, BUNDLED_FONTS.map((f) => h('div', { style: { fontFamily: fontStack(f), padding: '3px 0' } }, f))),
      );
    }
    if (t === 'translate') add(body, translationSettingsPanel());
    if (t === 'cloud') add(body, cloudSettingsPanel());
    if (t === 'keys') {
      add(body, h('div.shortcut-grid', SHORTCUTS.flatMap(([a, k]) => [h('span', a), h('span', k.split(' / ').map((x, i) => [i ? ' / ' : '', h('span.kbd', x)]))])));
    }
    if (t === 'about') {
      add(body, 
        h('div.row', { style: { gap: '14px', marginBottom: '12px' } }, h('span.brand-mark', { style: { width: '48px', height: '48px' } }, icon('book-open', 26)),
          h('div', h('h3.logo-word', { style: { margin: 0, fontSize: '22px' } }, 'Booky'), h('span.muted', 'Offline book writing, formatting & publishing studio'))),
        h('p', 'Write your manuscript, organise chapters, check spelling and grammar, design a professional interior, create a cover and export print-ready PDF, EPUB, DOCX and more — completely offline.'),
        h('p.muted.small', 'Built with TipTap / ProseMirror, Paged.js, nspell + Hunspell English dictionary, Mammoth, JSZip and open-licence fonts (SIL OFL).'),
      );
    }
  }
  draw(tab);
  modal({ title: 'Settings', width: 720, body: [h('div', { style: { marginBottom: '16px' } }, tabs), body] });
}
