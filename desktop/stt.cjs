// Downloads a Whisper speech model once (from the sherpa-onnx releases on GitHub), keeps it in the app's folder,
// and recognises speech with it in a worker thread. No account or key; after the download it works offline.
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const https = require('node:https');
const { execFile } = require('node:child_process');
const { Worker } = require('node:worker_threads');

const MODELS = {
  tiny: { label: 'Fast', mb: 116 },
  base: { label: 'Balanced', mb: 208 },
  small: { label: 'Accurate', mb: 640 },
};
const root = () => path.join(app.getPath('userData'), 'speech');
const dirOf = (id) => path.join(root(), `sherpa-onnx-whisper-${id}`);
const installed = (id) => fs.existsSync(path.join(dirOf(id), `${id}-encoder.int8.onnx`)) && fs.existsSync(path.join(dirOf(id), `${id}-decoder.int8.onnx`));

function status() {
  return Object.fromEntries(Object.entries(MODELS).map(([id, m]) => [id, { ...m, installed: installed(id) }]));
}

// the packaged sherpa-onnx lives outside the app archive (asarUnpack) so a worker thread can load it
function sherpaPath() {
  return require.resolve('sherpa-onnx').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
}

function get(url, file, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Booky' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 6) {
        res.resume();
        resolve(get(new URL(res.headers.location, url).href, file, onProgress, redirects + 1));
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`Download failed (${res.statusCode})`)); return; }
      const total = +res.headers['content-length'] || 0;
      let got = 0, last = 0;
      const out = fs.createWriteStream(file);
      res.on('data', (c) => { got += c.length; if (Date.now() - last > 250) { last = Date.now(); onProgress(got, total); } });
      res.pipe(out);
      out.on('finish', () => out.close(() => { onProgress(total || got, total); resolve(); }));
      res.on('error', reject);
      out.on('error', reject);
    }).on('error', reject);
  });
}

let downloading = null;
async function download(id, onProgress) {
  if (!MODELS[id]) throw new Error('Unknown model');
  if (installed(id)) return { ok: true };
  if (downloading) throw new Error('A download is already running.');
  downloading = id;
  const tmp = path.join(root(), `${id}.tar.bz2`);
  try {
    fs.mkdirSync(root(), { recursive: true });
    await get(`https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-${id}.tar.bz2`, tmp, (got, total) => onProgress({ id, phase: 'download', got, total }));
    onProgress({ id, phase: 'unpack' });
    // macOS and Windows 10+ both ship bsdtar, which reads .tar.bz2
    await new Promise((resolve, reject) => execFile(process.platform === 'win32' ? 'tar.exe' : 'tar', ['-xjf', tmp, '-C', root()], { windowsHide: true }, (e) => (e ? reject(new Error('Couldn’t unpack the speech model.')) : resolve())));
    // keep only the small int8 files Booky uses
    for (const f of fs.readdirSync(dirOf(id))) if (/\.onnx$/.test(f) && !/int8/.test(f)) fs.rmSync(path.join(dirOf(id), f), { force: true });
    fs.rmSync(path.join(dirOf(id), 'test_wavs'), { recursive: true, force: true });
    if (!installed(id)) throw new Error('The speech model is incomplete.');
    return { ok: true };
  } finally {
    fs.rmSync(tmp, { force: true });
    downloading = null;
  }
}

function remove(id) {
  stopWorker();
  fs.rmSync(dirOf(id), { recursive: true, force: true });
  return { ok: true };
}

let worker = null, workerId = null, seq = 0;
const pending = new Map();
function stopWorker() { if (worker) { worker.terminate(); worker = null; workerId = null; } }
function ensureWorker(id) {
  if (worker && workerId === id) return worker;
  stopWorker();
  worker = new Worker(path.join(__dirname, 'stt-worker.cjs'), { workerData: { dir: dirOf(id), id, sherpaPath: sherpaPath() } });
  workerId = id;
  worker.on('message', (m) => { const p = pending.get(m.seq); if (p) { pending.delete(m.seq); m.error ? p.reject(new Error(m.error)) : p.resolve(m); } });
  worker.on('error', (e) => { for (const p of pending.values()) p.reject(e); pending.clear(); worker = null; });
  return worker;
}

function recognize({ samples, sampleRate, language, model }) {
  const id = model && installed(model) ? model : Object.keys(MODELS).find(installed);
  if (!id) return Promise.reject(new Error('No speech model yet — download one in Settings → Voice & translation.'));
  const w = ensureWorker(id);
  return new Promise((resolve, reject) => {
    const n = ++seq;
    pending.set(n, { resolve, reject });
    w.postMessage({ seq: n, samples: Float32Array.from(samples), sampleRate, language: language || '' });
  });
}

module.exports = { status, download, remove, recognize, stopWorker };
