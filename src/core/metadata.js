// Store metadata helpers: keyword limits and contributor roles (pure, unit-tested).

export const KDP_KEYWORD_LIMIT = 7;
export const KEYWORD_MAX_CHARS = 50;

/** Keywords split from the comma/semicolon/line separated field, with problems noted. */
export function keywordReport(raw) {
  const list = String(raw || '').split(/[,;\n]/).map((k) => k.trim()).filter(Boolean);
  const long = list.filter((k) => k.length > KEYWORD_MAX_CHARS);
  return { list, long, over: Math.max(0, list.length - KDP_KEYWORD_LIMIT) };
}

/** Contributors with roles, from the named fields and the free “Name — role” list. */
export function contributorList(m) {
  const out = [['Author', m.author]];
  if (m.editor) out.push(['Editor', m.editor]);
  if (m.illustrator) out.push(['Illustrator', m.illustrator]);
  if (m.coverDesigner) out.push(['Cover design', m.coverDesigner]);
  if (m.translator) out.push(['Translator', m.translator]);
  for (const line of String(m.contributors || '').split('\n').map((l) => l.trim()).filter(Boolean)) {
    const [name, role] = line.split(/\s+[—–-]\s+|\s*\|\s*/);
    out.push([role || 'Contributor', name]);
  }
  return out.filter(([, n]) => n);
}
