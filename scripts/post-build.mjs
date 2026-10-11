// After `vite build`: keep a friendly standalone copy named Booky.html.
import fs from 'node:fs';
const src = 'dist/app.html';
if (fs.existsSync(src)) {
  fs.copyFileSync(src, 'dist/Booky.html');
  fs.copyFileSync(src, 'dist/index.html'); // the desktop app loads this one
  const kb = Math.round(fs.statSync(src).size / 1024);
  console.log(`\n  Standalone app: dist/Booky.html (${kb} KB) — double-click to open, works offline.\n`);
}

// The online review page (hosted, e.g. on GitHub Pages): the same viewer as a review
// file, but it downloads the encrypted copy from Supabase and sends comments back there.
const viewerJs = fs.readFileSync('src/share/viewer-runtime.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const viewerCss = fs.readFileSync('src/share/viewer.css', 'utf8');
fs.writeFileSync('dist/review.html', `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>Private review copy — Booky</title>
<style>${viewerCss}</style>
</head><body>
<script>${viewerJs}</script>
</body></html>
`);
console.log('  Online review page: dist/review.html\n');
