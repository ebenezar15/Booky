// Renders assets/logo.svg into the desktop app icons (run when the logo changes; outputs are committed):
//   build/icon.png      1024 px, macOS style (rounded tile with margin and shadow)
//   build/icon.icns     macOS app and document icon
//   build/icon.ico      Windows icon with 16–256 px images
//   build/icon-512.png  full-bleed tile (Linux / installers)
//   public/icon-192.png, public/icon-512.png  web app icons
// Needs Playwright (npx playwright, or a global install).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'assets/logo.svg'), 'utf8');

async function render(page, size, { mac = false } = {}) {
  const inner = mac ? Math.round(size * 0.805) : size;
  const off = (size - inner) / 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <div style="position:absolute;left:${off}px;top:${off}px;width:${inner}px;height:${inner}px;${mac ? `filter:drop-shadow(0 ${size * 0.012}px ${size * 0.02}px rgba(30,0,60,.35))` : ''}">
    ${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

// ICNS container holding PNG images (macOS app and document icons).
function icns(entries) {
  const chunks = entries.map(({ type, data }) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii'); head.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([head, data]);
  });
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii'); head.writeUInt32BE(8 + chunks.reduce((n, c) => n + c.length, 0), 4);
  return Buffer.concat([head, ...chunks]);
}

// ICO container holding PNG images (supported since Windows Vista).
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o); dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3); dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  fs.writeFileSync(path.join(root, 'build/icon.png'), await render(page, 1024, { mac: true }));
  fs.writeFileSync(path.join(root, 'build/icon-512.png'), await render(page, 512));
  const macTypes = [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024], ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]];
  const macEntries = [];
  for (const [type, size] of macTypes) macEntries.push({ type, data: await render(page, size, { mac: true }) });
  fs.writeFileSync(path.join(root, 'build/icon.icns'), icns(macEntries));
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = [];
  for (const s of sizes) pngs.push({ size: s, data: await render(page, s) });
  fs.writeFileSync(path.join(root, 'build/icon.ico'), ico(pngs));
  fs.writeFileSync(path.join(root, 'public/icon-192.png'), await render(page, 192));
  fs.writeFileSync(path.join(root, 'public/icon-512.png'), await render(page, 512));
  fs.copyFileSync(path.join(root, 'assets/logo.svg'), path.join(root, 'public/icon.svg'));
  await browser.close();
  console.log('icons written to build/ and public/');
})();
