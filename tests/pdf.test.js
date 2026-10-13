import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, PDFName } from 'pdf-lib';
import { interiorBoxes, insideEdgeOf, finishInterior, finishCover, buildXmp } from '../src/export/pdf-post.js';
import { checkInterior, expectedPageSize, inspectPdf } from '../src/export/pdf-check.js';

const PT = 72;

test('spine-side bleed is cropped: recto loses left bleed, verso loses right bleed', () => {
  const media = { x: 0, y: 0, width: 6.25 * PT, height: 9.25 * PT };
  const r = interiorBoxes(media, { trimW: 6, trimH: 9, bleed: 0.125 }, 'left');
  assert.equal(r.media.x, 0.125 * PT);
  assert.equal(r.media.width, 6.125 * PT);
  assert.deepEqual(r.trim, { x: 0.125 * PT, y: 0.125 * PT, width: 6 * PT, height: 9 * PT });
  const v = interiorBoxes(media, { trimW: 6, trimH: 9, bleed: 0.125 }, 'right');
  assert.equal(v.media.x, 0);
  assert.equal(v.media.width, 6.125 * PT);
  assert.equal(insideEdgeOf(1), 'left');
  assert.equal(insideEdgeOf(2), 'right');
  assert.equal(insideEdgeOf(1, true), 'right'); // right-to-left books bind on the right
});

test('no bleed: trim equals media; wrong size is reported as not fitting', () => {
  const ok = interiorBoxes({ x: 0, y: 0, width: 6 * PT, height: 9 * PT }, { trimW: 6, trimH: 9 }, 'left');
  assert.equal(ok.fits, true);
  const bad = interiorBoxes({ x: 0, y: 0, width: 8.5 * PT, height: 11 * PT }, { trimW: 6, trimH: 9 }, 'left');
  assert.equal(bad.fits, false);
});

test('finishInterior sets boxes, metadata and pads to an even count', async () => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 3; i++) doc.addPage([6.25 * PT, 9.25 * PT]);
  const { bytes, notes } = await finishInterior(await doc.save(), { trimW: 6, trimH: 9, bleed: 0.125, meta: { title: 'Sea', author: 'Ann', keywords: ['sea', 'storm'], language: 'ta' } });
  const out = await PDFDocument.load(bytes, { updateMetadata: false });
  assert.equal(out.getPageCount(), 4);
  assert.ok(notes.some((n) => /blank page/.test(n)));
  for (const p of out.getPages()) {
    assert.ok(Math.abs(p.getMediaBox().width - 6.125 * PT) < 0.01);
    assert.ok(Math.abs(p.getTrimBox().width - 6 * PT) < 0.01);
  }
  assert.equal(out.getTitle(), 'Sea');
  assert.equal(out.getAuthor(), 'Ann');
  assert.equal(out.getCreator(), 'Booky');
  assert.ok(out.catalog.get(PDFName.of('Metadata')), 'XMP metadata stream present');
  const summary = await inspectPdf(bytes);
  assert.ok(checkInterior(summary, { trimW: 6, trimH: 9, bleed: 0.125, minPages: 2, maxPages: 800 })[0].ok === true);
});

test('finishCover sets a trim box inside the cover bleed', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([12.5 * PT, 9.25 * PT]);
  const { bytes } = await finishCover(await doc.save(), { coverBleed: 0.125, meta: { title: 'Sea — cover' } });
  const p = (await PDFDocument.load(bytes)).getPage(0);
  assert.ok(Math.abs(p.getTrimBox().width - 12.25 * PT) < 0.01);
  assert.ok(Math.abs(p.getTrimBox().x - 0.125 * PT) < 0.01);
});

test('checker: size, count, fonts and image-only pages', () => {
  const page = (o = {}) => ({ w: 6, h: 9, fonts: [{ name: 'EBGaramond', embedded: true }], text: true, fullPageImage: false, ...o });
  const spec = { trimW: 6, trimH: 9, bleed: 0, minPages: 24, maxPages: 828 };
  let r = checkInterior({ pages: Array.from({ length: 24 }, () => page()) }, spec);
  assert.ok(r.every((x) => x.ok === true), JSON.stringify(r));
  r = checkInterior({ pages: Array.from({ length: 24 }, () => page({ w: 8.5, h: 11 })) }, spec);
  assert.equal(r[0].ok, false);
  r = checkInterior({ pages: Array.from({ length: 10 }, () => page()) }, spec);
  assert.equal(r[1].ok, false);
  r = checkInterior({ pages: Array.from({ length: 25 }, () => page()) }, spec);
  assert.equal(r[1].ok, 'warn');
  r = checkInterior({ pages: [page({ fonts: [{ name: 'Helvetica', embedded: false }] }), page()] }, { ...spec, minPages: 0 });
  assert.equal(r[2].ok, false);
  assert.match(r[2].text, /Helvetica/);
  r = checkInterior({ pages: [page({ fonts: [], text: false, fullPageImage: true })] }, { ...spec, minPages: 0 });
  assert.equal(r[3].ok, 'warn');
  assert.deepEqual(expectedPageSize({ trimW: 6, trimH: 9, bleed: 0.125 }), { w: 6.125, h: 9.25 });
});

test('inspectPdf finds non-embedded standard fonts and full-page images', async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([6 * PT, 9 * PT]);
  p1.drawText('Hello', { x: 50, y: 500, font, size: 12 });
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAAEklEQVR4nGP4z8DwH4QZkBkAN/oP8UZjWr8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
  const img = await doc.embedPng(png);
  const p2 = doc.addPage([6 * PT, 9 * PT]);
  p2.drawImage(img, { x: 0, y: 0, width: 6 * PT, height: 9 * PT });
  const s = await inspectPdf(await doc.save());
  assert.equal(s.pages[0].text, true);
  assert.equal(s.pages[0].fonts[0].embedded, false);
  assert.equal(s.pages[1].fullPageImage, true);
  assert.equal(s.pages[1].text, false);
});

test('XMP packet escapes text and lists keywords', () => {
  const x = buildXmp({ title: 'Tom & Jerry <3', author: 'A', keywords: ['a', 'b'] });
  assert.match(x, /Tom &amp; Jerry &lt;3/);
  assert.match(x, /<rdf:li>a<\/rdf:li><rdf:li>b<\/rdf:li>/);
});
