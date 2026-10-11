// EPUB 3 export (with EPUB 2 NCX fallback) — valid for Kindle (KDP), Apple Books, Kobo, Google Play.
import JSZip from 'jszip';
import { renderSections } from '../render/book.js';
import { ebookCss } from '../render/css.js';
import { escapeHtml, uid } from '../core/model.js';
import { frontCoverDataURL } from '../render/cover.js';
import { fontFaceCss, ensureFontsLoaded } from '../core/fonts.js';

const XHTML_NS = ' xmlns="http://www.w3.org/1999/xhtml"';

function toXhtml(html) {
  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = html;
  const s = new XMLSerializer();
  return [...doc.body.childNodes].map((n) => s.serializeToString(n)).join('').split(XHTML_NS).join('');
}

function dataUrlParts(url) {
  const m = url.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!m) return null;
  const mime = m[1];
  const data = m[2] ? m[3] : btoa(unescape(m[3]));
  return { mime, data };
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp' };

function page(book, title, body, { cls = '' } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeHtml(book.meta.language || 'en')}" xml:lang="${escapeHtml(book.meta.language || 'en')}">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" type="text/css" href="../css/book.css" />
</head>
<body${cls ? ` class="${cls}"` : ''}>
${body}
</body>
</html>`;
}

async function fontFiles(book) {
  const used = new Set([book.format.body.font, book.format.headings.font, book.format.headings.numberFont, book.format.firstPara.dropCapFont, book.format.headings.subheadFont].filter(Boolean));
  const css = fontFaceCss();
  const out = [];
  let faceCss = '';
  const re = /@font-face\s*{([^}]*)}/g;
  let m, i = 0;
  while ((m = re.exec(css))) {
    const block = m[1];
    const fam = block.match(/font-family:\s*['"]?([^;'"]+)['"]?/)?.[1];
    if (!fam || !used.has(fam)) continue;
    const url = block.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/)?.[1];
    if (!url) continue;
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      const ext = /woff2/.test(url) || /font\/woff2/.test(url) ? 'woff2' : /woff/.test(url) ? 'woff' : /otf/.test(url) ? 'otf' : 'ttf';
      const name = `font${++i}.${ext}`;
      out.push({ name, buf, mime: { woff2: 'font/woff2', woff: 'font/woff', otf: 'font/otf', ttf: 'font/ttf' }[ext] });
      faceCss += `@font-face{${block.replace(/src:[^;]+;?/, `src:url(../fonts/${name});`)}}\n`;
    } catch { /* skip font */ }
  }
  return { files: out, css: faceCss };
}

export async function buildEpub(book) {
  const zip = new JSZip();
  // No directory entries: some validators and readers dislike them.
  const put = (path, data, opts = {}) => zip.file(path, data, { createFolders: false, ...opts });
  put('mimetype', 'application/epub+zip', { compression: 'STORE' });
  put('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);

  let sections = renderSections(book, 'ebook');
  if (!book.format.ebook.includeToc) sections = sections.filter((s) => s.kind !== 'toc');
  const manifest = [];
  const spine = [];
  const images = new Map();
  const addImage = (src) => {
    if (!src.startsWith('data:')) return src;
    if (images.has(src)) return images.get(src).href;
    const p = dataUrlParts(src);
    if (!p) return src;
    const id = `img${images.size + 1}`;
    const href = `images/${id}.${EXT[p.mime] || 'png'}`;
    images.set(src, { id, href, mime: p.mime, data: p.data });
    return href;
  };

  // Cover
  await ensureFontsLoaded(book.cover.layers.map((l) => l.font));
  const coverUrl = frontCoverDataURL(book, 'image/jpeg');
  put('OEBPS/images/cover.jpg', coverUrl.split(',')[1], { base64: true });
  manifest.push('<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>');
  put('OEBPS/text/cover.xhtml', page(book, 'Cover', `<section epub:type="cover" class="bk-cover"><img src="../images/cover.jpg" alt="${escapeHtml(book.meta.title)} cover" /></section>`, { cls: 'cover-page' }));
  manifest.push('<item id="cover" href="text/cover.xhtml" media-type="application/xhtml+xml"/>');
  spine.push('<itemref idref="cover" linear="yes"/>');

  // Sections
  for (const s of sections) {
    const tpl = document.createElement('template');
    tpl.innerHTML = s.html;
    tpl.content.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      const href = addImage(src);
      img.setAttribute('src', `../${href}`);
    });
    // TOC links point at other files
    tpl.content.querySelectorAll('.bk-toc a').forEach((a) => {
      const href = a.getAttribute('href');
      if (href && !href.startsWith('#')) a.setAttribute('href', href);
    });
    const d = document.createElement('div');
    d.appendChild(tpl.content);
    const typeAttr = { toc: 'toc', copyright: 'copyright-page', dedication: 'dedication', epigraph: 'epigraph', title: 'titlepage', 'half-title': 'halftitlepage', foreword: 'foreword', preface: 'preface', introduction: 'introduction', prologue: 'prologue', epilogue: 'epilogue', afterword: 'afterword', acknowledgments: 'acknowledgments', appendix: 'appendix', glossary: 'glossary', bibliography: 'bibliography', index: 'index', chapter: 'chapter', part: 'part' }[s.kind];
    let body = toXhtml(d.innerHTML);
    if (typeAttr) body = body.replace(/^<section /, `<section epub:type="${typeAttr}" `);
    put(`OEBPS/text/${s.file}`, page(book, s.nav || s.title || 'Section', body));
    const id = s.file.replace('.xhtml', '');
    manifest.push(`<item id="${id}" href="text/${s.file}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${id}"/>`);
  }

  // Images extracted from the text
  for (const img of images.values()) {
    put(`OEBPS/${img.href}`, img.data, { base64: true });
    manifest.push(`<item id="${img.id}" href="${img.href}" media-type="${img.mime}"/>`);
  }

  // Styles & fonts
  let css = ebookCss(book) + '\n.cover-page { margin: 0; padding: 0; text-align: center; } .bk-cover img { max-width: 100%; max-height: 100vh; }\n';
  if (book.format.ebook.embedFonts) {
    const f = await fontFiles(book);
    f.files.forEach((ff, i) => { put(`OEBPS/fonts/${ff.name}`, ff.buf); manifest.push(`<item id="font${i + 1}" href="fonts/${ff.name}" media-type="${ff.mime}"/>`); });
    css = f.css + css;
  }
  put('OEBPS/css/book.css', css);
  manifest.push('<item id="css" href="css/book.css" media-type="text/css"/>');

  // Navigation (EPUB 3) + NCX (EPUB 2)
  const navItems = sections.filter((s) => s.kind !== 'toc' && !s.simple && (s.nav || s.title));
  const firstBody = sections.find((s) => !s.front) || sections[0];
  const tocSection = sections.find((s) => s.kind === 'toc');
  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeHtml(book.meta.language || 'en')}">
<head><meta charset="UTF-8" /><title>Contents</title><link rel="stylesheet" type="text/css" href="css/book.css" /></head>
<body>
<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>
${navItems.map((s) => `<li><a href="text/${s.file}">${escapeHtml(s.nav || s.title)}</a>${s.subheads.length && (book.format.toc?.depth || 1) > 1 ? `<ol>${s.subheads.filter((x) => x.level <= book.format.toc.depth).map((x) => `<li><a href="text/${s.file}#${x.id}">${escapeHtml(x.text)}</a></li>`).join('')}</ol>` : ''}</li>`).join('\n')}
</ol></nav>
<nav epub:type="landmarks" hidden="hidden"><ol>
<li><a epub:type="cover" href="text/cover.xhtml">Cover</a></li>
${tocSection ? `<li><a epub:type="toc" href="text/${tocSection.file}">Contents</a></li>` : ''}
${firstBody ? `<li><a epub:type="bodymatter" href="text/${firstBody.file}">Start</a></li>` : ''}
</ol></nav>
</body></html>`;
  put('OEBPS/nav.xhtml', nav);
  manifest.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');

  const ident = book.meta.isbnEbook ? `urn:isbn:${book.meta.isbnEbook.replace(/[^0-9X]/gi, '')}` : `urn:uuid:${book.uuid || (book.uuid = crypto.randomUUID?.() || uid())}`;
  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="${escapeHtml(ident)}"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>
