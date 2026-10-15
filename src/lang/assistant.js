// Booky's writing assistant: paraphrase in several modes, fix grammar and punctuation, and summarise —
// on the device, with no internet and no AI service (pure, unit-tested).
// Paraphrase modes work on English; fixing punctuation and summarising work in every language.
import { checkText, WORDY, REDUNDANT, INTENSIFIED } from './grammar.js';
import { THESAURUS } from './thesaurus.js';
import { simplify, toActive, split, contractions, reorder, frontSimile, frontPhrase, concise } from './rephrase.js';
import { checkPunctuation } from './punctuation.js';
import { splitSentences } from '../core/writing.js';

const isEn = (lang) => String(lang || 'en').toLowerCase().startsWith('en');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const tidy = (s) => s.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([,.;:!?])/g, '$1').replace(/^\s+|\s+$/g, '').replace(/^([a-z])/, (m) => m.toUpperCase());
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- word lists ----------
// More words whose synonyms can be swapped without knowing the context (adjectives, adverbs, past-tense verbs).
export const MORE_SYNONYMS = {
  amazing: ['remarkable', 'astonishing', 'extraordinary', 'stunning'], awful: ['dreadful', 'terrible', 'appalling', 'atrocious'],
  brave: ['courageous', 'bold', 'fearless', 'daring'], brief: ['short', 'fleeting', 'quick', 'concise'], busy: ['occupied', 'engaged', 'hectic', 'bustling'],
  careful: ['cautious', 'wary', 'meticulous', 'attentive'], certain: ['sure', 'confident', 'positive', 'convinced'], cheap: ['inexpensive', 'affordable', 'low-cost'],
  clear: ['plain', 'obvious', 'evident', 'distinct'], clever: ['bright', 'shrewd', 'astute', 'ingenious'], common: ['ordinary', 'usual', 'everyday', 'widespread'],
  complete: ['whole', 'entire', 'full', 'total'], correct: ['right', 'accurate', 'exact', 'precise'], crazy: ['wild', 'mad', 'absurd', 'insane'],
  curious: ['inquisitive', 'intrigued', 'interested', 'nosy'], dangerous: ['perilous', 'hazardous', 'risky', 'treacherous'], dead: ['lifeless', 'deceased', 'gone'],
  deep: ['profound', 'bottomless', 'cavernous'], difficult: ['hard', 'tough', 'challenging', 'demanding'], dull: ['boring', 'tedious', 'drab', 'flat'],
  eager: ['keen', 'enthusiastic', 'avid', 'impatient'], empty: ['bare', 'vacant', 'hollow', 'deserted'], enormous: ['huge', 'vast', 'immense', 'colossal'],
  exciting: ['thrilling', 'exhilarating', 'stirring', 'gripping'], famous: ['renowned', 'celebrated', 'well-known', 'acclaimed'], fierce: ['ferocious', 'savage', 'fiery', 'intense'],
  fine: ['good', 'excellent', 'splendid', 'fine-grained'], foolish: ['silly', 'unwise', 'senseless', 'reckless'], fresh: ['new', 'crisp', 'clean', 'unspoiled'],
  friendly: ['kind', 'warm', 'amiable', 'cordial'], funny: ['amusing', 'comical', 'witty', 'hilarious'], gentle: ['soft', 'mild', 'tender', 'kind'],
  gloomy: ['dark', 'dim', 'dismal', 'bleak'], glad: ['happy', 'pleased', 'delighted', 'thankful'], grateful: ['thankful', 'appreciative', 'obliged'],
  heavy: ['weighty', 'hefty', 'massive', 'cumbersome'], honest: ['truthful', 'sincere', 'frank', 'candid'], huge: ['enormous', 'vast', 'immense', 'gigantic'],
  important: ['crucial', 'vital', 'essential', 'significant'], kind: ['caring', 'gentle', 'generous', 'considerate'], lazy: ['idle', 'sluggish', 'slothful'],
  lonely: ['alone', 'isolated', 'solitary', 'forlorn'], lucky: ['fortunate', 'blessed', 'favoured'], main: ['chief', 'principal', 'primary', 'central'],
  mean: ['unkind', 'cruel', 'nasty', 'spiteful'], messy: ['untidy', 'cluttered', 'chaotic', 'disordered'], modern: ['current', 'contemporary', 'up-to-date'],
  narrow: ['thin', 'slim', 'tight', 'cramped'], necessary: ['needed', 'essential', 'required', 'vital'], neat: ['tidy', 'orderly', 'trim', 'smart'],
  obvious: ['clear', 'plain', 'evident', 'apparent'], odd: ['strange', 'peculiar', 'unusual', 'curious'], polite: ['courteous', 'respectful', 'civil', 'gracious'],
  popular: ['well-liked', 'favoured', 'in demand', 'fashionable'], proud: ['pleased', 'honoured', 'dignified'], quickly: ['swiftly', 'rapidly', 'hastily', 'promptly'],
  rare: ['uncommon', 'scarce', 'unusual', 'infrequent'], ready: ['prepared', 'set', 'willing'], real: ['genuine', 'actual', 'true', 'authentic'],
  rough: ['coarse', 'uneven', 'harsh', 'rugged'], rude: ['impolite', 'discourteous', 'insolent', 'blunt'], safe: ['secure', 'protected', 'unharmed'],
  serious: ['grave', 'solemn', 'earnest', 'severe'], sharp: ['keen', 'pointed', 'acute', 'piercing'], shy: ['timid', 'bashful', 'reserved', 'diffident'],
  silent: ['quiet', 'hushed', 'mute', 'still'], simple: ['easy', 'plain', 'basic', 'straightforward'], slowly: ['gradually', 'unhurriedly', 'leisurely'],
  soft: ['gentle', 'tender', 'smooth', 'mild'], sudden: ['abrupt', 'unexpected', 'swift'], suddenly: ['abruptly', 'all at once', 'without warning'],
  sweet: ['sugary', 'pleasant', 'charming', 'lovely'], terrible: ['awful', 'dreadful', 'horrible', 'dire'], thin: ['slim', 'slender', 'lean', 'gaunt'],
  tiny: ['minute', 'little', 'minuscule', 'small'], tough: ['hard', 'strong', 'resilient', 'demanding'], true: ['accurate', 'correct', 'genuine', 'real'],
  usual: ['normal', 'typical', 'customary', 'regular'], useful: ['helpful', 'handy', 'valuable', 'practical'], warm: ['cosy', 'mild', 'balmy', 'heated'],
  wild: ['untamed', 'fierce', 'unruly', 'savage'], wise: ['sage', 'sensible', 'shrewd', 'prudent'], worried: ['anxious', 'uneasy', 'troubled', 'concerned'],
  wrong: ['incorrect', 'mistaken', 'false', 'erroneous'], young: ['youthful', 'juvenile', 'fresh'], quietly: ['softly', 'silently', 'gently'],
  carefully: ['cautiously', 'gingerly', 'attentively'], completely: ['entirely', 'totally', 'wholly', 'fully'], finally: ['at last', 'eventually', 'in the end'],
  immediately: ['at once', 'instantly', 'straight away'], usually: ['normally', 'generally', 'typically'], probably: ['likely', 'presumably', 'no doubt'],
  also: ['too', 'as well', 'besides'], often: ['frequently', 'regularly', 'repeatedly'], however: ['yet', 'still', 'nevertheless'],
  gazed: ['stared', 'looked', 'peered'], stared: ['gazed', 'glared', 'peered'], replied: ['answered', 'responded', 'returned'], answered: ['replied', 'responded'],
  murmured: ['whispered', 'muttered', 'mumbled'], yelled: ['shouted', 'screamed', 'hollered'], hurried: ['rushed', 'hastened', 'dashed'],
  noticed: ['saw', 'spotted', 'observed'], wondered: ['asked herself', 'pondered', 'mused'], realized: ['understood', 'grasped', 'saw'],
  helped: ['assisted', 'aided', 'supported'], needed: ['required', 'wanted'], decided: ['chose', 'resolved', 'determined'], received: ['got', 'obtained', 'was given'],
  explained: ['described', 'clarified', 'set out'], created: ['made', 'built', 'formed', 'produced'], continued: ['went on', 'carried on', 'kept going'],
};

