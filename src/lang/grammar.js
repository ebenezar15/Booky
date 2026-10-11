// Offline grammar, punctuation and style checker. Pure functions (no DOM), so
// it can run anywhere. Each issue: { start, end, kind, rule, title, message, replacements }
//   kind: 'grammar' (likely error) | 'style' (suggestion) | 'clarity' (readability)

const issue = (start, end, kind, rule, title, message, replacements = []) => ({ start, end, kind, rule, title, message, replacements });

const matchCase = (src, rep) => {
  if (!rep) return rep;
  if (src[0] && src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()) return rep[0].toUpperCase() + rep.slice(1);
  return rep;
};

// ---------------- data ----------------
export const WORDY = {
  'in order to': 'to', 'due to the fact that': 'because', 'owing to the fact that': 'because', 'in spite of the fact that': 'although',
  'despite the fact that': 'although', 'at this point in time': 'now', 'at the present time': 'now', 'in the event that': 'if',
  'for the purpose of': 'for', 'in the near future': 'soon', 'a large number of': 'many', 'a majority of': 'most',
  'has the ability to': 'can', 'have the ability to': 'can', 'is able to': 'can', 'are able to': 'can', 'in close proximity to': 'near',
  'with regard to': 'about', 'with respect to': 'about', 'in regard to': 'about', 'in relation to': 'about', 'on a daily basis': 'daily',
  'on a regular basis': 'regularly', 'at all times': 'always', 'in the process of': '', 'make a decision': 'decide', 'made a decision': 'decided',
  'came to the conclusion': 'concluded', 'come to the conclusion': 'conclude', 'give consideration to': 'consider', 'take into consideration': 'consider',
  'it is important to note that': '', 'it should be noted that': '', 'needless to say': '', 'the reason why is that': 'because',
  'the reason is because': 'because', 'each and every': 'every', 'first and foremost': 'first', 'until such time as': 'until',
  'prior to': 'before', 'subsequent to': 'after', 'in addition to': 'besides', 'as a means of': 'to', 'a number of': 'several',
  'all of the': 'all the', 'whether or not': 'whether', 'during the course of': 'during', 'for the most part': 'mostly',
  'in light of the fact that': 'because', 'is indicative of': 'indicates', 'in an effort to': 'to', 'has a tendency to': 'tends to',
  'at that point in time': 'then', 'started to': 'began to', 'began to run': 'ran', 'very unique': 'unique', 'in terms of': 'in',
};

export const REDUNDANT = {
  'absolutely essential': 'essential', 'advance planning': 'planning', 'added bonus': 'bonus', 'basic fundamentals': 'fundamentals',
  'close proximity': 'proximity', 'completely finished': 'finished', 'end result': 'result', 'final outcome': 'outcome',
  'free gift': 'gift', 'future plans': 'plans', 'past history': 'history', 'past experience': 'experience', 'unexpected surprise': 'surprise',
  'true fact': 'fact', 'revert back': 'revert', 'return back': 'return', 'repeat again': 'repeat', 'join together': 'join',
  'merge together': 'merge', 'collaborate together': 'collaborate', 'each individual': 'each', 'unintended mistake': 'mistake',
  'nodded his head': 'nodded', 'nodded her head': 'nodded', 'nodded their head': 'nodded', 'shrugged his shoulders': 'shrugged',
  'shrugged her shoulders': 'shrugged', 'shrugged their shoulders': 'shrugged', 'blinked her eyes': 'blinked', 'blinked his eyes': 'blinked',
  'stood up': 'stood', 'sat down': 'sat', 'whispered quietly': 'whispered', 'shouted loudly': 'shouted', 'circled around': 'circled',
  'reason why': 'reason', 'still remains': 'remains', 'new innovation': 'innovation', 'armed gunman': 'gunman', 'ATM machine': 'ATM',
  'PIN number': 'PIN', 'sudden impulse': 'impulse', 'over exaggerate': 'exaggerate', 'empty space': 'space',
};

