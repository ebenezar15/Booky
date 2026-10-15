import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { THEMES, DESIGN_CATEGORIES, applyTheme, defaultFormat, findThemes, mixThemes } from '../src/core/themes.js';

const fonts = new Set(JSON.parse(fs.readFileSync(new URL('../src/fonts/catalog.json', import.meta.url))).map((f) => f.name));

test('at least 100 designs, every one unique, categorised and using built-in fonts', () => {
  const all = Object.entries(THEMES);
  assert.ok(all.length >= 100, `${all.length} designs`);
  const labels = new Set(), looks = new Set();
  for (const [id, t] of all) {
    assert.ok(DESIGN_CATEGORIES.includes(t.cat), `${id} category`);
    assert.ok(!labels.has(t.label), `duplicate name ${t.label}`); labels.add(t.label);
    const f = applyTheme(defaultFormat(), id);
    assert.equal(f.theme, id);
    for (const font of [f.body.font, f.headings.font, f.headings.numberFont, f.headings.subheadFont, f.firstPara.dropCapFont, f.header.font, f.pageNumbers.font].filter(Boolean)) assert.ok(fonts.has(font), `${id}: ${font}`);
    const look = JSON.stringify([f.body, f.headings, f.firstPara, f.sceneBreak, f.header, f.pageNumbers, f.trim]);
    assert.ok(!looks.has(look), `${id} looks the same as another design`); looks.add(look);
  }
});

test('search and categories', () => {
  assert.ok(findThemes('', 'Poetry').length >= 5);
  assert.ok(findThemes('avenir').length >= 2);
  assert.deepEqual(findThemes('zzzz'), []);
});

test('mixing parts of templates', () => {
  const base = applyTheme(defaultFormat(), 'classic');
  base.trim = '5x8';
  base.charStyles = [{ id: 'mine', name: 'Mine', italic: true }];
  const m = mixThemes(base, { text: 'modern', openings: 'fantasy', breaks: 'romance', pages: 'nonfiction' });
  assert.equal(m.body.font, THEMES.modern.o.body.font);
  assert.equal(m.headings.font, 'Cinzel');
  assert.equal(m.firstPara.dropCapFont, 'Cinzel');
  assert.equal(m.sceneBreak.style, 'floral');
  assert.equal(m.pageNumbers.position, 'top-outside');
  assert.equal(m.trim, '5x8');
  assert.equal(m.charStyles[0].id, 'mine');
  assert.deepEqual(m.mix, { text: 'modern', openings: 'fantasy', breaks: 'romance', pages: 'nonfiction' });
  // applying a plain template afterwards clears the mix
  assert.equal(applyTheme(m, 'classic').mix, undefined);
});
