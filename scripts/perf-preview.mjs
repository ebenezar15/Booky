// Measures print-preview (Paged.js) time on a generated 120,000-word novel.
//   node scripts/perf-preview.mjs [words]
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const WORDS = +process.argv[2] || 120000;
const CHAPTERS = 40;
const vocab = 'the keeper climbed stairs again counting each step as wind pushed against glass and sea below turned from grey to black somewhere far out a ship answered with long low note she remembered harbour morning letters folded twice into pocket where they stayed whole summer light moved slowly over water'.split(' ');
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function paragraph(n) {
  const w = Array.from({ length: n }, () => vocab[Math.floor(rnd() * vocab.length)]);
  w[0] = w[0][0].toUpperCase() + w[0].slice(1);
  return `<p>${w.join(' ')}.</p>`;
}
const per = Math.round(WORDS / CHAPTERS);
const base = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/novel-en.json'), 'utf8'));
const chapter = base.elements.find((e) => e.type === 'chapter');
const book = {
  ...base, id: 'perf', meta: { ...base.meta, title: 'Performance Test' },
  elements: [...base.elements.filter((e) => e.type !== 'chapter'), ...Array.from({ length: CHAPTERS }, (_, i) => {
    let words = 0, html = '';
    while (words < per) { const n = 40 + Math.floor(rnd() * 80); html += paragraph(n); words += n; }
    return { ...chapter, id: `perf${i}`, title: `Chapter ${i + 1}`, content: html };
  })],
};

const server = await createServer({ root, configFile: path.join(root, 'vite.config.js'), server: { port: 5188, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const page = await browser.newPage();
  await page.goto(`${server.resolvedUrls.local[0]}tests/harness/epub.html`);
  await page.waitForFunction(() => window.harnessReady, null, { timeout: 120000 });
  const r = await page.evaluate(async (raw) => {
    const { printDocument } = await import('/src/render/preview.js');
    const { normalizeBook } = await import('/src/core/model.js');
    const b = normalizeBook(raw);
    const time = async (opts) => {
      const token = Math.random().toString(36).slice(2);
      const t0 = performance.now();
      const { html } = printDocument(b, { ...opts, token, interactive: false });
      const tHtml = performance.now() - t0;
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:900px;height:900px';
      document.body.appendChild(iframe);
      const pages = await new Promise((resolve) => {
        const on = (ev) => { if (ev.data?.token !== token) return; window.removeEventListener('message', on); resolve(ev.data.pages); };
        window.addEventListener('message', on);
        iframe.srcdoc = html;
      });
      const ms = performance.now() - t0;
      iframe.remove();
      return { ms: Math.round(ms), htmlMs: Math.round(tHtml), pages };
    };
    const one = await time({ onlyId: 'perf5' });
    const full = await time({});
    return { one, full, words: b.elements.reduce((n, e) => n + (e.content.replace(/<[^>]+>/g, ' ').match(/\S+/g) || []).length, 0) };
  }, book);
  console.log(`${r.words.toLocaleString()} words`);
  console.log(`one chapter: ${r.one.ms} ms (${r.one.pages} pages; building the HTML ${r.one.htmlMs} ms)`);
  console.log(`whole book: ${r.full.ms} ms (${r.full.pages} pages; building the HTML ${r.full.htmlMs} ms)`);
} finally {
  await browser.close();
  await server.close();
}