// formal ⇄ casual pairs (word or phrase)
export const FORMAL = [
  ['a lot of', 'a great deal of'], ['lots of', 'many'], ['get rid of', 'eliminate'], ['find out', 'discover'], ['found out', 'discovered'], ['look into', 'investigate'],
  ['set up', 'establish'], ['put off', 'postpone'], ['come up with', 'devise'], ['make sure', 'ensure'], ['made sure', 'ensured'],
  ['ask for', 'request'], ['asked for', 'requested'], ['think about', 'consider'], ['talk about', 'discuss'], ['talked about', 'discussed'], ['give up', 'abandon'],
  ['kids', 'children'], ['buy', 'purchase'], ['bought', 'purchased'], ['helped', 'assisted'], ['enough', 'sufficient'], ['maybe', 'perhaps'],
  ['tried', 'attempted'], ['started', 'commenced'], ['ended', 'concluded'], ['told', 'informed'], ['so', 'therefore'], ['but', 'however'],
  ['about', 'approximately'], ['fixed', 'resolved'], ['answered', 'responded'], ['checked', 'verified'], ['seemed', 'appeared'], ['seems', 'appears'],
  ['ok', 'acceptable'], ['okay', 'acceptable'], ['really', 'genuinely'], ['anyway', 'in any case'], ['right now', 'at present'], ['a bit', 'somewhat'],
];
// some swaps only fit in one position: "So," and "But" at the start of a sentence, "about" before a number
const FORMAL_GUARD = {
  so: (all, at) => /(^|[.!?]\s+)$/.test(all.slice(0, at)),
  but: (all, at) => /(^|[.!?]\s+)$/.test(all.slice(0, at)),
  about: (all, at, m) => /^\s+\d/.test(all.slice(at + m.length)),
};

