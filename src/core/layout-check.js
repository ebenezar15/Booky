// Layout check: finds typesetting problems in the paginated book.
// `layoutFindings` is pure (unit-tested); `readLayout` in src/render/layout-read.js builds its input from the Paged.js pages.
//
// pages: [{ n, folio, inserted (blank page added for a right-hand start), empty, intendedBlank,
//           blocks: [{ kind: 'p'|'heading'|'scene'|'figure'|'other', elId, lines, splitFrom, splitTo, hyphens: [bool per line], loose: [ratio per line], text }] }]

const MIN_LAST_PAGE_LINES = 4;

const snippet = (t) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > 48 ? `${s.slice(0, 46)}…` : s; };

/**
 * @param opts { hyphenLimit: max hyphenated line-ends in a row (0 = no limit), looseRatio: word gap ÷ normal space, titles: Map elId → title }
 * @returns [{ level: 'bad'|'warn'|'info', kind, page, folio, elId, text }]
 */
export function layoutFindings(pages, { hyphenLimit = 2, looseRatio = 2, titles = new Map() } = {}) {
  const out = [];
  const add = (level, kind, pg, elId, text) => out.push({ level, kind, page: pg.n, folio: pg.folio || String(pg.n), elId: elId || '', text });
  const name = (elId) => titles.get(elId) || 'this chapter';

  let inserted = 0;
  const lastPageOf = new Map(); // elId → { pg, lines on that page, pages spanned }
  for (const pg of pages) {
    if (pg.inserted) { inserted++; continue; }
    if (pg.empty && !pg.intendedBlank) add('warn', 'blank', pg, '', `Page ${pg.folio || pg.n} is blank but no blank page was asked for — check for an empty paragraph or a page break at the end of the previous page.`);
    const blocks = pg.blocks.filter((b) => b.lines > 0 || b.kind === 'figure');
    if (!blocks.length) continue;

    // Widows: the last line of a paragraph alone at the top of a page
    const first = blocks[0];
    if (first.kind === 'p' && first.splitFrom && first.lines === 1) add('warn', 'widow', pg, first.elId, `Widow at the top of page ${pg.folio}: the last line of a paragraph (“${snippet(first.text)}”) sits alone.`);
    // Orphans: the first line of a paragraph alone at the bottom of a page
    const last = blocks[blocks.length - 1];
    if (last.kind === 'p' && last.splitTo && last.lines === 1) add('warn', 'orphan', pg, last.elId, `Orphan at the bottom of page ${pg.folio}: the first line of a paragraph (“${snippet(last.text)}”) is left alone.`);
    // A heading or scene break stranded at the foot of the page
    const next = pages[pages.indexOf(pg) + 1];
    const nextStartsNewSection = !next || next.inserted || (next.blocks[0] && next.blocks[0].elId !== last.elId);
    if ((last.kind === 'heading' || last.kind === 'scene') && !nextStartsNewSection) {
      add('bad', last.kind === 'heading' ? 'heading-bottom' : 'scene-bottom', pg, last.elId, last.kind === 'heading'
        ? `A heading (“${snippet(last.text)}”) is the last thing on page ${pg.folio} — its text starts overleaf.`
        : `A scene break is the last thing on page ${pg.folio} — readers turning the page won't see it.`);
    }

    // Hyphenated line-ends in a row (within the page, across paragraphs)
    if (hyphenLimit > 0) {
      let run = 0, worst = 0, at = null;
      for (const b of blocks) for (const h of b.hyphens || []) { run = h ? run + 1 : 0; if (run > worst) { worst = run; at = b; } }
      if (worst > hyphenLimit) add('warn', 'hyphens', pg, at?.elId, `${worst} hyphenated lines in a row on page ${pg.folio} (your limit is ${hyphenLimit}).`);
    }
    // Loose justified lines
    const loose = blocks.reduce((n, b) => n + (b.loose || []).filter((r) => r > looseRatio).length, 0);
    if (loose) {
      const b = blocks.find((x) => (x.loose || []).some((r) => r > looseRatio));
      add('info', 'loose', pg, b?.elId, `${loose} very loose justified line${loose === 1 ? '' : 's'} on page ${pg.folio} (word gaps over ${looseRatio}× normal). Hyphenation or rewording a few words helps.`);
    }

    // Track each chapter's last page and how many lines it has there
    const linesHere = new Map();
    for (const b of blocks) linesHere.set(b.elId, (linesHere.get(b.elId) || 0) + (b.lines || 0));
    for (const [elId, lines] of linesHere) {
      const prev = lastPageOf.get(elId);
      lastPageOf.set(elId, { pg, lines, span: (prev?.span || 0) + 1 });
    }
  }
  for (const [elId, v] of lastPageOf) {
    if (v.span > 1 && v.lines > 0 && v.lines < MIN_LAST_PAGE_LINES) add('warn', 'short-last', v.pg, elId, `${name(elId)} ends with only ${v.lines} line${v.lines === 1 ? '' : 's'} on page ${v.pg.folio || v.pg.n}. Trimming a few words earlier pulls them back.`);
  }
  if (inserted) out.push({ level: 'info', kind: 'inserted', page: 0, folio: '', elId: '', text: `Right-hand starts added ${inserted} blank page${inserted === 1 ? '' : 's'}. Starting chapters on the next page instead (Format → Page flow) would save them.` });
  return out.sort((a, b) => (a.page || 1e9) - (b.page || 1e9));
}

/** One line per kind, for a summary: { widow: 2, orphan: 1, … }. */
export const findingCounts = (findings) => findings.reduce((m, f) => ((m[f.kind] = (m[f.kind] || 0) + 1), m), {});
