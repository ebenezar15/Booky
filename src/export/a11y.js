// EPUB accessibility helpers (pure, unit-tested): heading order and schema.org metadata.

/** Re-level headings so they never skip a level (h1 → h3 becomes h1 → h2). Headings cannot nest, so one pass is enough. */
export function fixHeadingLevels(html) {
  const stack = []; // original levels of the open headings
  return String(html).replace(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (all, lv, attrs, inner) => {
    while (stack.length && stack[stack.length - 1] >= +lv) stack.pop();
    stack.push(+lv);
    const want = stack.length; // siblings stay siblings, children are one level down
    return want === +lv ? all : `<h${want}${attrs}>${inner}</h${want}>`;
  });
}

/** Heading levels in order, e.g. [1, 2, 2, 3]. */
export const headingLevels = (html) => [...String(html).matchAll(/<h([1-6])\b/gi)].map((m) => +m[1]);

/**
 * schema.org accessibility metadata for the OPF.
 * facts: { images, imagesWithAlt, toc, pageList, lang, headingsOk }
 * @returns { meta: string (OPF <meta> lines), conforms: bool, summary }
 */
export function accessibilityMetadata({ images = 0, imagesWithAlt = 0, toc = true, pageList = false, lang = '', headingsOk = true }) {
  const allAlt = images === imagesWithAlt;
  const features = ['structuralNavigation', toc ? 'tableOfContents' : '', 'readingOrder', images && allAlt ? 'alternativeText' : '', pageList ? 'printPageNumbers' : ''].filter(Boolean);
  const modes = ['textual', images ? 'visual' : ''].filter(Boolean);
  const sufficient = allAlt ? ['textual'] : ['textual,visual'];
  const conforms = allAlt && toc && !!lang && headingsOk;
  const summary = [
    'This ebook has a table of contents and headings in reading order',
    images ? (allAlt ? ', every image has a text description' : '; some images have no text description') : '',
    pageList ? ', and page numbers matching the print edition' : '',
    '. No known hazards.',
  ].join('');
  const meta = [
    ...modes.map((m) => `<meta property="schema:accessMode">${m}</meta>`),
    ...sufficient.map((m) => `<meta property="schema:accessModeSufficient">${m}</meta>`),
    ...features.map((f) => `<meta property="schema:accessibilityFeature">${f}</meta>`),
    '<meta property="schema:accessibilityHazard">none</meta>',
    `<meta property="schema:accessibilitySummary">${summary}</meta>`,
    conforms ? '<meta property="dcterms:conformsTo">EPUB Accessibility 1.1 - WCAG 2.1 Level AA</meta>' : '',
  ].filter(Boolean).join('\n');
  return { meta, conforms, summary };
}
