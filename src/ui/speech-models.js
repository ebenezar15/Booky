// Settings → Voice & translation, desktop app: download a Whisper model so voice typing works in any language,
// detects the language by itself, and runs on this computer.
import { h, btn, clear, add, toast, confirmDialog } from './dom.js';
import { state, setApp } from '../core/store.js';

export function speechModelsPanel() {
  const d = globalThis.bookyDesktop;
  const box = h('div.col', { style: { gap: '8px' } });
  if (!d?.sttStatus) {
    add(box, h('p.small.muted', 'In the Booky desktop app you can download a speech model that recognises any language on your computer and detects which one you speak.'));
    return box;
  }
  let progress = null;
  const off = d.onSttProgress((p) => { progress = p; drawProgress(); });
  const bar = h('div.progress', h('div', { style: { width: '0%' } }));
  const barText = h('span.small.muted');
  const drawProgress = () => {
    if (!progress) return;
    const pct = progress.phase === 'download' && progress.total ? Math.round((progress.got / progress.total) * 100) : 100;
    bar.firstChild.style.width = `${pct}%`;
    barText.textContent = progress.phase === 'download' ? `Downloading… ${pct}% (${Math.round((progress.got || 0) / 1048576)} of ${Math.round((progress.total || 0) / 1048576)} MB)` : 'Unpacking…';
  };
  const draw = async () => {
    const st = await d.sttStatus();
    clear(box);
    add(box, h('p.small', 'Booky recognises your speech on this computer with Whisper — in any language, and it can tell which language you are speaking. The model is downloaded once from GitHub; after that it works offline.'));
    for (const [id, m] of Object.entries(st)) {
      const using = state.app.localSpeechModel === id;
      add(box, h('div.row.card', { style: { padding: '10px 12px', gap: '10px', alignItems: 'center' } },
        h('div.grow', h('b', `${m.label}`), h('small.muted', { style: { display: 'block' } }, `${m.mb} MB · ${{ tiny: 'quickest, good for English and major languages', base: 'a good balance for most languages', small: 'best for Tamil, Hindi, Urdu and other languages; slower' }[id]}`)),
        m.installed
          ? h('div.row', { style: { gap: '6px' } },
            using ? h('span.badge', 'In use') : btn('Use', { cls: 'btn-sm', onClick: () => { setApp({ localSpeechModel: id }); draw(); } }),
            btn('Delete', { cls: 'btn-sm', kind: 'ghost', onClick: async () => { if (!(await confirmDialog('Delete speech model?', `The ${m.label} model (${m.mb} MB) will be removed from this computer. You can download it again later.`, { okLabel: 'Delete', danger: true }))) return; await d.sttDelete(id); if (using) setApp({ localSpeechModel: '' }); draw(); } }))
          : btn(`Download`, { cls: 'btn-sm', kind: 'primary', icon: 'download', onClick: async (e) => {
            e.currentTarget.disabled = true;
            progress = { phase: 'download', got: 0, total: m.mb * 1048576 };
            add(box, bar, barText); drawProgress();
            try {
              await d.sttDownload(id);
              setApp({ localSpeechModel: id, voiceEngine: state.app.voiceEngine === 'browser' ? 'auto' : state.app.voiceEngine });
              toast(`${m.label} speech model ready — voice typing now works in any language`, 'success', 5000);
            } catch (err) { toast(`Download didn’t finish: ${err.message}`, 'error', 7000); }
            progress = null;
            draw();
          } })));
    }
  };
  draw();
  return box;
}
