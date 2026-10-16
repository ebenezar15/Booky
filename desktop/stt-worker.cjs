// Speech recognition on this computer: Whisper (via sherpa-onnx, Apache-2.0) in a worker thread,
// so the app stays responsive while it listens. Whisper detects the spoken language by itself.
const { parentPort, workerData } = require('node:worker_threads');
const sherpa = require(workerData.sherpaPath);

const d = workerData.dir, id = workerData.id;
const recognizers = new Map();
function recognizer(language) {
  if (recognizers.has(language)) return recognizers.get(language);
  const r = sherpa.createOfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      whisper: { encoder: `${d}/${id}-encoder.int8.onnx`, decoder: `${d}/${id}-decoder.int8.onnx`, language, task: 'transcribe', tailPaddings: -1 },
      tokens: `${d}/${id}-tokens.txt`, numThreads: 1, provider: 'cpu', debug: 0,
    },
  });
  recognizers.set(language, r);
  return r;
}

parentPort.on('message', ({ seq, samples, sampleRate, language }) => {
  try {
    const r = recognizer(language || '');
    const s = r.createStream();
    s.acceptWaveform(sampleRate, samples);
    r.decode(s);
    const out = r.getResult(s);
    s.free();
    parentPort.postMessage({ seq, text: String(out.text || '').trim(), lang: out.lang || language || '' });
  } catch (e) {
    parentPort.postMessage({ seq, error: e.message });
  }
});