export const PLAIN = {
  utilise: 'use', utilize: 'use', utilised: 'used', utilized: 'used', facilitate: 'help', endeavour: 'try', endeavor: 'try', numerous: 'many',
  subsequently: 'later', approximately: 'about', demonstrate: 'show', demonstrated: 'showed', sufficient: 'enough', commence: 'begin',
  commenced: 'began', terminate: 'end', terminated: 'ended', obtain: 'get', obtained: 'got', purchase: 'buy', purchased: 'bought', ascertain: 'find out',
  'in excess of': 'more than', 'a great deal of': 'much', nevertheless: 'still', notwithstanding: 'despite', therefore: 'so', consequently: 'so',
  additional: 'extra', assistance: 'help', assist: 'help', assisted: 'helped', indicate: 'show', indicated: 'showed', require: 'need', required: 'needed',
  inform: 'tell', informed: 'told', modify: 'change', modified: 'changed', possess: 'have', possessed: 'had', reside: 'live', resided: 'lived',
  individual: 'person', individuals: 'people', regarding: 'about', however: 'but', perhaps: 'maybe', commencement: 'start', 'prior to': 'before',
};

const ALL_SYN = { ...THESAURUS, ...MORE_SYNONYMS };
// Words with one clear sense in most sentences. Verbs like "made" or "got", and adjectives like "cold" (weather, manner)
// or "old" (people, things), change meaning with context, so they are never swapped automatically.
const SAFE = new Set([
  ...Object.keys(MORE_SYNONYMS).filter((w) => !['mean', 'kind', 'fine', 'true', 'real', 'dead', 'sweet', 'warm', 'wild', 'main', 'odd', 'proud', 'ready', 'also', 'however', 'certain', 'simple', 'common', 'complete', 'rough', 'sharp', 'deep', 'empty', 'thin'].includes(w)),
  'big', 'small', 'happy', 'sad', 'angry', 'afraid', 'scared', 'beautiful', 'ugly', 'fast', 'quick', 'slow', 'important', 'interesting', 'strange',
  'quiet', 'loud', 'tired', 'easy', 'smart', 'stupid', 'shouted', 'whispered', 'walked', 'smiled', 'laughed', 'cried', 'grabbed', 'pulled', 'pushed',
  'suddenly', 'often', 'nervous', 'shocked', 'surprised', 'calm', 'dirty', 'wet', 'rich', 'poor', 'strong', 'weak', 'large', 'silence',
]);

/** A seeded pseudo-random number in [0,1), so "Try again" gives a different but repeatable result. */
const rand = (seed, n) => { const x = Math.sin(seed * 9301 + n * 49297) * 233280; return x - Math.floor(x); };