export const INTENSIFIED = {
  'very big': 'huge', 'very small': 'tiny', 'very tired': 'exhausted', 'very happy': 'elated', 'very sad': 'miserable',
  'very angry': 'furious', 'very scared': 'terrified', 'very afraid': 'terrified', 'very cold': 'freezing', 'very hot': 'scorching',
  'very good': 'excellent', 'very bad': 'awful', 'very old': 'ancient', 'very fast': 'rapid', 'very quick': 'swift', 'very slow': 'sluggish',
  'very quiet': 'hushed', 'very loud': 'deafening', 'very pretty': 'beautiful', 'very beautiful': 'stunning', 'very ugly': 'hideous',
  'very smart': 'brilliant', 'very hungry': 'starving', 'very important': 'crucial', 'very difficult': 'arduous', 'very easy': 'effortless',
  'very dark': 'pitch-black', 'very bright': 'dazzling', 'very clean': 'spotless', 'very dirty': 'filthy', 'very rich': 'wealthy',
  'very poor': 'destitute', 'very tall': 'towering', 'very short': 'brief', 'very sure': 'certain', 'very serious': 'grave',
  'very wet': 'soaked', 'very dry': 'parched', 'very strong': 'powerful', 'very weak': 'feeble', 'very boring': 'tedious',
  'very funny': 'hilarious', 'very nervous': 'anxious', 'very worried': 'distraught', 'very surprised': 'astonished',
  'very much': 'greatly', 'very often': 'frequently', 'really big': 'enormous', 'really good': 'superb', 'really bad': 'terrible',
  'really tired': 'exhausted', 'really scared': 'petrified', 'really happy': 'overjoyed', 'really angry': 'livid', 'really fast': 'swift',
  'ran quickly': 'sprinted', 'walked slowly': 'shuffled', 'said quietly': 'murmured', 'said loudly': 'shouted', 'looked quickly': 'glanced',
  'ate quickly': 'devoured', 'closed loudly': 'slammed', 'cried loudly': 'wailed', 'held tightly': 'clutched', 'walked quietly': 'crept',
};

export const CLICHES = [
  'at the end of the day', 'avoid it like the plague', 'better late than never', 'bite the bullet', 'calm before the storm',
  'cold as ice', 'dead as a doornail', 'every cloud has a silver lining', 'fit as a fiddle', 'heart of gold', 'in the nick of time',
  'last but not least', 'light at the end of the tunnel', 'only time will tell', 'quiet as a mouse', 'scared to death', 'sick as a dog',
  'time heals all wounds', 'think outside the box', 'tip of the iceberg', 'white as a sheet', 'all walks of life', 'at a loss for words',
  'blood ran cold', 'breath she didn\'t know she was holding', 'breath he didn\'t know he was holding', 'butterflies in her stomach',
  'butterflies in his stomach', 'crystal clear', 'dark and stormy night', 'easier said than done', 'fall on deaf ears', 'few and far between',
  'flat as a pancake', 'heart skipped a beat', 'hit the ground running', 'it goes without saying', 'little did he know', 'little did she know',
  'needle in a haystack', 'plenty of fish in the sea', 'raining cats and dogs', 'read between the lines', 'stood the test of time',
  'the rest is history', 'tears streamed down', 'time stood still', 'under the weather', 'without a shadow of a doubt', 'when all is said and done',
  'a chill ran down', 'shiver down her spine', 'shiver down his spine', 'let out a breath', 'all hell broke loose', 'ignorance is bliss',
];

const FILTER_WORDS = ['felt', 'feel', 'feels', 'saw', 'see', 'sees', 'heard', 'hear', 'hears', 'noticed', 'notice', 'realized', 'realised', 'wondered', 'watched', 'seemed', 'decided', 'thought', 'knew'];
const WEAK_ADVERBS = ['very', 'really', 'quite', 'rather', 'somewhat', 'just', 'actually', 'basically', 'totally', 'literally', 'definitely', 'extremely', 'incredibly', 'truly', 'pretty much', 'kind of', 'sort of'];
const TAG_VERBS = 'said|asked|replied|whispered|shouted|muttered|answered|called|cried|yelled|snapped|murmured';

