// Languages Booky can write and publish in, with suitable fonts and local book terms.
// script: Unicode script used for font matching and phonetic typing.
// labels: chapter / part / contents words in the language (editable afterwards).
export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', script: 'latin', body: 'EB Garamond', heading: 'EB Garamond', labels: { chapter: 'Chapter', part: 'Part', contents: 'Contents' } },
  { code: 'en-GB', name: 'English (UK)', native: 'English (UK)', script: 'latin', body: 'EB Garamond', heading: 'EB Garamond', labels: { chapter: 'Chapter', part: 'Part', contents: 'Contents' } },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', script: 'tamil', body: 'Noto Serif Tamil', heading: 'Arima', phonetic: true, labels: { chapter: 'அத்தியாயம்', part: 'பாகம்', contents: 'பொருளடக்கம்' } },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', script: 'devanagari', body: 'Noto Serif Devanagari', heading: 'Tiro Devanagari Hindi', phonetic: true, labels: { chapter: 'अध्याय', part: 'भाग', contents: 'विषय-सूची' } },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', script: 'malayalam', body: 'Noto Serif Malayalam', heading: 'Manjari', phonetic: true, labels: { chapter: 'അധ്യായം', part: 'ഭാഗം', contents: 'ഉള്ളടക്കം' } },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', script: 'telugu', body: 'Noto Serif Telugu', heading: 'Tiro Telugu', phonetic: true, labels: { chapter: 'అధ్యాయం', part: 'భాగం', contents: 'విషయ సూచిక' } },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', script: 'kannada', body: 'Noto Serif Kannada', heading: 'Tiro Kannada', phonetic: true, labels: { chapter: 'ಅಧ್ಯಾಯ', part: 'ಭಾಗ', contents: 'ಪರಿವಿಡಿ' } },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', script: 'bengali', body: 'Noto Serif Bengali', heading: 'Tiro Bangla', phonetic: true, labels: { chapter: 'অধ্যায়', part: 'খণ্ড', contents: 'সূচিপত্র' } },
  { code: 'mr', name: 'Marathi', native: 'मराठी', script: 'devanagari', body: 'Noto Serif Devanagari', heading: 'Tiro Devanagari Marathi', phonetic: true, labels: { chapter: 'प्रकरण', part: 'भाग', contents: 'अनुक्रमणिका' } },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', script: 'gujarati', body: 'Noto Serif Gujarati', heading: 'Hind Vadodara', phonetic: true, labels: { chapter: 'પ્રકરણ', part: 'ભાગ', contents: 'અનુક્રમણિકા' } },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', script: 'gurmukhi', body: 'Noto Serif Gurmukhi', heading: 'Mukta Mahee', phonetic: true, labels: { chapter: 'ਅਧਿਆਇ', part: 'ਭਾਗ', contents: 'ਤਤਕਰਾ' } },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', script: 'oriya', body: 'Noto Serif Oriya', heading: 'Baloo Bhaina 2', phonetic: true, labels: { chapter: 'ଅଧ୍ୟାୟ', part: 'ଭାଗ', contents: 'ସୂଚିପତ୍ର' } },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া', script: 'bengali', body: 'Noto Serif Bengali', heading: 'Noto Serif Bengali', phonetic: true, labels: { chapter: 'অধ্যায়', part: 'খণ্ড', contents: 'সূচীপত্ৰ' } },
  { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्', script: 'devanagari', body: 'Tiro Devanagari Sanskrit', heading: 'Tiro Devanagari Sanskrit', phonetic: true, labels: { chapter: 'अध्यायः', part: 'भागः', contents: 'विषयसूची' } },
  { code: 'ne', name: 'Nepali', native: 'नेपाली', script: 'devanagari', body: 'Noto Serif Devanagari', heading: 'Noto Serif Devanagari', phonetic: true, labels: { chapter: 'अध्याय', part: 'भाग', contents: 'विषयसूची' } },
  { code: 'ur', name: 'Urdu', native: 'اردو', script: 'arabic', dir: 'rtl', body: 'Noto Nastaliq Urdu', heading: 'Gulzar', labels: { chapter: 'باب', part: 'حصہ', contents: 'فہرست' } },
  { code: 'si', name: 'Sinhala', native: 'සිංහල', script: 'sinhala', body: 'Noto Sans Sinhala', heading: 'Noto Sans Sinhala', labels: { chapter: 'පරිච්ඡේදය', part: 'කොටස', contents: 'පටුන' } },
  { code: 'ar', name: 'Arabic', native: 'العربية', script: 'arabic', dir: 'rtl', body: 'Noto Naskh Arabic', heading: 'Noto Naskh Arabic', labels: { chapter: 'الفصل', part: 'الجزء', contents: 'المحتويات' } },
  { code: 'es', name: 'Spanish', native: 'Español', script: 'latin', body: 'EB Garamond', heading: 'EB Garamond', labels: { chapter: 'Capítulo', part: 'Parte', contents: 'Índice' } },
  { code: 'fr', name: 'French', native: 'Français', script: 'latin', body: 'EB Garamond', heading: 'EB Garamond', labels: { chapter: 'Chapitre', part: 'Partie', contents: 'Table des matières' } },
  { code: 'de', name: 'German', native: 'Deutsch', script: 'latin', body: 'EB Garamond', heading: 'EB Garamond', labels: { chapter: 'Kapitel', part: 'Teil', contents: 'Inhalt' } },
  { code: 'it', name: 'Italian', native: 'Italiano', script: 'latin', body: 'EB Garamond', heading: 'EB Garamond', labels: { chapter: 'Capitolo', part: 'Parte', contents: 'Indice' } },
  { code: 'pt', name: 'Portuguese', native: 'Português', script: 'latin', body: 'EB Garamond', heading: 'EB Garamond', labels: { chapter: 'Capítulo', part: 'Parte', contents: 'Índice' } },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', script: 'latin', body: 'EB Garamond', heading: 'EB Garamond', labels: { chapter: 'Hoofdstuk', part: 'Deel', contents: 'Inhoud' } },
  { code: 'sv', name: 'Swedish', native: 'Svenska', script: 'latin', body: 'EB Garamond', heading: 'EB Garamond', labels: { chapter: 'Kapitel', part: 'Del', contents: 'Innehåll' } },
  { code: 'pl', name: 'Polish', native: 'Polski', script: 'latin', body: 'EB Garamond', heading: 'EB Garamond', labels: { chapter: 'Rozdział', part: 'Część', contents: 'Spis treści' } },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', script: 'latin', body: 'Noto Serif', heading: 'Noto Serif', labels: { chapter: 'Bab', part: 'Bagian', contents: 'Daftar Isi' } },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili', script: 'latin', body: 'Noto Serif', heading: 'Noto Serif', labels: { chapter: 'Sura', part: 'Sehemu', contents: 'Yaliyomo' } },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', script: 'latin', body: 'Noto Serif', heading: 'Noto Serif', labels: { chapter: 'Bölüm', part: 'Kısım', contents: 'İçindekiler' } },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', script: 'latin', body: 'Noto Serif', heading: 'Noto Serif', labels: { chapter: 'Chương', part: 'Phần', contents: 'Mục lục' } },
];

