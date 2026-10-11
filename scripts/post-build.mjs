// After `vite build`: keep a friendly standalone copy named Booky.html.
import fs from 'node:fs';
const src = 'dist/index.html';
if (fs.existsSync(src)) {
  fs.copyFileSync(src, 'dist/Booky.html');
  const kb = Math.round(fs.statSync(src).size / 1024);
  console.log(`\n  Standalone app: dist/Booky.html (${kb} KB) — double-click to open, works offline.\n`);
}