/** Swap up to `max` words for synonyms. Proper nouns at the start of a sentence are left. */
export function swapSynonyms(text, { max = 2, seed = 0, protect = [] } = {}) {
  let n = 0, i = 0;
  const keep = new Set(protect.map((w) => w.toLowerCase()));
  return text.replace(/\b([A-Za-z]+)\b/g, (w, _x, at) => {
    i++;
    const k = w.toLowerCase();
    if (n >= max || !SAFE.has(k) || keep.has(k)) return w;
    const list = ALL_SYN[k];
    if (!list) return w;
    if (w[0] !== k[0] && at > 0) return w; // capitalised mid-sentence: probably a name
    if (rand(seed, i) < 0.35) return w; // don't change every candidate
    n++;
    const s = list[Math.floor(rand(seed + 7, i) * list.length)];
    return w[0] === w[0].toUpperCase() ? cap(s) : s;
  });
}

function swapPairs(text, pairs, guard = {}) {
  let out = text;
  for (const [from, to] of pairs) {
    const g = guard[from];
    out = out.replace(new RegExp(`\\b${esc(from)}\\b`, 'gi'), (m, at, all) => {
      if (g && !g(all, at, m)) return m;
      return m[0] === m[0].toUpperCase() ? cap(to) : to;
    });
  }
  return out;
}

function replaceDict(text, dict) {
  return swapPairs(text, Object.entries(dict));
}

/** Apply the first suggestion of every grammar error and punctuation problem in a passage. Works in every language. */
export function fixGrammar(text, lang = 'en') {
  let out = text;
  for (let pass = 0; pass < 3; pass++) {
    const issues = [
      ...(isEn(lang) ? checkText(out, { grammar: true, style: false }).filter((i) => i.kind === 'grammar' && i.replacements?.length && i.rule !== 'quotes') : []),
      ...checkPunctuation(out, lang).filter((i) => i.replacements?.length && i.kind === 'grammar'),
    ].sort((a, b) => b.start - a.start);
    if (!issues.length) break;
    let last = Infinity;
    for (const i of issues) {
      if (i.end > last) continue; // overlapping: next pass
      out = out.slice(0, i.start) + i.replacements[0] + out.slice(i.end);
      last = i.start;
    }
  }
  return out;
}

export const MODES = [
  { id: 'standard', label: 'Standard', hint: 'Fresh wording, same meaning' },
  { id: 'fluency', label: 'Fluency', hint: 'Fix errors, smooth the flow' },
  { id: 'formal', label: 'Formal', hint: 'Polished and professional' },
  { id: 'casual', label: 'Casual', hint: 'Relaxed and conversational' },
  { id: 'simple', label: 'Simple', hint: 'Plain words, shorter sentences' },
  { id: 'creative', label: 'Creative', hint: 'Bolder words and sentence shapes' },
  { id: 'shorten', label: 'Shorten', hint: 'Cut wordiness' },
];

function sentenceShape(s, seed) {
  const tries = [reorder, frontPhrase, frontSimile, toActive];
  const start = Math.floor(rand(seed, 3) * tries.length);
  for (let k = 0; k < tries.length; k++) {
    const r = tries[(start + k) % tries.length](s);
    if (r && r !== s) return r;
  }
  return s;
}

/**
 * Paraphrase a passage. strength 1–3 = how many words may change per sentence.
 * @returns { text, changed } — changed is false when nothing could be reworded.
 */