const IRREGULAR_PP = 'been|born|beaten|become|begun|bent|bitten|blown|broken|brought|built|bought|caught|chosen|come|cut|dealt|done|drawn|driven|eaten|fallen|fed|felt|fought|found|flown|forbidden|forgotten|forgiven|frozen|given|gone|grown|hung|hidden|held|hit|hurt|kept|known|laid|led|left|lent|lost|made|meant|met|paid|put|quit|read|ridden|rung|risen|run|said|seen|sought|sold|sent|set|shaken|shot|shown|shut|sung|sunk|sat|slept|slid|spoken|spent|spun|stood|stolen|stuck|stung|struck|sworn|swept|swum|taken|taught|torn|told|thought|thrown|understood|woken|worn|woven|won|written';

const CONFUSED = [
  [/\b(could|would|should|must|might) of\b/gi, (m) => [m.replace(/ of$/i, ' have')], 'grammar', 'Modal + “of”', 'After could/would/should, use “have”, not “of”.'],
  [/\balot\b/gi, () => ['a lot'], 'grammar', 'Spelling', '“Alot” is not a word; write “a lot”.'],
  [/\birregardless\b/gi, () => ['regardless'], 'grammar', 'Nonstandard word', 'Use “regardless”.'],
  [/\b(your|you're) welcome\b/gi, (m) => [matchCase(m, "you're welcome")], 'grammar', 'Your / you’re', 'Use “you’re” (you are) here.'],
  [/\byour (a|an|the|going|not|so|very|too|being|doing|right|wrong|welcome)\b/gi, (m) => [m.replace(/your/i, (x) => matchCase(x, "you're"))], 'grammar', 'Your / you’re', 'Did you mean “you’re” (you are)?'],
  [/\bits (a|an|the|been|going|not|so|very|too|getting|always|never|time|true|ok|okay|late|over)\b/gi, (m) => [m.replace(/its/i, (x) => matchCase(x, "it's"))], 'grammar', 'Its / it’s', 'Did you mean “it’s” (it is / it has)?'],
  [/\bit's (own|self)\b/gi, (m) => [m.replace(/it's/i, (x) => matchCase(x, 'its'))], 'grammar', 'Its / it’s', 'Possessive “its” has no apostrophe.'],
  [/\b(their|there) (is|are|was|were)\b/gi, (m) => /^their/i.test(m) ? [m.replace(/their/i, (x) => matchCase(x, 'there'))] : null, 'grammar', 'Their / there', 'Use “there” for existence (there is / there are).'],
  [/\bthey're (car|house|home|own|way|friends|parents|room|mother|father|children|eyes|hands)\b/gi, (m) => [m.replace(/they're/i, (x) => matchCase(x, 'their'))], 'grammar', 'They’re / their', 'Use possessive “their”.'],
  [/\b(more|less|better|worse|bigger|smaller|faster|slower|older|younger|rather|other|taller|shorter|stronger|longer|harder|easier) then\b/gi, (m) => [m.replace(/then$/i, 'than')], 'grammar', 'Then / than', 'Use “than” for comparisons.'],
  [/\bless (people|things|items|books|cars|days|words|times|chances|friends|mistakes)\b/gi, (m) => [m.replace(/less/i, (x) => matchCase(x, 'fewer'))], 'grammar', 'Less / fewer', 'Use “fewer” with countable nouns.'],
  [/\b(he|she|it) don't\b/gi, (m) => [m.replace(/don't/i, "doesn't")], 'grammar', 'Subject–verb agreement', 'Use “doesn’t” with he/she/it.'],
  [/\b(they|we|you) was\b/gi, (m) => [m.replace(/was/i, 'were')], 'grammar', 'Subject–verb agreement', 'Use “were” with they/we/you.'],
  [/\b(he|she|it) were\b(?! to)/gi, (m) => [m.replace(/were/i, 'was')], 'grammar', 'Subject–verb agreement', 'Use “was” with he/she/it (unless subjunctive).'],
  [/\bI is\b/g, () => ['I am'], 'grammar', 'Subject–verb agreement', 'Use “I am”.'],
  [/\b(he|she|it) (have)\b/gi, (m) => [m.replace(/have/i, 'has')], 'grammar', 'Subject–verb agreement', 'Use “has” with he/she/it.'],
  [/\b(should|could|would|will|can|must|might) (went|came|ate|saw|took|gave|wrote|ran|did)\b/gi, (m) => {
    const fix = { went: 'go', came: 'come', ate: 'eat', saw: 'see', took: 'take', gave: 'give', wrote: 'write', ran: 'run', did: 'do' };
    return [m.replace(/\w+$/, (v) => fix[v.toLowerCase()])];
  }, 'grammar', 'Verb form', 'Use the base form of the verb after a modal.'],
  [/\b(has|have|had) (went|came|ate|saw|took|gave|wrote|ran|began|drank|swam|sang|rang|spoke|broke|chose|froze|stole|drove|rode|flew|knew|grew|threw|drew)\b/gi, (m) => {
    const pp = { went: 'gone', came: 'come', ate: 'eaten', saw: 'seen', took: 'taken', gave: 'given', wrote: 'written', ran: 'run', began: 'begun', drank: 'drunk', swam: 'swum', sang: 'sung', rang: 'rung', spoke: 'spoken', broke: 'broken', chose: 'chosen', froze: 'frozen', stole: 'stolen', drove: 'driven', rode: 'ridden', flew: 'flown', knew: 'known', grew: 'grown', threw: 'thrown', drew: 'drawn' };
    return [m.replace(/\w+$/, (v) => pp[v.toLowerCase()])];
  }, 'grammar', 'Past participle', 'Use the past participle after has/have/had.'],
  [/\b(between you and I)\b/gi, () => ['between you and me'], 'grammar', 'Pronoun case', 'Use “me” after a preposition.'],
  [/\b(me and him|me and her|me and them) (went|were|are|did|had|have)\b/gi, null, 'grammar', 'Pronoun order', 'Consider “He and I…” style subject pronouns.'],
  [/\bsupposably\b/gi, () => ['supposedly'], 'grammar', 'Word choice', 'Did you mean “supposedly”?'],
  [/\bfor all intensive purposes\b/gi, () => ['for all intents and purposes'], 'grammar', 'Eggcorn', 'The phrase is “for all intents and purposes”.'],
  [/\bcase and point\b/gi, () => ['case in point'], 'grammar', 'Eggcorn', 'The phrase is “case in point”.'],
  [/\bfree reign\b/gi, () => ['free rein'], 'grammar', 'Eggcorn', 'The phrase is “free rein”.'],
  [/\bsneak peak\b/gi, () => ['sneak peek'], 'grammar', 'Eggcorn', 'The phrase is “sneak peek”.'],
  [/\b(peaked|piqued) (my|his|her|their|our|your) (interest|curiosity)\b/gi, (m) => /^peaked/i.test(m) ? [m.replace(/peaked/i, 'piqued')] : null, 'grammar', 'Peaked / piqued', 'Interest is “piqued”.'],
  [/\bwould of\b/gi, () => ['would have'], 'grammar', 'Modal + “of”', 'Use “would have”.'],
  [/\bto (loose)\b/gi, () => ['to lose'], 'grammar', 'Loose / lose', '“Lose” means to misplace or be defeated.'],
  [/\b(affect)s? (on)\b/gi, (m) => [m.replace(/affect/i, 'effect')], 'grammar', 'Affect / effect', 'The noun is usually “effect”.'],
  [/\ban effect on\b/gi, null, 'grammar', '', ''],
  [/\btry and\b/gi, () => ['try to'], 'style', 'Try and', 'Formal writing prefers “try to”.'],
  [/\bcould care less\b/gi, () => ["couldn't care less"], 'grammar', 'Idiom', 'The idiom is “couldn’t care less”.'],
  [/\bon accident\b/gi, () => ['by accident'], 'style', 'Idiom', 'Standard usage is “by accident”.'],
];

