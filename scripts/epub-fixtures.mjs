// Builds EPUBs from tests/fixtures/*.json in a headless browser and validates them with EPUBCheck.
//   node scripts/epub-fixtures.mjs            (needs Java; EPUBCHECK_JAR or tools/epubcheck/epubcheck.jar)
// Exits with 1 if any EPUB has an EPUBCheck error or fatal error.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'tests/out');
fs.mkdirSync(outDir, { recursive: true });
const fixtures = fs.readdirSync(path.join(root, 'tests/fixtures')).filter((f) => f.endsWith('.json')).sort();

const server = await createServer({ root, configFile: path.join(root, 'vite.config.js'), server: { port: 5199, strictPort: false, open: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const built = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${url}tests/harness/epub.html`);
  await page.waitForFunction(() => window.harnessReady, null, { timeout: 120000 });
  for (const f of fixtures) {
    const raw = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures', f), 'utf8'));
    const t0 = Date.now();
    const { b64, pages } = await page.evaluate((r) => window.makeEpub(r), raw);
    const file = path.join(outDir, f.replace(/\.json$/, '.epub'));
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    built.push(file);
    console.log(`built ${path.basename(file)} (${Math.round(fs.statSync(file).size / 1024)} KB, ${pages} print page markers, ${Date.now() - t0} ms)`);
  }
  // the sample / reader-magnet edition of the novel
  const novel = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/novel-en.json'), 'utf8'));
  const { b64 } = await page.evaluate((r) => window.makeSampleEpub(r, { chapters: 2, buyUrl: 'https://example.com/buy', newsletterUrl: 'https://example.com/news' }), novel);
  const sampleFile = path.join(outDir, 'novel-en-sample.epub');
  fs.writeFileSync(sampleFile, Buffer.from(b64, 'base64'));
  built.push(sampleFile);
  console.log(`built novel-en-sample.epub (${Math.round(fs.statSync(sampleFile).size / 1024)} KB)`);
} finally {
  await browser.close();
  await server.close();
}

const jar = process.env.EPUBCHECK_JAR || path.join(root, 'tools/epubcheck/epubcheck.jar');
if (!fs.existsSync(jar)) {
  console.log(`EPUBCheck not found at ${jar} — EPUBs were built but not validated.`);
  process.exit(process.env.CI ? 1 : 0);
}
let failed = 0;
for (const file of built) {
  let out = '';
  try { out = execFileSync('java', ['-jar', jar, file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { out = `${e.stdout || ''}${e.stderr || ''}`; }
  const m = out.match(/Messages:\s*(\d+) fatals?\s*\/\s*(\d+) errors?\s*\/\s*(\d+) warnings?/i);
  const [fatals, errors, warnings] = m ? [+m[1], +m[2], +m[3]] : [0, /ERROR|FATAL/.test(out) ? 1 : 0, 0];
  console.log(`EPUBCheck ${path.basename(file)}: ${fatals} fatal, ${errors} errors, ${warnings} warnings`);
  if (fatals || errors) { failed++; console.log(out.split('\n').filter((l) => /^(ERROR|FATAL|WARNING)/.test(l)).join('\n')); }
}
process.exit(failed ? 1 : 0);
