// Voice typing (speech to text).
// Engines:
//   browser — the Web Speech API (Chrome, Edge, Safari). Free; audio is processed by the browser maker's service.
//   google  — Google Cloud Speech-to-Text with your API key. Works everywhere, including the desktop app.
// Every Indian language Booky supports has a speech locale (ta-IN, hi-IN, ml-IN …).

export const VOICE_LOCALES = {
  en: [['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['en-IN', 'English (India)'], ['en-AU', 'English (Australia)'], ['en-CA', 'English (Canada)']],
  'en-GB': [['en-GB', 'English (UK)'], ['en-US', 'English (US)'], ['en-IN', 'English (India)']],
  ta: [['ta-IN', 'தமிழ் (India)'], ['ta-LK', 'தமிழ் (Sri Lanka)'], ['ta-SG', 'தமிழ் (Singapore)'], ['ta-MY', 'தமிழ் (Malaysia)']],
  hi: [['hi-IN', 'हिन्दी']], ml: [['ml-IN', 'മലയാളം']], te: [['te-IN', 'తెలుగు']], kn: [['kn-IN', 'ಕನ್ನಡ']],
  bn: [['bn-IN', 'বাংলা (India)'], ['bn-BD', 'বাংলা (Bangladesh)']], mr: [['mr-IN', 'मराठी']], gu: [['gu-IN', 'ગુજરાતી']],
  pa: [['pa-Guru-IN', 'ਪੰਜਾਬੀ']], or: [['or-IN', 'ଓଡ଼ିଆ']], as: [['as-IN', 'অসমীয়া']], sa: [['hi-IN', 'Sanskrit (via Hindi)']], ne: [['ne-NP', 'नेपाली']],
  ur: [['ur-IN', 'اردو (India)'], ['ur-PK', 'اردو (Pakistan)']], si: [['si-LK', 'සිංහල']], ar: [['ar-SA', 'العربية'], ['ar-EG', 'العربية (Egypt)']],
  es: [['es-ES', 'Español (España)'], ['es-MX', 'Español (México)'], ['es-US', 'Español (EE. UU.)']], fr: [['fr-FR', 'Français'], ['fr-CA', 'Français (Canada)']],
  de: [['de-DE', 'Deutsch']], it: [['it-IT', 'Italiano']], pt: [['pt-PT', 'Português'], ['pt-BR', 'Português (Brasil)']], nl: [['nl-NL', 'Nederlands']],
  sv: [['sv-SE', 'Svenska']], pl: [['pl-PL', 'Polski']], id: [['id-ID', 'Bahasa Indonesia']], sw: [['sw-KE', 'Kiswahili']], tr: [['tr-TR', 'Türkçe']], vi: [['vi-VN', 'Tiếng Việt']],
};

export const localesFor = (lang) => VOICE_LOCALES[lang] || VOICE_LOCALES[String(lang || 'en').split('-')[0]] || VOICE_LOCALES.en;

const SR = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
const isDesktopShell = () => !!globalThis.bookyDesktop; // Electron has no built-in speech service

export function availableEngines(keys = {}) {
  const out = [];
  if (SR() && !isDesktopShell()) out.push('browser');
  if (keys.googleKey && globalThis.MediaRecorder && navigator.mediaDevices?.getUserMedia) out.push('google');
  return out;
}

export function pickEngine(pref, keys) {
  const list = availableEngines(keys);
  if (pref && pref !== 'auto' && list.includes(pref)) return pref;
  return list[0] || null;
}

// ---------- spoken punctuation & tidy-up (pure; tested) ----------
const COMMANDS = [
  [/\s*\b(new paragraph)\b\s*/gi, '\n\n'], [/\s*\b(new line|next line)\b\s*/gi, '\n'],
  [/\s*\b(full stop|period)\b/gi, '.'], [/\s*\bcomma\b/gi, ','], [/\s*\bquestion mark\b/gi, '?'], [/\s*\bexclamation (mark|point)\b/gi, '!'],
  [/\s*\bcolon\b/gi, ':'], [/\s*\bsemicolon\b/gi, ';'], [/\s*\b(dash|em dash)\b\s*/gi, ' — '], [/\s*\bellipsis\b/gi, '…'],
  [/\b(open quote|begin quote)\b\s*/gi, '“'], [/\s*\b(close quote|end quote|unquote)\b/gi, '”'],
];

/**
 * Turn a recognised phrase into text ready to insert.
 * @param before text just before the cursor (decides spacing and capitals)
 */
export function shapeTranscript(text, before = '', { english = true } = {}) {
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (english) for (const [re, rep] of COMMANDS) t = t.replace(re, rep);
  t = t.replace(/ +([,.;:!?…”])/g, '$1').replace(/“ +/g, '“').replace(/([,;:!?.])(?=[^\s\n”’)\d])/g, '$1 ').replace(/\. \. \./g, '…');
  const prev = before.replace(/[ \t]+$/, '');
  const startOfSentence = !prev || /[.!?…\n]["”’)]?$/.test(prev);
  if (english && startOfSentence) t = t.replace(/^([“"(]?)(\p{Ll})/u, (_, q, c) => q + c.toUpperCase());
  if (english) t = t.replace(/([.!?]\s+|\n\s*)(\p{Ll})/gu, (_, p, c) => p + c.toUpperCase());
  const needsSpace = before && !/[\s\n“"(‘]$/.test(before) && !/^[,.;:!?…”\n]/.test(t);
  return (needsSpace ? ' ' : '') + t;
}

// ---------- sessions ----------
/**
 * Start listening. Returns { stop() }.
 * handlers: onInterim(text), onFinal(text), onState('listening'|'processing'|'stopped'), onError(message), onLevel(0..1)
 */
export function startVoice({ engine, locale, keys = {}, ...handlers }) {
  if (engine === 'browser') return browserSession(locale, handlers);
  if (engine === 'google') return googleSession(locale, keys, handlers);
  throw new Error('Voice typing isn’t available here. Use Chrome, Edge or Safari, or add a Google Cloud key in Settings → Voice & translation.');
}

function browserSession(locale, h) {
  const rec = new (SR())();
  rec.lang = locale;
  rec.continuous = true;
  rec.interimResults = true;
  let active = true;
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) h.onFinal?.(r[0].transcript); else interim += r[0].transcript;
    }
    h.onInterim?.(interim);
  };
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    active = false;
    const msg = { 'not-allowed': 'Microphone access was blocked. Allow the microphone for this page and try again.', 'service-not-allowed': 'Microphone access was blocked.', network: 'Voice typing needs an internet connection in this browser.', 'language-not-supported': `This browser can’t recognise ${locale}. Try Chrome, or Google Cloud voice typing.` }[e.error] || `Voice typing stopped (${e.error}).`;
    h.onError?.(msg);
  };
  // Browsers stop after a pause; keep listening until the writer turns it off.
  rec.onend = () => { if (active) { try { rec.start(); } catch { /* already started */ } } else h.onState?.('stopped'); };
  rec.start();
  h.onState?.('listening');
  return { stop() { active = false; h.onInterim?.(''); try { rec.stop(); } catch { /* ignore */ } } };
}

// Records phrases between pauses and sends each one to Google Cloud Speech-to-Text.
function googleSession(locale, keys, h) {
  let stopped = false, stream, ctx, rec, chunks = [], speaking = false, silentSince = 0, startedAt = 0, raf;
  const queue = [];
  let busy = false;
  const flushQueue = async () => {
    if (busy) return;
    busy = true;
    while (queue.length) {
      const blob = queue.shift();
      h.onState?.('processing');
      try {
        const text = await recognizeGoogle(blob, locale, keys.googleKey);
        if (text) h.onFinal?.(text);
      } catch (e) { h.onError?.(e.message); }
    }
    busy = false;
    h.onState?.(stopped ? 'stopped' : 'listening');
  };
  const newRecorder = () => {
    chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      if (speaking || chunks.length) { const b = new Blob(chunks, { type: rec.mimeType }); if (b.size > 2000) { queue.push(b); flushQueue(); } }
      speaking = false;
      if (!stopped) newRecorder();
    };
    rec.start(250);
    startedAt = performance.now();
  };
  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      h.onError?.('Microphone access was blocked. Allow the microphone and try again.');
      return;
    }
    if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
    ctx = new AudioContext();
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    newRecorder();
    h.onState?.('listening');
    const tick = () => {
      if (stopped) return;
      an.getFloatTimeDomainData(buf);
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      h.onLevel?.(Math.min(1, rms * 8));
      const now = performance.now();
      if (rms > 0.02) { speaking = true; silentSince = 0; h.onInterim?.('…'); }
      else if (speaking && !silentSince) silentSince = now;
      // End a phrase after 0.9 s of quiet, or every 50 s (Google's limit for one request is 60 s).
      if (rec.state === 'recording' && ((speaking && silentSince && now - silentSince > 900) || now - startedAt > 50000)) { h.onInterim?.(''); rec.stop(); }
      else if (!speaking && now - startedAt > 8000 && rec.state === 'recording') { chunks = []; rec.stop(); }
      raf = requestAnimationFrame(tick);
    };
    tick();
  })();
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      try { if (rec?.state === 'recording') rec.stop(); } catch { /* ignore */ }
      setTimeout(() => { stream?.getTracks().forEach((t) => t.stop()); ctx?.close(); }, 300);
      h.onInterim?.('');
      if (!busy) h.onState?.('stopped');
    },
  };
}

async function recognizeGoogle(blob, locale, key) {
  const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: { encoding: 'WEBM_OPUS', sampleRateHertz: 48000, languageCode: locale, enableAutomaticPunctuation: true }, audio: { content: b64 } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google voice typing: ${data.error?.message || res.status}`);
  return (data.results || []).map((r) => r.alternatives?.[0]?.transcript || '').join(' ').trim();
}