<docTitle><text>${escapeHtml(book.meta.title)}</text></docTitle>
<navMap>
${navItems.map((s, i) => `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${escapeHtml(s.nav || s.title)}</text></navLabel><content src="text/${s.file}"/></navPoint>`).join('\n')}
</navMap>
</ncx>`;
  put('OEBPS/toc.ncx', ncx);
  manifest.push('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>');

  const m = book.meta;
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${escapeHtml(m.language || 'en')}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${escapeHtml(ident)}</dc:identifier>
<dc:title id="title">${escapeHtml(m.title)}</dc:title>
${m.subtitle ? `<dc:title id="subtitle">${escapeHtml(m.subtitle)}</dc:title><meta refines="#subtitle" property="title-type">subtitle</meta><meta refines="#title" property="title-type">main</meta>` : ''}
<dc:creator id="author">${escapeHtml(m.author || 'Unknown')}</dc:creator>
<meta refines="#author" property="role" scheme="marc:relators">aut</meta>
${m.editor ? `<dc:contributor id="editor">${escapeHtml(m.editor)}</dc:contributor><meta refines="#editor" property="role" scheme="marc:relators">edt</meta>` : ''}
${m.illustrator ? `<dc:contributor id="ill">${escapeHtml(m.illustrator)}</dc:contributor><meta refines="#ill" property="role" scheme="marc:relators">ill</meta>` : ''}
<dc:language>${escapeHtml(m.language || 'en')}</dc:language>
${m.publisher ? `<dc:publisher>${escapeHtml(m.publisher)}</dc:publisher>` : ''}
${m.year ? `<dc:date>${escapeHtml(m.year)}</dc:date>` : ''}
${m.description ? `<dc:description>${escapeHtml(m.description)}</dc:description>` : ''}
${(m.keywords || '').split(',').map((k) => k.trim()).filter(Boolean).map((k) => `<dc:subject>${escapeHtml(k)}</dc:subject>`).join('')}
<dc:rights>Copyright © ${escapeHtml(m.year || '')} ${escapeHtml(m.copyrightHolder || m.author || '')}. All rights reserved.</dc:rights>
${m.series ? `<meta property="belongs-to-collection" id="series">${escapeHtml(m.series)}</meta><meta refines="#series" property="collection-type">series</meta>${m.seriesNumber ? `<meta refines="#series" property="group-position">${escapeHtml(m.seriesNumber)}</meta>` : ''}` : ''}
<meta property="dcterms:modified">${modified}</meta>
<meta name="cover" content="cover-image"/>
<meta name="generator" content="Booky"/>
</metadata>
<manifest>
${manifest.join('\n')}
</manifest>
<spine toc="ncx">
${spine.join('\n')}
</spine>
<guide>
<reference type="cover" title="Cover" href="text/cover.xhtml"/>
${tocSection ? `<reference type="toc" title="Contents" href="text/${tocSection.file}"/>` : ''}
${firstBody ? `<reference type="text" title="Start" href="text/${firstBody.file}"/>` : ''}
</guide>
</package>`;
  put('OEBPS/content.opf', opf);

  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}
