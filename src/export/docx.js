// DOCX export: a clean Word manuscript with real styles, footnotes and images —
// handy for editors, agents and print services that ask for Word files.
import JSZip from 'jszip';
import { includedElements } from '../render/book.js';
import { computeNumbers, chapterLabel, fillPlaceholders, fillText, ELEMENT_TYPES, escapeHtml } from '../core/model.js';
import { trimOf, SCENE_BREAKS } from '../core/themes.js';
import { ensureReviews, locateQuote, COMMENT_TYPES } from '../core/feedback.js';

const x = (s) => escapeHtml(String(s ?? '')).replace(/&#39;/g, '&apos;');
const TW = (inch) => Math.round(inch * 1440);
const HP = (pt) => Math.round(pt * 2);

function runProps(m) {
  let p = m.cs ? `<w:rStyle w:val="CS_${String(m.cs).replace(/[^\w]/g, '_')}"/>` : '';
  if (m.font) p += `<w:rFonts w:ascii="${x(m.font)}" w:hAnsi="${x(m.font)}" w:cs="${x(m.font)}"/>`;
  if (m.b) p += '<w:b/>';
  if (m.i) p += '<w:i/>';
  if (m.sc) p += '<w:smallCaps/>';
  if (m.s) p += '<w:strike/>';
  if (m.color) p += `<w:color w:val="${m.color.replace('#', '')}"/>`;
  if (m.size) p += `<w:sz w:val="${HP(m.size)}"/>`;
  if (m.hl) p += '<w:highlight w:val="yellow"/>';
  if (m.u) p += '<w:u w:val="single"/>';
  if (m.sup) p += '<w:vertAlign w:val="superscript"/>';
  if (m.sub) p += '<w:vertAlign w:val="subscript"/>';
  return p ? `<w:rPr>${p}</w:rPr>` : '';
}

const parsePt = (v) => {
  if (!v) return null;
  const n = parseFloat(v);
  if (/px/.test(v)) return n * 0.75;
  if (/em/.test(v)) return n * 12;
  return n;
};
const cssColor = (v) => {
  if (!v) return null;
  if (v.startsWith('#')) return v.length === 4 ? '#' + [...v.slice(1)].map((c) => c + c).join('') : v;
  const m = v.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? '#' + m.slice(1, 4).map((n) => (+n).toString(16).padStart(2, '0')).join('') : null;
};

export async function buildDocx(book, { forEditor = false } = {}) {
  const zip = new JSZip();
  // No directory entries: some validators and readers dislike them.
  const put = (path, data, opts = {}) => zip.file(path, data, { createFolders: false, ...opts });
  const f = book.format;
  const { w, h } = trimOf(f);
  const nums = computeNumbers(book);
  const media = [];
  const footnotes = [];
  const rels = [];
  let relId = 10;
  // For an editor: tracked changes become Word revisions and open Booky comments become Word comments.
  let revId = 100;
  const wordComments = [];
  let paraState = null; // { pos, inserts: [{ at, xml }] } while writing one paragraph
  const R = forEditor ? ensureReviews(book) : null;
  const reviewerName = (id) => R?.reviewers.find((r) => r.id === id)?.name || 'Reviewer';
  const isoDate = (t) => new Date(+t || Date.now()).toISOString().replace(/\.\d+Z$/, 'Z');

  function imageRun(img) {
    const src = img.getAttribute('src') || '';
    const m = src.match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/);
    if (!m) return '';
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const name = `image${media.length + 1}.${ext}`;
    media.push({ name, data: m[2] });
    const rid = `rId${++relId}`;
    rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`);
    const textW = w - f.margins.inside - f.margins.outside;
    const pct = (+img.getAttribute('data-width') || 100) / 100;
    const natW = img.naturalWidth || 1200, natH = img.naturalHeight || 800;
    const cx = Math.round(textW * pct * 914400);
    const cy = Math.round(cx * (natH / natW));
    const n = media.length;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }

  function runs(node, marks = {}) {
    let out = '';
    for (const c of node.childNodes) {
      if (c.nodeType === 3) {
        if (!c.data) continue;
        if (!paraState?.inserts.length) { out += `<w:r>${runProps(marks)}<w:t xml:space="preserve">${x(c.data)}</w:t></w:r>`; if (paraState) paraState.pos += c.data.length; continue; }
        // comment ranges start and end inside this text
        let i = 0;
        const start = paraState.pos;
        for (const ins of paraState.inserts.filter((q) => q.at >= start && q.at < start + c.data.length && !q.done)) {
          const cut = ins.at - start;
          if (cut > i) out += `<w:r>${runProps(marks)}<w:t xml:space="preserve">${x(c.data.slice(i, cut))}</w:t></w:r>`;
          out += ins.xml; ins.done = true; i = cut;
        }
        if (i < c.data.length) out += `<w:r>${runProps(marks)}<w:t xml:space="preserve">${x(c.data.slice(i))}</w:t></w:r>`;
        paraState.pos += c.data.length;
        continue;
      }
      if (c.nodeType !== 1) continue;
      const tag = c.tagName.toLowerCase();
      const m = { ...marks };
      if (tag === 'strong' || tag === 'b') m.b = true;
      if (tag === 'em' || tag === 'i') m.i = true;
      if (tag === 'u') m.u = true;
      if (tag === 's' || tag === 'strike') m.s = true;
      if (tag === 'sup') m.sup = true;
      if (tag === 'sub') m.sub = true;
      if (tag === 'mark') m.hl = true;
      if (c.classList?.contains('sc')) m.sc = true;
      const cs = c.getAttribute?.('data-cs') || (String(c.className || '').match(/\bcs-([\w-]+)/) || [])[1];
      if (cs) m.cs = cs;
      if (tag === 'span' && c.getAttribute('style')) {
        const st = c.style;
        if (st.fontFamily) m.font = st.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        if (st.fontSize) m.size = parsePt(st.fontSize);
        if (st.color) m.color = cssColor(st.color);
      }
      if (tag === 'br') { out += '<w:r><w:br/></w:r>'; continue; }
      if (tag === 'img') { out += imageRun(c); continue; }
      if (c.getAttribute('data-type') === 'footnote') {
        const id = footnotes.length + 1;
        footnotes.push(c.getAttribute('data-note') || '');
        out += `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`;
        continue;
      }
      if (c.getAttribute('data-type') === 'index') {
        // Word index entry field: Insert → Index in Word builds the index from these
        const q = (v) => String(v || '').replace(/"/g, "'").replace(/:/g, ' ');
        const sub = c.getAttribute('data-sub'), see = c.getAttribute('data-see') || c.getAttribute('data-see-also');
        const instr = ` XE "${q(c.getAttribute('data-term'))}${sub ? `:${q(sub)}` : ''}"${see ? ` \\t "See ${q(see)}"` : ''} `;
        out += `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">${x(instr)}</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
        continue;
      }
      if (c.getAttribute('data-type') === 'authornote') continue; // notes to self stay in Booky
      if (c.classList?.contains('tc-ins') || c.classList?.contains('tc-del')) {
        const inner = runs(c, m);
        if (!forEditor) { if (c.classList.contains('tc-ins')) out += inner; continue; } // a clean manuscript shows the changes accepted
        const a = `w:id="${++revId}" w:author="${x(c.getAttribute('data-author') || 'Author')}" w:date="${isoDate(c.getAttribute('data-at'))}"`;
        out += c.classList.contains('tc-ins') ? `<w:ins ${a}>${inner}</w:ins>` : `<w:del ${a}>${inner.replace(/<w:t /g, '<w:delText ').replace(/<\/w:t>/g, '</w:delText>')}</w:del>`;
        continue;
      }
      if (c.getAttribute('data-type') === 'xref') { out += `<w:r>${runProps(m)}<w:t xml:space="preserve">${x(c.getAttribute('data-label') || '')}</w:t></w:r>`; if (paraState) paraState.pos += (c.getAttribute('data-label') || '').length; continue; }
      out += runs(c, m);
    }
    return out;
  }

  const STYLE_FOR = { noindent: 'NoIndent', verse: 'Verse', epigraph: 'Epigraph', attribution: 'Attribution', caption: 'Caption', letter: 'Letter', signature: 'Attribution', callout: 'Callout', hanging: 'Hanging', small: 'Small', display: 'Title', subtitle: 'Subtitle', author: 'AuthorLine', spacer: 'NoIndent' };

  function para(style, inner, extra = '') {
    return `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>${inner}</w:p>`;
  }
  // Text of a block as the runs write it (for placing comments).
  const blockText = (n) => { let t = ''; const walk = (e) => { for (const c of e.childNodes) { if (c.nodeType === 3) t += c.data; else if (c.nodeType === 1) { if (c.getAttribute('data-type') === 'xref') t += c.getAttribute('data-label') || ''; else if (c.getAttribute('data-type') !== 'authornote') walk(c); } } }; walk(n); return t; };
  /** Runs for a paragraph, with comment ranges placed (only when writing for an editor). */
  function runsWith(n) {
    const cms = n.__comments;
    if (!cms?.length) return runs(n);
    paraState = { pos: 0, inserts: [] };
    for (const c of cms) {
      const id = wordComments.length;
      wordComments.push(c);
      paraState.inserts.push({ at: c.start, xml: `<w:commentRangeStart w:id="${id}"/>` });
      paraState.inserts.push({ at: c.end, end: true, xml: `<w:commentRangeEnd w:id="${id}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${id}"/></w:r>` });
    }
    paraState.inserts.sort((a, b) => a.at - b.at || (a.end ? 1 : -1));
    let out = runs(n);
    for (const q of paraState.inserts) if (!q.done) out += q.xml; // ranges that end at the end of the paragraph
    paraState = null;
    return out;
  }

  function blocks(root, opts = {}) {
    let out = '';
    let first = true;
    let afterBreak = false;
    for (const n of root.children) {
      const tag = n.tagName.toLowerCase();
      if (n.getAttribute('data-only') === 'ebook') continue; // a Word file is a print manuscript
      const align = n.style?.textAlign;
      const jc = align ? `<w:jc w:val="${align === 'justify' ? 'both' : align}"/>` : '';
      if (/^h[1-4]$/.test(tag)) { out += para(`Heading${Math.min(4, +tag[1] + (opts.shift || 0))}`, runsWith(n), jc); afterBreak = true; continue; }
      if (tag === 'p') {
        const ps = (n.className.match(/ps-([\w-]+)/) || [])[1];
        const custom = ps && (f.customParaStyles || []).some((c) => c.id === ps);
        const style = custom ? `PS_${ps.replace(/[^\w]/g, '_')}` : ps ? STYLE_FOR[ps] : first || afterBreak ? 'FirstParagraph' : null;
        out += para(style, runsWith(n), jc);
        first = false; afterBreak = false;
        continue;
      }
      if (tag === 'blockquote') { n.querySelectorAll(':scope > p').forEach((p) => { out += para('Quote', runs(p)); }); afterBreak = true; continue; }
      if (tag === 'ul' || tag === 'ol') {
        let i = 0;
        n.querySelectorAll(':scope > li').forEach((li) => { i++; out += para('ListPara', `<w:r><w:t xml:space="preserve">${tag === 'ol' ? `${i}.` : '•'}\t</w:t></w:r>${runs(li.querySelector('p') || li)}`); });
        afterBreak = true;
        continue;
      }
      if (n.getAttribute('data-type') === 'scene-break' || tag === 'hr') {
        const sb = f.sceneBreak;
        out += para('SceneBreak', `<w:r><w:t>${x(sb.style === 'custom' ? sb.custom : SCENE_BREAKS[sb.style] || '* * *')}</w:t></w:r>`);
        afterBreak = true;
        continue;
      }
      if (n.getAttribute('data-type') === 'page-break') { out += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; continue; }
      if (tag === 'img') { out += para('Figure', imageRun(n)); continue; }
      out += para(null, runs(n));
    }
    return out;
  }

  // Load images so we know their natural sizes
  const preload = (html) => Promise.all([...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = m[1]; })));

  let body = '';
  const els = includedElements(book, 'print').filter((e) => e.type !== 'toc' && e.type !== 'blank');
  let firstEl = true;
  for (const el of els) {
    const html = fillPlaceholders(el.content, book);
    await preload(html);
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    // Images were preloaded above, so their natural sizes are known once adopted.
    const holder = document.createElement('div');
    holder.appendChild(document.importNode(tpl.content, true));
    const def = ELEMENT_TYPES[el.type] || {};
    // A bookmark per chapter lets Booky match the paragraphs when the file comes back from an editor.
    body += `<w:bookmarkStart w:id="${++revId}" w:name="${`bk_${String(el.id).replace(/[^\w]/g, '_')}`.slice(0, 40)}"/><w:bookmarkEnd w:id="${revId}"/>`;
    if (R) {
      for (const c of R.comments.filter((x) => x.elId === el.id && x.status === 'open')) {
        for (const n of holder.children) {
          if (!/^(P|H[1-4])$/.test(n.tagName)) continue;
          const hit = locateQuote(blockText(n), c);
          if (!hit) continue;
          (n.__comments ||= []).push({ start: hit.start, end: hit.end, author: reviewerName(c.reviewerId), date: isoDate(c.createdAt), text: `${COMMENT_TYPES[c.type]?.label && c.type !== 'comment' ? `${COMMENT_TYPES[c.type].label}: ` : ''}${c.note || ''}${c.suggestion != null ? `\nSuggested: ${c.suggestion}` : ''}`, reply: c.reply ? `${book.meta.author || 'Author'}: ${c.reply}` : '' });
          break;
        }
      }
    }
    const brk = firstEl ? '' : '<w:pageBreakBefore/>';
    firstEl = false;
    const label = el.type === 'chapter' || el.type === 'part' ? chapterLabel(book, el, nums) : '';
    const title = fillText(el.title, book);
    if (def.heading && el.showTitle !== false) {
      const headStyle = el.type === 'part' ? 'PartTitle' : 'Heading1';
      if (label && title) {
        body += para('ChapterNumber', `<w:r><w:t>${x(label)}</w:t></w:r>`, brk);
        body += para(headStyle, `<w:r><w:t>${x(title)}</w:t></w:r>`);
      } else {
        // A numbered chapter without a title uses its number as the heading (keeps Word's navigation useful).
        body += para(headStyle, `<w:r><w:t>${x(title || label)}</w:t></w:r>`, brk);
      }
      if (el.subtitle) body += para('Subtitle', `<w:r><w:t>${x(el.subtitle)}</w:t></w:r>`);
    } else if (brk) body += `<w:p><w:pPr>${brk}</w:pPr></w:p>`;
    body += blocks(holder, { shift: 0 });
  }

  const bodyFont = f.body.font, headFont = f.headings.font;
  const indent = f.body.spacing === 'indent' ? Math.round(f.body.indent * f.body.size * 20) : 0;
  const line = Math.round(f.body.leading * 240);
  const after = f.body.spacing === 'block' ? Math.round(f.body.paraGap * f.body.size * 20) : 0;
  // Format → Paragraph styles: the author's adjustments become part of the Word styles
  const OVR_FOR = Object.fromEntries(Object.entries(STYLE_FOR).map(([ps, st]) => [st, ps]));
  const ovrXml = (o) => {
    if (!o) return { ppr: '', rpr: '' };
    const em = (v) => Math.round(+v * f.body.size * 20);
    const sp = [o.above !== '' && o.above != null ? `w:before="${em(o.above)}"` : '', o.below !== '' && o.below != null ? `w:after="${em(o.below)}"` : ''].filter(Boolean).join(' ');
    return {
      ppr: `${sp ? `<w:spacing ${sp}/>` : ''}${o.indent !== '' && o.indent != null ? `<w:ind w:firstLine="${Math.max(0, em(o.indent))}"/>` : ''}${o.align ? `<w:jc w:val="${o.align === 'justify' ? 'both' : o.align}"/>` : ''}`,
      rpr: `${o.font ? `<w:rFonts w:ascii="${x(o.font)}" w:hAnsi="${x(o.font)}"/>` : ''}${o.italic ? '<w:i/>' : ''}${o.size && +o.size !== 1 ? `<w:sz w:val="${HP(f.body.size * +o.size)}"/>` : ''}`,
    };
  };
  const pStyle = (id, name, ppr, rpr, basedOn = 'Normal') => { const o = ovrXml((f.paraStyles || {})[OVR_FOR[id]]); return `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="${basedOn}"/><w:qFormat/><w:pPr>${ppr}${o.ppr}</w:pPr><w:rPr>${rpr}${o.rpr}</w:rPr></w:style>`; };
  const customStyles = (f.customParaStyles || []).map((c) => { const o = ovrXml(c); return `<w:style w:type="paragraph" w:styleId="PS_${c.id.replace(/[^\w]/g, '_')}"><w:name w:val="${x(c.label || c.id)}"/><w:basedOn w:val="${STYLE_FOR[c.basedOn] || 'Normal'}"/><w:qFormat/><w:pPr>${o.ppr}</w:pPr><w:rPr>${o.rpr}</w:rPr></w:style>`; }).join('');
  const charStyles = (f.charStyles || []).map((c) => `<w:style w:type="character" w:customStyle="1" w:styleId="CS_${String(c.id).replace(/[^\w]/g, '_')}"><w:name w:val="${x(c.name || c.id)}"/><w:qFormat/><w:rPr>${c.font ? `<w:rFonts w:ascii="${x(c.font)}" w:hAnsi="${x(c.font)}"/>` : ''}${c.bold ? '<w:b/>' : ''}${c.italic ? '<w:i/>' : ''}${c.smallCaps ? '<w:smallCaps/>' : ''}${c.underline ? '<w:u w:val="single"/>' : ''}${c.color ? `<w:color w:val="${String(c.color).replace('#', '')}"/>` : ''}${c.letterSpacing ? `<w:spacing w:val="${Math.round(+c.letterSpacing * f.body.size * 20)}"/>` : ''}${c.size && +c.size !== 1 ? `<w:sz w:val="${HP(f.body.size * +c.size)}"/>` : ''}</w:rPr></w:style>`).join('');
  const hfont = `<w:rFonts w:ascii="${x(headFont)}" w:hAnsi="${x(headFont)}"/>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${x(bodyFont)}" w:hAnsi="${x(bodyFont)}" w:cs="${x(bodyFont)}" w:eastAsia="${x(bodyFont)}"/><w:sz w:val="${HP(f.body.size)}"/><w:lang w:val="${x(book.meta.language || 'en')}"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="${after}" w:line="${line}" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:firstLine="${indent}"/><w:jc w:val="${f.body.align === 'justify' ? 'both' : 'left'}"/></w:pPr></w:style>
${pStyle('FirstParagraph', 'First Paragraph', '<w:ind w:firstLine="0"/>', '')}
${pStyle('NoIndent', 'No Indent', '<w:ind w:firstLine="0"/>', '')}
${pStyle('Heading1', 'heading 1', `<w:keepNext/><w:spacing w:before="${TW(f.headings.sink * 0.6)}" w:after="${TW(f.headings.afterSpace)}"/><w:ind w:firstLine="0"/><w:jc w:val="${f.headings.align === 'center' ? 'center' : f.headings.align}"/><w:outlineLvl w:val="0"/>`, `${hfont}<w:sz w:val="${HP(f.headings.titleSize)}"/>${f.headings.titleWeight >= 700 ? '<w:b/>' : ''}${f.headings.titleItalic ? '<w:i/>' : ''}${f.headings.titleCase === 'upper' ? '<w:caps/>' : ''}`)}
${pStyle('ChapterNumber', 'Chapter Number', `<w:keepNext/><w:spacing w:before="${TW(f.headings.sink * 0.6)}" w:after="120"/><w:ind w:firstLine="0"/><w:jc w:val="${f.headings.align === 'center' ? 'center' : f.headings.align}"/>`, `<w:rFonts w:ascii="${x(f.headings.numberFont || headFont)}" w:hAnsi="${x(f.headings.numberFont || headFont)}"/><w:sz w:val="${HP(f.headings.numberSize)}"/><w:spacing w:val="${Math.round(f.headings.numberSpacing * f.headings.numberSize * 20)}"/>`)}
${pStyle('PartTitle', 'Part Title', `<w:keepNext/><w:spacing w:before="2880" w:after="240"/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/>`, `${hfont}<w:sz w:val="${HP(f.headings.partSize)}"/>`)}
${pStyle('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="320" w:after="120"/><w:ind w:firstLine="0"/><w:outlineLvl w:val="1"/>', `${hfont}<w:b/><w:sz w:val="${HP(f.headings.h2Size)}"/>`)}
${pStyle('Heading3', 'heading 3', '<w:keepNext/><w:spacing w:before="240" w:after="80"/><w:ind w:firstLine="0"/><w:outlineLvl w:val="2"/>', `${hfont}<w:b/><w:i/><w:sz w:val="${HP(f.headings.h3Size)}"/>`)}
${pStyle('Heading4', 'heading 4', '<w:keepNext/><w:spacing w:before="200" w:after="60"/><w:ind w:firstLine="0"/><w:outlineLvl w:val="3"/>', '<w:smallCaps/>')}
${pStyle('Title', 'Title', '<w:spacing w:before="1440" w:after="240"/><w:ind w:firstLine="0"/><w:jc w:val="center"/>', `${hfont}<w:sz w:val="${HP(f.body.size * 2.6)}"/>`)}
${pStyle('Subtitle', 'Subtitle', '<w:spacing w:after="240"/><w:ind w:firstLine="0"/><w:jc w:val="center"/>', `${hfont}<w:i/><w:sz w:val="${HP(f.body.size * 1.3)}"/>`)}
${pStyle('AuthorLine', 'Author Line', '<w:spacing w:before="480"/><w:ind w:firstLine="0"/><w:jc w:val="center"/>', `${hfont}<w:caps/><w:spacing w:val="40"/><w:sz w:val="${HP(f.body.size * 1.3)}"/>`)}
${pStyle('Quote', 'Quote', '<w:ind w:left="720" w:right="720" w:firstLine="0"/><w:spacing w:before="120" w:after="120"/>', '')}
${pStyle('Verse', 'Verse', '<w:ind w:firstLine="0"/><w:jc w:val="left"/><w:spacing w:after="240"/>', '')}
${pStyle('Epigraph', 'Epigraph', '<w:ind w:left="720" w:right="720" w:firstLine="0"/><w:jc w:val="center"/>', '<w:i/>')}
${pStyle('Attribution', 'Attribution', '<w:ind w:firstLine="0"/><w:jc w:val="right"/><w:spacing w:after="240"/>', '')}
${pStyle('Caption', 'Caption', '<w:ind w:firstLine="0"/><w:jc w:val="center"/><w:spacing w:after="240"/>', `<w:i/><w:sz w:val="${HP(f.body.size * 0.85)}"/>`)}
${pStyle('Letter', 'Letter', '<w:ind w:left="720" w:right="720" w:firstLine="0"/>', '<w:i/>')}
${pStyle('Callout', 'Callout', '<w:ind w:firstLine="0"/><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="888888"/><w:left w:val="single" w:sz="4" w:space="4" w:color="888888"/><w:bottom w:val="single" w:sz="4" w:space="4" w:color="888888"/><w:right w:val="single" w:sz="4" w:space="4" w:color="888888"/></w:pBdr>', '')}
${pStyle('Hanging', 'Hanging', '<w:ind w:left="720" w:hanging="720"/><w:jc w:val="left"/>', '')}
${pStyle('Small', 'Small Print', '<w:ind w:firstLine="0"/><w:jc w:val="left"/><w:spacing w:after="120"/>', `<w:sz w:val="${HP(f.body.size * 0.8)}"/>`)}
${pStyle('SceneBreak', 'Scene Break', '<w:ind w:firstLine="0"/><w:jc w:val="center"/><w:spacing w:before="200" w:after="200"/>', '')}
${pStyle('ListPara', 'List Paragraph', '<w:ind w:left="720" w:hanging="360"/>', '')}
${pStyle('Figure', 'Figure', '<w:ind w:firstLine="0"/><w:jc w:val="center"/><w:spacing w:before="200" w:after="120"/>', '')}
${pStyle('FootnoteText', 'footnote text', '<w:ind w:firstLine="0"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', `<w:sz w:val="${HP(f.body.size * 0.8)}"/>`)}
${customStyles}${charStyles}${pStyle('CommentText', 'annotation text', '<w:ind w:firstLine="0"/>', '<w:sz w:val="20"/>')}<w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:rPr><w:sz w:val="16"/></w:rPr></w:style><w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>
</w:styles>`;

  const m = f.margins;
  const sect = `<w:sectPr><w:footnotePr><w:numFmt w:val="decimal"/></w:footnotePr><w:pgSz w:w="${TW(w)}" w:h="${TW(h)}"/><w:pgMar w:top="${TW(m.top)}" w:right="${TW(m.outside)}" w:bottom="${TW(m.bottom)}" w:left="${TW(m.inside)}" w:header="${TW(m.top / 2)}" w:footer="${TW(m.bottom / 2)}" w:gutter="0"/><w:pgNumType w:start="1"/></w:sectPr>`;

  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  put('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`);
  put('word/styles.xml', styles);
  put('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:mirrorMargins/><w:defaultTabStop w:val="720"/><w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
  put('word/footnotes.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:footnotes ${NS}><w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>${footnotes.map((t, i) => `<w:footnote w:id="${i + 1}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> ${x(t)}</w:t></w:r></w:p></w:footnote>`).join('')}</w:footnotes>`);
  media.forEach((md) => put(`word/media/${md.name}`, md.data, { base64: true }));
  if (wordComments.length) {
    put('word/comments.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:comments ${NS}>${wordComments.map((c, i) => `<w:comment w:id="${i}" w:author="${x(c.author)}" w:date="${c.date}" w:initials="${x(c.author.split(/\s+/).map((w) => w[0] || '').join('').slice(0, 3))}">${[c.text, c.reply].filter(Boolean).join('\n').split('\n').map((line, k) => `<w:p><w:pPr><w:pStyle w:val="CommentText"/></w:pPr>${k === 0 ? '<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:annotationRef/></w:r>' : ''}<w:r><w:t xml:space="preserve">${x(line)}</w:t></w:r></w:p>`).join('')}</w:comment>`).join('')}</w:comments>`);
    rels.push('<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>');
  }
  put('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>${rels.join('')}</Relationships>`);
  put('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  put('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(book.meta.title)}</dc:title><dc:creator>${x(book.meta.author)}</dc:creator><dc:language>${x(book.meta.language || 'en')}</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`);
  put('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>${wordComments.length ? '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>' : ''}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
