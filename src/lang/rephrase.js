// Rule-based sentence reframing: produces alternative phrasings offline.
import { WORDY, REDUNDANT, INTENSIFIED, words } from './grammar.js';
import { THESAURUS } from './thesaurus.js';

const PAST = {
  been: 'was', born: 'bore', beaten: 'beat', become: 'became', begun: 'began', bitten: 'bit', blown: 'blew', broken: 'broke', brought: 'brought',
  built: 'built', bought: 'bought', caught: 'caught', chosen: 'chose', done: 'did', drawn: 'drew', driven: 'drove', eaten: 'ate', fallen: 'fell',
  fed: 'fed', felt: 'felt', fought: 'fought', found: 'found', flown: 'flew', forgotten: 'forgot', forgiven: 'forgave', frozen: 'froze', given: 'gave',
  grown: 'grew', hidden: 'hid', held: 'held', hit: 'hit', hurt: 'hurt', kept: 'kept', known: 'knew', led: 'led', left: 'left', lost: 'lost', made: 'made',
  paid: 'paid', read: 'read', ridden: 'rode', seen: 'saw', sold: 'sold', sent: 'sent', shaken: 'shook', shot: 'shot', shown: 'showed', spoken: 'spoke',
  stolen: 'stole', struck: 'struck', taken: 'took', taught: 'taught', torn: 'tore', told: 'told', thrown: 'threw', understood: 'understood',
  woken: 'woke', worn: 'wore', won: 'won', written: 'wrote',
};

const CONTRACT = [
  ['do not', "don't"], ['does not', "doesn't"], ['did not', "didn't"], ['is not', "isn't"], ['are not', "aren't"], ['was not', "wasn't"],
  ['were not', "weren't"], ['have not', "haven't"], ['has not', "hasn't"], ['had not', "hadn't"], ['will not', "won't"], ['would not', "wouldn't"],
  ['could not', "couldn't"], ['should not', "shouldn't"], ['cannot', "can't"], ['can not', "can't"], ['I am', "I'm"], ['you are', "you're"],
  ['we are', "we're"], ['they are', "they're"], ['it is', "it's"], ['that is', "that's"], ['there is', "there's"], ['I have', "I've"],
  ['I will', "I'll"], ['you will', "you'll"], ['he is', "he's"], ['she is', "she's"], ['let us', "let's"],
];

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const decap = (s) => (/^(I\b|[A-Z]{2,}|[A-Z][a-z]+(?=\s[A-Z]))/.test(s) ? s : s ? s[0].toLowerCase() + s.slice(1) : s);
const tidy = (s) => s.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/^\s+|\s+$/g, '').replace(/^([a-z])/, (m) => m.toUpperCase());

function replacePhrases(text, dict) {
  let out = text;
  for (const [p, r] of Object.entries(dict)) {
    out = out.replace(new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), (m) => (m[0] === m[0].toUpperCase() && r ? cap(r) : r));
  }
  return out;
}

export function simplify(text) {
  let t = replacePhrases(text, WORDY);
  t = replacePhrases(t, REDUNDANT);
  t = t.replace(/\b(really|actually|basically|totally|literally|just|quite|rather|somewhat|definitely)\s+/gi, '');
  return tidy(t);
}

export function strengthen(text) {
  return tidy(replacePhrases(text, INTENSIFIED));
}

export function toActive(text) {
  const m = text.match(/^(.*?)\b(was|were|is|are|has been|have been|had been)\s+(\w+ed|\w+en|\w+)\s+by\s+([^,.;!?]+)(.*)$/i);
  if (!m) return null;
  let [, subject, be, pp, agent, rest] = m;
  subject = subject.trim();
  if (!subject || words(subject).length > 8) return null;
  let verb;
  const lower = pp.toLowerCase();
  if (/^(is|are)$/i.test(be)) verb = (PAST[lower] ? null : lower.replace(/ed$/, '').replace(/([^aeiou])\1$/, '$1')) ;
  else if (/been/i.test(be)) verb = `${/had/i.test(be) ? 'had' : agent.trim().match(/\b(they|we|you|I)\b|s$/i) ? 'have' : 'has'} ${lower}`;
  else verb = PAST[lower] || lower;
  if (!verb) return null;
  if (/^(is|are)$/i.test(be)) verb = /s$/i.test(agent.trim()) && !/ss$/i.test(agent.trim()) ? verb : verb + (/(s|sh|ch|x|z)$/.test(verb) ? 'es' : 's');
  const obj = /^(he|she|they|we|I)$/i.test(subject) ? { he: 'him', she: 'her', they: 'them', we: 'us', i: 'me' }[subject.toLowerCase()] : decap(subject);
  return tidy(`${cap(agent.trim())} ${verb} ${obj}${rest}`);
}