const AN_EXCEPTIONS_A = /^(uni|use|usu|uti|uto|eu|ewe|one|once|ubiq|ukr|ura|uro|euro)/i; // "a university", "a one-off"
const AN_EXCEPTIONS_AN = /^(hour|honest|honou?r|heir|herb\b)/i; // "an hour"

// ---------------- helpers ----------------
export function sentences(text) {
  const out = [];
  const re = /[^.!?…]+(?:[.!?…]+["”’')\]]*|$)/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[0];
    if (!raw.trim()) { if (re.lastIndex === m.index) re.lastIndex++; continue; }
    const lead = raw.length - raw.trimStart().length;
    out.push({ start: m.index + lead, end: m.index + raw.trimEnd().length, text: raw.trim() });
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

export function words(text) {
  return text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) || [];
}

export function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const m = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

export function readability(text) {
  const sents = sentences(text).length || 1;
  const ws = words(text);
  const n = ws.length || 1;
  const syl = ws.reduce((s, w) => s + syllables(w), 0);
  const ease = 206.835 - 1.015 * (n / sents) - 84.6 * (syl / n);
  const grade = 0.39 * (n / sents) + 11.8 * (syl / n) - 15.59;
  return { ease: Math.round(Math.max(0, Math.min(100, ease))), grade: Math.max(0, Math.round(grade * 10) / 10), words: ws.length, sentences: sents, avgSentence: Math.round((n / sents) * 10) / 10 };
}

export function easeLabel(ease) {
  if (ease >= 90) return 'Very easy';
  if (ease >= 80) return 'Easy';
  if (ease >= 70) return 'Fairly easy';
  if (ease >= 60) return 'Plain English';
  if (ease >= 50) return 'Fairly difficult';
  if (ease >= 30) return 'Difficult';
  return 'Very difficult';
}

function phraseRules(text, dict, kind, rule, title, msg, out) {
  const lower = text.toLowerCase();
  for (const [phrase, rep] of Object.entries(dict)) {
    let i = 0;
    const p = phrase.toLowerCase();
    while ((i = lower.indexOf(p, i)) !== -1) {
      const before = lower[i - 1], after = lower[i + p.length];
      if ((!before || !/[\p{L}]/u.test(before)) && (!after || !/[\p{L}]/u.test(after))) {
        const src = text.slice(i, i + p.length);
        out.push(issue(i, i + p.length, kind, rule, title, msg(src, rep), rep === '' ? [''] : [matchCase(src, rep)]));
      }
      i += p.length;
    }
  }
}

// ---------------- main ----------------
export function checkText(text, opts = {}) {
  const { grammar = true, style = true, fiction = true } = opts;
  const out = [];
  if (!text || !text.trim()) return out;

  if (grammar) {
    // Repeated words
    for (const m of text.matchAll(/\b([\p{L}']+)\s+\1\b/giu)) {
      if (/^(had|that|very|bye|ha|no|yes|so|really|knock|tut|go|now|well|chop|boo)$/i.test(m[1])) continue;
      out.push(issue(m.index, m.index + m[0].length, 'grammar', 'repeated-word', 'Repeated word', `“${m[1]}” is repeated.`, [m[1]]));
    }
    // a / an
    for (const m of text.matchAll(/\b(a|an)\s+([\p{L}][\p{L}\-']*)/giu)) {
      const art = m[1].toLowerCase(), w = m[2];
      if (/^[A-Z]{2,}$/.test(w)) continue; // acronyms are ambiguous (an FBI agent)
      const vowel = /^[aeiou]/i.test(w);
      let want = vowel ? 'an' : 'a';
      if (vowel && AN_EXCEPTIONS_A.test(w)) want = 'a';
      if (!vowel && AN_EXCEPTIONS_AN.test(w)) want = 'an';
      if (art !== want) {
        out.push(issue(m.index, m.index + m[1].length, 'grammar', 'article', 'A / an', `Use “${want}” before “${w}”.`, [matchCase(m[1], want)]));
      }
    }
    // Lowercase "i"
    for (const m of text.matchAll(/(^|[\s(“"])(i)(?=['’]?(m|d|ll|ve)?\b[\s,.!?;:”"])/g)) {
      const s = m.index + m[1].length;
      out.push(issue(s, s + 1, 'grammar', 'pronoun-i', 'Capitalize “I”', 'The pronoun “I” is always capitalized.', ['I']));
    }
    // Sentence capitalisation
    for (const s of sentences(text)) {
      const first = s.text.match(/^[“"‘'(\[]*([\p{L}])/u);
      if (first && first[1] === first[1].toLowerCase() && first[1] !== first[1].toUpperCase()) {
        const idx = s.start + first[0].length - 1;
        // ignore sentences following an ellipsis or dialogue tags ("Hello," she said.) — only flag after . ! ?
        const prev = text.slice(0, s.start).trimEnd();
        if (!prev || /[.!?]["”’)]?$/.test(prev)) {
          if (!/[!?]["”’]$/.test(prev)) out.push(issue(idx, idx + 1, 'grammar', 'capitalization', 'Capitalization', 'Start the sentence with a capital letter.', [first[1].toUpperCase()]));
        }
      }
    }
    // Punctuation spacing
    for (const m of text.matchAll(/ {2,}/g)) out.push(issue(m.index, m.index + m[0].length, 'grammar', 'double-space', 'Extra spaces', 'Use a single space.', [' ']));
    for (const m of text.matchAll(/\s+([,.;:!?])(?![.\d])/g)) {
      if (m[1] === '.' && /\.\.\./.test(text.slice(m.index, m.index + 5))) continue;
      out.push(issue(m.index, m.index + m[0].length, 'grammar', 'space-before-punct', 'Space before punctuation', 'Remove the space before the punctuation mark.', [m[1]]));
    }
    for (const m of text.matchAll(/([,;:])(?=[\p{L}])/gu)) {
      if (/\d/.test(text[m.index - 1] || '') ) continue;
      out.push(issue(m.index, m.index + 1, 'grammar', 'space-after-punct', 'Missing space', 'Add a space after the punctuation mark.', [m[1] + ' ']));
    }
    for (const m of text.matchAll(/([.!?])(?=[A-Z][a-z])/g)) {
      const before = text.slice(Math.max(0, m.index - 3), m.index);
      if (/\b[A-Z]$|\b(Mr|Ms|Dr|St|Mrs)$/.test(before)) continue;
      out.push(issue(m.index, m.index + 1, 'grammar', 'space-after-punct', 'Missing space', 'Add a space after the sentence.', [m[1] + ' ']));
    }
    for (const m of text.matchAll(/([!?]){2,}|,{2,}|\.{4,}/g)) {
      out.push(issue(m.index, m.index + m[0].length, 'style', 'repeated-punct', 'Repeated punctuation', 'Repeated punctuation can feel overwrought in published prose.', [m[0][0] === '.' ? '…' : m[0][0]]));
    }
    // Confusables
    for (const [re, fix, kind, title, msg] of CONFUSED) {
      if (!title) continue;
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        const reps = fix ? fix(m[0]) : [];
        if (fix && !reps) continue;
        out.push(issue(m.index, m.index + m[0].length, kind, 'confused', title, msg, (reps || []).map((r) => matchCase(m[0], r))));
      }
    }
    // Unbalanced quotes (per paragraph)
    const straight = (text.match(/"/g) || []).length;
    const open = (text.match(/“/g) || []).length, close = (text.match(/”/g) || []).length;
    if (straight % 2 === 1 || (open + close > 0 && open !== close && !/^“[^”]*$/.test(text))) {
      const idx = Math.max(text.lastIndexOf('"'), text.lastIndexOf('“'));
      if (idx >= 0 && !(open > close && text.trim().startsWith('“') && close === 0)) {
        out.push(issue(idx, idx + 1, 'grammar', 'quotes', 'Unbalanced quotation marks', 'This paragraph has an unmatched quotation mark. (Ignore if the speech continues in the next paragraph.)'));
      }
    }
  }

  if (style) {
    phraseRules(text, WORDY, 'style', 'wordy', 'Wordy phrase', (s, r) => (r ? `“${s}” can be simplified to “${r}”.` : `“${s}” can usually be removed.`), out);
    phraseRules(text, REDUNDANT, 'style', 'redundant', 'Redundancy', (s, r) => `“${s}” is redundant — “${r}” says the same.`, out);
    phraseRules(text, INTENSIFIED, 'style', 'intensifier', 'Weak modifier', (s, r) => `Replace “${s}” with a stronger word such as “${r}”.`, out);
    const lower = text.toLowerCase();
    for (const c of CLICHES) {
      let i = 0;
      while ((i = lower.indexOf(c, i)) !== -1) {
        out.push(issue(i, i + c.length, 'style', 'cliche', 'Cliché', 'This phrase is a cliché. Consider a fresher image.'));
        i += c.length;
      }
    }
    // Passive voice
    const passive = new RegExp(`\\b(am|is|are|was|were|be|been|being)\\s+(\\w+ly\\s+)?(\\w+ed|${IRREGULAR_PP})\\b(\\s+by\\b)?`, 'gi');
    for (const m of text.matchAll(passive)) {
      if (/^(tired|bored|excited|interested|worried|scared|married|supposed|used|pleased|located|based|called|named|concerned|surprised|annoyed|amazed|ashamed|prepared|determined|involved|exhausted|relieved|satisfied|confused|embarrassed|frightened|terrified|delighted|disappointed|thrilled|stunned|shocked|convinced|done|gone|seen|read)$/i.test(m[3]) && !m[4]) continue;
      out.push(issue(m.index, m.index + m[0].length, 'style', 'passive', 'Passive voice', 'Passive voice can feel distant. Consider making the subject do the action.' + (m[4] ? ' (e.g. “The dog chased the cat” instead of “The cat was chased by the dog”).' : '')));
    }
    // Weak adverbs / hedges
    for (const w of WEAK_ADVERBS) {
      const re = new RegExp(`\\b${w}\\b`, 'gi');
      for (const m of text.matchAll(re)) {
        if (out.some((o) => o.rule === 'intensifier' && o.start <= m.index && o.end >= m.index + w.length)) continue;
        out.push(issue(m.index, m.index + m[0].length, 'style', 'weak-word', 'Weak word', `“${m[0]}” rarely adds meaning. Try cutting it or choosing a more precise word.`, ['']));
      }
    }
    // Adverbs on dialogue tags
    for (const m of text.matchAll(new RegExp(`\\b(${TAG_VERBS})\\s+(\\w+ly)\\b`, 'gi'))) {
      out.push(issue(m.index, m.index + m[0].length, 'style', 'tag-adverb', 'Adverb on dialogue tag', 'Let the dialogue show the emotion instead of an adverb on the tag.', [m[1]]));
    }
    // Filter words (fiction)
    if (fiction) {
      for (const m of text.matchAll(new RegExp(`\\b(I|he|she|they|we|you)\\s+(${FILTER_WORDS.join('|')})\\b`, 'gi'))) {
        out.push(issue(m.index, m.index + m[0].length, 'style', 'filter', 'Filter word', 'Filter words (felt, saw, heard, realized…) can distance the reader. Consider showing the experience directly.'));
      }
    }
  }

  // Long sentences (clarity)
  if (style) {
    for (const s of sentences(text)) {
      const n = words(s.text).length;
      if (n > 38) out.push(issue(s.start, s.end, 'clarity', 'long-sentence', 'Very long sentence', `This sentence has ${n} words. Consider splitting it for readability.`, []));
    }
  }

  // De-duplicate overlapping issues of the same rule
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  const seen = new Set();
  return out.filter((i) => {
    const k = `${i.start}:${i.end}:${i.rule}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Overused words across a text (excluding stop words).
const STOP = new Set('the a an and or but if then of to in on at by for with from as is was were be been are am it its it\'s that this these those he she they we you i me him her them us my his their our your not no so do did does had have has will would can could should may might must there here what which who whom when where why how all any some one up out about into over than just like also only very said'.split(' '));
export function overusedWords(text, top = 20) {
  const counts = new Map();
  for (const w of words(text.toLowerCase())) {
    if (w.length < 3 || STOP.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
}