export function paraphrase(text, { mode = 'standard', strength = 2, seed = 0, lang = 'en', protect = [] } = {}) {
  const src = String(text || '');
  if (!src.trim()) return { text: src, changed: false };
  if (!isEn(lang)) {
    const out = mode === 'shorten' ? summarize(src, { ratio: 0.6, lang }) : fixGrammar(src, lang);
    return { text: out, changed: out !== src };
  }
  const paras = src.split(/\n/);
  const out = paras.map((para, pi) => {
    if (!para.trim()) return para;
    const sents = splitSentences(para, 'en');
    return sents.map((s, si) => {
      const sd = seed * 131 + pi * 17 + si;
      let t = mode === 'casual' || mode === 'formal' || mode === 'fluency' ? s.text : fixGrammar(s.text);
      switch (mode) {
        case 'fluency': t = simplify(fixGrammar(t)); break;
        case 'formal': t = swapPairs(contractions(fixGrammar(t), 'formal'), FORMAL, FORMAL_GUARD); t = replaceDict(t, REDUNDANT); break;
        case 'casual': t = contractions(replaceDict(fixGrammar(t), PLAIN), 'casual'); break;
        case 'simple': t = replaceDict(simplify(t), PLAIN); t = split(t) || t; break;
        case 'shorten': t = concise(simplify(replaceDict(t, { ...WORDY, ...REDUNDANT }))); t = t.replace(/\b(very|really|quite|rather|somewhat|just|actually|basically|totally|literally)\s+/gi, ''); break;
        case 'creative': t = replaceDict(t, { ...WORDY, ...REDUNDANT, ...INTENSIFIED }); t = sentenceShape(t, sd); t = swapSynonyms(t, { max: strength + 1, seed: sd, protect }); break;
        default: t = replaceDict(t, { ...WORDY, ...REDUNDANT }); if (rand(sd, 5) < 0.4) t = sentenceShape(t, sd); t = swapSynonyms(t, { max: strength, seed: sd, protect });
      }
      if (mode === 'standard' && t === s.text) t = swapSynonyms(t, { max: strength + 1, seed: sd + 11, protect });
      return tidy(t);
    }).join(' ');
  }).join('\n');
  return { text: out, changed: out !== src };
}

/**
 * Extractive summary for any language: keeps the sentences that best represent the passage, in their original order.
 * ratio: share of sentences to keep (0.1–0.9).
 */
export function summarize(text, { ratio = 0.35, lang = 'en', max = 0 } = {}) {
  const sents = splitSentences(String(text || '').replace(/\n+/g, ' '), lang);
  if (sents.length <= 2) return sents.map((s) => s.text).join(' ');
  const tokens = (s) => (s.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || []).filter((w) => w.length > 2 || /[^\p{Script=Latin}]/u.test(w));
  const freq = new Map();
  const all = sents.map((s) => tokens(s.text));
  for (const ws of all) for (const w of new Set(ws)) freq.set(w, (freq.get(w) || 0) + 1);
  // words in nearly every sentence (the, and …) carry no signal
  const stop = (w) => freq.get(w) > Math.max(3, sents.length * 0.6);
  const score = all.map((ws, i) => {
    const content = ws.filter((w) => !stop(w));
    if (!content.length) return 0;
    const s = content.reduce((n, w) => n + Math.log(1 + freq.get(w)), 0) / Math.sqrt(content.length);
    return s * (i === 0 ? 1.25 : 1) * (content.length < 4 ? 0.6 : 1);
  });
  const keep = Math.max(1, max || Math.round(sents.length * Math.min(0.9, Math.max(0.1, ratio))));
  const chosen = score.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).slice(0, keep).map(([, i]) => i).sort((a, b) => a - b);
  return chosen.map((i) => sents[i].text).join(' ');
}

/** Synonyms for one word, for the "click a word" list. */
export function alternativesFor(word) {
  const k = String(word).toLowerCase();
  const list = ALL_SYN[k] || ALL_SYN[k.replace(/s$/, '')] || [];
  const isCap = word[0] && word[0] === word[0].toUpperCase();
  return [...new Set(list)].map((s) => (isCap ? cap(s) : s));
}

/** Third-party writing tools the writer can hand a passage to. Booky copies the text and opens the tool in the browser. */
export const OTHER_APPS = [
  { id: 'quillbot', name: 'QuillBot Paraphraser', url: 'https://quillbot.com/paraphrasing-tool' },
  { id: 'quillbot-grammar', name: 'QuillBot Grammar Checker', url: 'https://quillbot.com/grammar-check' },
  { id: 'quillbot-summary', name: 'QuillBot Summarizer', url: 'https://quillbot.com/summarize' },
  { id: 'grammarly', name: 'Grammarly', url: 'https://app.grammarly.com/' },
  { id: 'languagetool', name: 'LanguageTool (many languages)', url: 'https://languagetool.org/' },
  { id: 'deepl', name: 'DeepL Write', url: 'https://www.deepl.com/write' },
];