export const SCRIPT_LABELS = {
  latin: 'English & European', tamil: 'Tamil', devanagari: 'Hindi · Marathi · Sanskrit · Nepali', malayalam: 'Malayalam', telugu: 'Telugu',
  kannada: 'Kannada', bengali: 'Bengali · Assamese', gujarati: 'Gujarati', gurmukhi: 'Punjabi', oriya: 'Odia', arabic: 'Urdu · Arabic', sinhala: 'Sinhala',
};

export const langInfo = (code) => LANGUAGES.find((l) => l.code === code) || LANGUAGES.find((l) => l.code === String(code || 'en').split('-')[0]) || LANGUAGES[0];
export const isEnglish = (code) => /^en\b/i.test(code || 'en');
export const isRtl = (code) => langInfo(code).dir === 'rtl';

/** Switch a book's design to suit its language: fonts, chapter words, direction. */
export function applyLanguageDesign(book, code) {
  const L = langInfo(code);
  const f = book.format;
  f.body.font = L.body;
  f.headings.font = L.heading;
  f.headings.numberFont = '';
  f.firstPara.dropCapFont = '';
  f.headings.subheadFont = '';
  f.header.font = '';
  f.pageNumbers.font = '';
  if (L.script !== 'latin') {
    f.headings.numberPrefix = L.labels.chapter;
    if (['word', 'roman'].includes(f.headings.numberStyle)) f.headings.numberStyle = 'numeral';
    f.headings.partPrefix = L.labels.part;
    if (f.headings.partNumberStyle === 'word') f.headings.partNumberStyle = 'numeral';
    f.headings.numberCase = 'none';
    f.headings.titleCase = 'none';
    f.firstPara.leadIn = 'none';
    f.body.hyphenate = false;
    f.body.leading = Math.max(f.body.leading, L.script === 'arabic' ? 2.1 : 1.6);
    f.header.case = 'none';
  } else {
    f.headings.numberPrefix = L.labels.chapter;
    f.headings.partPrefix = L.labels.part;
  }
  const toc = book.elements.find((e) => e.type === 'toc');
  if (toc && /^(contents|table of contents)$/i.test(toc.title || 'Contents')) toc.title = L.labels.contents;
  book.meta.language = L.code;
}