export function split(text) {
  const n = words(text).length;
  if (n < 18) return null;
  const mid = text.length / 2;
  const candidates = [];
  for (const re of [/;\s+/g, /,\s+(and|but|so|yet)\s+/g, /,\s+which\s+/g, /\s+—\s+/g, /,\s+(while|although|because)\s+/g]) {
    for (const m of text.matchAll(re)) candidates.push({ i: m.index, len: m[0].length, conj: m[1] || '', which: /which/.test(m[0]) });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => Math.abs(a.i - mid) - Math.abs(b.i - mid));
  const c = candidates[0];
  const first = text.slice(0, c.i).replace(/[,;]$/, '');
  let second = text.slice(c.i + c.len);
  if (c.which) second = 'This ' + second;
  else if (/^(but|yet|so)$/i.test(c.conj)) second = cap(c.conj) + ' ' + second;
  return tidy(`${first}. ${cap(second)}`);
}

export function contractions(text, mode) {
  let out = text;
  for (const [full, short] of CONTRACT) {
    const [from, to] = mode === 'casual' ? [full, short] : [short, full];
    out = out.replace(new RegExp(`\\b${from.replace("'", "['’]")}\\b`, 'gi'), (m) => (m[0] === m[0].toUpperCase() ? cap(to) : to));
  }
  return out;
}

export function reorder(text) {
  // "When X, Y." -> "Y when X."
  let m = text.match(/^(When|Because|Although|Though|While|If|After|Before|As soon as|Since|Until)\s+([^,]+),\s+(.+?)([.!?]?)$/i);
  if (m) return tidy(`${cap(m[3])} ${m[1].toLowerCase()} ${m[2]}${m[4] || '.'}`);
  // "Y because X." -> "Because X, Y."
  m = text.match(/^(.+?)\s+(because|although|when|while|if|after|before|since|until)\s+(.+?)([.!?]?)$/i);
  if (m && words(m[1]).length > 2 && words(m[3]).length > 2) return tidy(`${cap(m[2])} ${m[3]}, ${decap(m[1])}${m[4] || '.'}`);
  return null;
}

export function concise(text) {
  let t = text
    .replace(/^There (is|are|was|were) (an?|the|some|many|several)?\s*([\w\s]+?) (who|that|which) /i, (all, be, det, noun) => `${cap(((det ? det + ' ' : '') + noun).trim())} `)
    .replace(/\b(said|thought|knew|believed|felt) that\b/gi, '$1')
    .replace(/\bbegan to (\w+)/gi, (all, v) => (v.endsWith('e') ? v + 'd' : v + 'ed'))
    .replace(/\bstarted to (\w+)/gi, (all, v) => (v.endsWith('e') ? v + 'd' : v + 'ed'))
    .replace(/\b(the fact that)\b/gi, 'that');
  return tidy(t);
}

export function varyWords(text, seed = 0) {
  let changed = 0;
  const out = text.replace(/\b([A-Za-z]+)\b/g, (w) => {
    const list = THESAURUS[w.toLowerCase()];
    if (!list || changed >= 2) return w;
    changed++;
    const s = list[(seed + changed) % list.length];
    return w[0] === w[0].toUpperCase() ? cap(s) : s;
  });
  return changed ? out : null;
}

export function rephrase(sentence) {
  const src = sentence.trim();
  const opts = [
    ['Simpler & tighter', simplify(src)],
    ['Active voice', toActive(src)],
    ['Stronger words', strengthen(src)],
    ['More concise', concise(simplify(src))],
    ['Split into two', split(src)],
    ['Reordered', reorder(src)],
    ['Casual (contractions)', contractions(src, 'casual')],
    ['Formal (no contractions)', contractions(src, 'formal')],
    ['Varied word choice', varyWords(src, 0)],
    ['Alternative wording', varyWords(src, 2)],
  ];
  const seen = new Set([src.toLowerCase()]);
  return opts
    .filter(([, t]) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
    .map(([label, text]) => ({ label, text }));
}
