// Plain text and Markdown → HTML (pure functions, no DOM).
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const SCENE_LINE = /^\s*(\*\s*\*\s*\*|#|~|\*{3,}|-{3,}|_{3,}|•\s*•\s*•|⁂|❦)\s*$/;

function inline(s) {
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (m, a, b) => `<strong>${a || b}</strong>`)
    .replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_(?!\s)(.+?)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '$1');
}

export function markdownToHtml(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null;
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
  };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); closeList(); continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flush(); closeList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if (SCENE_LINE.test(line)) { flush(); closeList(); out.push('<div data-type="scene-break"></div>'); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flush(); closeList(); out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`); continue; }
    if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) { flush(); if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li><p>${inline(m[1])}</p></li>`); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flush(); if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li><p>${inline(m[1])}</p></li>`); continue; }
    if (line.endsWith('  ')) { para.push(line.trim() + '\u2028'); continue; }
    para.push(line.trim());
  }
  flush();
  closeList();
  return out.join('\n').replace(/\u2028 ?/g, '<br>').replace(/<\/blockquote>\n<blockquote>/g, '');
}

export function textToHtml(text) {
  const t = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  // If the text uses blank lines between paragraphs, split on those; otherwise each line is a paragraph.
  const blocks = /\n\s*\n/.test(t) ? t.split(/\n\s*\n/) : t.split('\n');
  return blocks
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      if (SCENE_LINE.test(b)) return '<div data-type="scene-break"></div>';
      const single = b.replace(/\s*\n\s*/g, ' ');
      if (single.length < 70 && /^(chapter\b|part\b|prologue\b|epilogue\b|([IVXLC]+|\d{1,3})\.?$)/i.test(single)) return `<h1>${esc(single)}</h1>`;
      return `<p>${esc(single)}</p>`;
    })
    .join('\n');
}

export function htmlToMarkdown(html) {
  return html
    .replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (m, l, t) => `\n${'#'.repeat(+l)} ${t}\n`)
    .replace(/<div data-type="scene-break"[^>]*><\/div>|<hr[^>]*>/gi, '\n* * *\n')
    .replace(/<div data-type="page-break"[^>]*><\/div>/gi, '\n')
    .replace(/<span data-type="footnote"[^>]*data-note="([^"]*)"[^>]*><\/span>/gi, (m, n) => `[^${n}]`)
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (m, t) => t.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n> $1\n'))
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, t) => `- ${t.replace(/<\/?p[^>]*>/g, '')}\n`)
    .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<s>([\s\S]*?)<\/s>/gi, '~~$1~~')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img [^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
    .replace(/<br\s*\/?>/gi, '  \n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
