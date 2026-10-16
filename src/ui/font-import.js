// Importing fonts: font files, a folder, or a .zip — from Settings → Fonts or "＋ Import font files…" in any font menu.
import { h, icon, btn, iconBtn, clear, add, modal, toast } from './dom.js';
import { state } from '../core/store.js';
import { addCustomFonts, removeCustomFont, customFamilies, customFontStyles, fontStack } from '../core/fonts.js';

const ACCEPT = '.ttf,.otf,.woff,.woff2,.zip';

function chooseFiles({ folder = false } = {}) {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept: folder ? undefined : ACCEPT, multiple: true, style: { display: 'none' } });
    if (folder) { inp.webkitdirectory = true; inp.directory = true; }
    inp.addEventListener('change', () => { resolve([...inp.files]); inp.remove(); });
    inp.addEventListener('cancel', () => { resolve([]); inp.remove(); });
    document.body.appendChild(inp);
    inp.click();
  });
}

/** Import, report, and return the first family added (for "＋ Import font files…" in a menu). */
export async function importFonts(files) {
  if (!files?.length) return null;
  toast('Reading fonts…', 'info', 1200);
  const names = await addCustomFonts(files);
  if (!names.length) { toast('No font files found. Booky reads .ttf, .otf, .woff, .woff2 and .zip files of them.', 'warn', 6000); return null; }
  toast(names.length === 1 ? `Added “${names[0]}” (${customFontStyles(names[0]).join(', ')})` : `Added ${names.length} fonts: ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''}`, 'success', 4000);
  return names[0];
}

/** A small dialog: files, a folder, or a .zip — then apply the first family. */
export function importFontsFlow() {
  return new Promise((resolve) => {
    let done = false, busy = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    // the dialog closes while the files are read; only a plain close (Escape, ×) counts as cancelling
    const go = async (folder) => { busy = true; const files = await chooseFiles({ folder }); m.close(); finish(await importFonts(files)); };
    const drop = h('div.dropzone', { on: {
      click: () => go(false),
      dragover: (e) => { e.preventDefault(); drop.classList.add('over'); },
      dragleave: () => drop.classList.remove('over'),
      drop: async (e) => { e.preventDefault(); busy = true; m.close(); finish(await importFonts([...e.dataTransfer.files])); },
    } }, icon('upload', 28), h('div', h('b', 'Drop font files here, or click to choose')), h('small', '.ttf · .otf · .woff · .woff2 · or a .zip of them'));
    const m = modal({
      title: 'Import fonts', width: 520,
      body: [drop,
        h('div.row', { style: { gap: '8px', marginTop: '12px', flexWrap: 'wrap' } },
          btn('Choose files…', { icon: 'file-plus', onClick: () => go(false) }),
          btn('Choose a folder…', { icon: 'folder-open', onClick: () => go(true) })),
        h('p.hint', { style: { marginTop: '12px' } }, 'Add every style of a family (Regular, Bold, Italic, Bold Italic) and Booky groups them into one font, so bold and italic text use the real designs. Check the licence allows embedding the font in books and ebooks.')],
      onClose: () => { if (!busy) finish(null); },
    });
  });
}

/** Settings → Fonts: your imported families with their styles. */
export function yourFontsPanel() {
  const list = h('div.col', { style: { gap: '6px' } });
  const draw = () => {
    clear(list);
    const fams = customFamilies();
    if (!fams.length) list.appendChild(h('p.muted', 'No fonts imported yet.'));
    for (const name of fams) list.appendChild(h('div.row.card', { style: { padding: '8px 12px', gap: '10px' } },
      h('div.grow', h('div.font-sample', { style: { fontFamily: fontStack(name) } }, name), h('small.muted', customFontStyles(name).join(' · '))),
      iconBtn('trash', `Remove ${name}`, () => { removeCustomFont(name); draw(); })));
  };
  draw();
  return h('div',
    h('div.row', { style: { gap: '8px', flexWrap: 'wrap', marginBottom: '12px' } },
      btn('Import font files…', { icon: 'plus', kind: 'primary', onClick: async () => { await importFonts(await chooseFiles()); draw(); } }),
      btn('Import a folder…', { icon: 'folder-open', onClick: async () => { await importFonts(await chooseFiles({ folder: true })); draw(); } })),
    list);
}
export { state };
