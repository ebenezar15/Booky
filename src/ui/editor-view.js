// The writing surface: TipTap editor, formatting toolbar, live proofing.
import { Editor } from '@tiptap/core';
import { Placeholder, Focus, CharacterCount } from '@tiptap/extensions';
import Typography from '@tiptap/extension-typography';
import { h, icon, iconBtn, clear, menu, popover, promptDialog, closeMenu, pickFile, compressImage, toast, select, debounce, btn, modal, toggle, slider, field, add } from './dom.js';
import { state, on, emit, touch, currentElement, selectElement, setApp, sessionWords } from '../core/store.js';
import { ELEMENT_TYPES, computeNumbers, chapterLabel, countWords, orderedElements } from '../core/model.js';
import { SCENE_BREAKS } from '../core/themes.js';
import { allFonts, fontStack, fontOptions } from '../core/fonts.js';
import { charStylesCss, paraStylesCss } from '../core/formatting.js';
import { baseExtensions } from '../editor/schema.js';
import { PARAGRAPH_STYLES, Typewriter, PhoneticTyping, ReadAloudHighlight, BlockBadges, TrackChanges, changeAt } from '../editor/extensions.js';
import { openChangesPanel, trackAuthor } from './track-ui.js';
import { splitChapterHere, mergeWithNext, nextInSection, moveSelectionTo, addAuthorNote, openMarkersPanel, readAloud, stopReading, specialCharPicker, sidePane, rememberPlace } from './writing-tools.js';
import { transliterateWord, PHONETIC_SCRIPTS, PHONETIC_HELP } from '../lang/translit.js';
import { Proofing, issuesAt, proofKey, sentenceAround, dismissed } from '../editor/proofing.js';
import { FindHighlight, findMatches, setFindState } from '../editor/find.js';
import { Annotations } from '../editor/annotations.js';
import { isEnglish, isRtl, langInfo } from '../core/languages.js';
import { ensureReviews, COMMENT_TYPES } from '../core/feedback.js';
import { reviewerById, setStatus, applySuggestion, goNext } from './feedback-actions.js';
import { suggest, addToDictionary, ignoreWord, initSpell, applyBookSpelling } from '../lang/spell.js';
import { synonymsFor } from '../lang/thesaurus.js';
import { openAssistant } from './assistant-ui.js';
import { renderSections } from '../render/book.js';
import { toggleBinder, toggleInspector } from './workspace.js';
import { originalPane } from './translate.js';
import { suggestForSelection } from './translate-suggest.js';
import { addToIndexDialog, crossRefDialog, openIndexPanel } from './index-panel.js';
import { cleanPastedHtml } from '../editor/paste.js';
import { cleanText } from '../core/typography.js';
import { textToHtml } from '../import/text.js';
import { startVoice, pickEngine, localesFor, shapeTranscript } from '../lang/voice.js';

let editor = null;
export const getEditor = () => editor;

const SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt', '28pt', '32pt', '40pt', '48pt'];
const COLORS = ['#000000', '#444444', '#888888', '#b91c1c', '#c2410c', '#a16207', '#15803d', '#0e7490', '#1d4ed8', '#6d28d9', '#be185d', '#ffffff'];
const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff'];

function proofSettings() {
  if (!isEnglish(state.book?.meta.language)) {
    // other languages: spelling only, and only with a dictionary the author imported (Settings → Proofing)
    const lang = String(state.book?.meta.language || '').split('-')[0];
    return { spell: state.app.spellcheck !== false && state.spellLang === lang, grammar: false, style: false, fiction: false, punct: state.app.punctuation !== false, punctStyle: state.app.styleHints !== false, lang: state.book?.meta.language };
  }
  return { spell: state.app.spellcheck !== false, grammar: state.app.grammar !== false, style: state.app.styleHints !== false, fiction: state.app.fictionHints !== false, punct: state.app.punctuation !== false, punctStyle: state.app.styleHints !== false, lang: 'en' };
}

export function renderEditor(host) {
  const book = state.book;
  const center = h('section.center');
  host.appendChild(center);
  const toolbar = h('div.toolbar', { role: 'toolbar', 'aria-label': 'Formatting' });
  const scroller = h('div.editor-scroll');
  const page = h('div.editor-page');
  const status = h('div.editor-status');
  scroller.appendChild(page);
  add(center, toolbar, scroller, status);
  let focusMode = false;
  let findBar = null;

  const applyView = () => {
    const s = book.settings;
    page.style.maxWidth = `${s.pageWidth || 760}px`;
    const L = langInfo(book.meta.language);
    page.style.setProperty('--writing-font', `"${s.writingFont || 'Lora'}"${L.script !== 'latin' ? `, "${book.format.body.font}", "${L.body}"` : ''}`);
    page.style.setProperty('--writing-size', `${s.writingSize || 18}px`);
    const sb = book.format.sceneBreak;
    const sym = sb.style === 'custom' ? sb.custom : SCENE_BREAKS[sb.style] ?? '* * *';
    page.style.setProperty('--scene-symbol', `"${(sym || '— — —').replace(/"/g, '\\"')}"`);
    center.classList.toggle('hide-style', state.app.styleHints === false);
    // the book's character and paragraph styles, so the editor shows them as they will print
    let st = center.querySelector('style.book-styles');
    if (!st) { st = h('style.book-styles'); center.prepend(st); }
    const fs = (n) => fontStack(n);
    st.textContent = `${charStylesCss(book.format.charStyles || [], fs).replace(/\.cs-/g, '.book-prose .cs-')}\n${paraStylesCss(book.format.paraStyles || {}, book.format.customParaStyles || [], fs, (id) => `.book-prose .ps-${id}`)}`;
    fillStyleMenus?.();
  };
  let fillStyleMenus = null;
  applyView();

  // ---------- phonetic typing (Indian languages) ----------
  const canPhonetic = () => PHONETIC_SCRIPTS.includes(langInfo(book.meta.language).script);
  const phoneticOn = () => canPhonetic() && book.settings.phonetic !== false;
  const phoneticBtn = h('button.icon-btn.phonetic-btn', { type: 'button' });
  function drawPhoneticBtn() {
    const L = langInfo(book.meta.language);
    phoneticBtn.classList.toggle('hidden', !canPhonetic());
    phoneticBtn.classList.toggle('active', phoneticOn());
    phoneticBtn.textContent = { tamil: 'அ', devanagari: 'अ', malayalam: 'അ', telugu: 'అ', kannada: 'ಅ', bengali: 'অ', gujarati: 'અ', gurmukhi: 'ਅ', oriya: 'ଅ' }[L.script] || 'अ';
    phoneticBtn.title = `Phonetic ${L.name} typing ${phoneticOn() ? 'ON' : 'OFF'} — type in English letters, e.g. “vaNakkam” (Ctrl Shift Space). Right-click for the key guide.`;
  }
  function togglePhonetic() {
    book.settings.phonetic = !phoneticOn();
    touch('settings');
    drawPhoneticBtn();
    toast(book.settings.phonetic ? `Phonetic ${langInfo(book.meta.language).name} typing on — type in English letters` : 'Phonetic typing off — use your keyboard’s own layout', 'info', 2200);
  }
  phoneticBtn.addEventListener('click', togglePhonetic);
  phoneticBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    menu(phoneticBtn, [{ header: `Phonetic ${langInfo(book.meta.language).name} typing` }, ...PHONETIC_HELP.map(([k, d]) => ({ custom: h('div.ph-help', h('code', k), h('span.muted.small', d)) })),
      { custom: h('div.ph-help', h('span.small', 'A word converts when you press space, Enter or punctuation. Ctrl Z restores the English letters.')) }]);
  });
  drawPhoneticBtn();

  // ---------- voice typing ----------
  let voice = null;
  const micBtn = h('button.icon-btn.mic-btn', { type: 'button', 'aria-label': 'Voice typing' }, icon('mic', 18));
  const voiceText = h('span.vp-text');
  const voiceLevel = h('span.vp-level', h('i'), h('i'), h('i'), h('i'), h('i'));
  const voicePill = h('div.voice-pill', { 'aria-live': 'polite' }, h('span.vp-dot'), voiceLevel, voiceText,
    h('button.vp-stop', { type: 'button', title: 'Stop (Ctrl Alt V)', on: { click: () => toggleVoice() } }, icon('square', 12), ' Stop'));
  center.appendChild(voicePill);
  const voiceLocale = () => {
    const list = localesFor(book.meta.language);
    return list.some(([l]) => l === book.settings.voiceLocale) ? book.settings.voiceLocale : list[0][0];
  };
  const localeLabel = () => localesFor(book.meta.language).find(([l]) => l === voiceLocale())?.[1] || voiceLocale();
  const drawMic = () => {
    micBtn.classList.toggle('active', !!voice);
    micBtn.title = voice ? 'Stop voice typing (Ctrl Alt V)' : `Voice typing — ${localeLabel()} (Ctrl Alt V). Right-click for language.`;
    voicePill.classList.toggle('show', !!voice);
  };
  function insertSpoken(raw) {
    if (!editor || editor.isDestroyed) return;
    const { $from } = editor.state.selection;
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
    const text = shapeTranscript(raw, before, { english: isEnglish(book.meta.language) });
    if (!text) return;
    let chain = editor.chain().focus();
    text.split('\n\n').forEach((para, i) => {
      if (i) chain = chain.splitBlock();
      para.split('\n').forEach((line, j) => {
        if (j) chain = chain.setHardBreak();
        if (line) chain = chain.command(({ tr }) => { tr.insertText(line); return true; });
      });
    });
    chain.run();
  }
  function voiceHelp() {
    const desktop = !!globalThis.bookyDesktop;
    const m = modal({
      title: 'Voice typing', width: 500,
      body: h('div.col', { style: { gap: '10px' } },
        h('p', desktop ? 'Booky uses your computer’s own dictation — no account or key needed.' : 'This browser has no speech recognition. Open Booky in Chrome, Edge or Safari — or add a Google Cloud key with the Speech-to-Text API (Settings → Voice & translation).'),
        h('p.muted', 'You can also use your computer’s built-in dictation, which types straight into Booky:'),
        h('ul', h('li', h('b', 'Windows: '), 'press Windows + H'), h('li', h('b', 'Mac: '), 'press Fn (🌐) twice, or Edit → Start Dictation'))),
      footer: [btn('Open settings', { onClick: () => { m.close(); import('./settings.js').then((x) => x.openSettings('translate')); } }), btn('OK', { kind: 'primary', onClick: () => m.close() })],
    });
  }
  function toggleVoice() {
    if (voice) { voice.stop(); voice = null; drawMic(); return; }
    const keys = state.app.translate || {};
    const engine = pickEngine(state.app.voiceEngine, keys);
    if (!engine) { voiceHelp(); return; }
    if (engine === 'system') {
      editor?.commands.focus();
      const mac = globalThis.bookyDesktop.platform === 'darwin';
      // give the editor focus first: dictation types into whatever has focus
      setTimeout(() => startVoice({ engine, locale: voiceLocale(), keys, onError: (msg) => toast(msg, 'error', 7000) }), 60);
      toast(mac ? `Mac Dictation is on — speak now (set its language with the Fn/🌐 key menu). Press Fn or Esc to stop.` : 'Windows voice typing is on — speak now. Press Windows + H again to stop.', 'info', 6000);
      return;
    }
    if (engine === 'google' && globalThis.bookyDesktop?.micAccess) globalThis.bookyDesktop.micAccess();
    try {
      voice = startVoice({
        engine, locale: voiceLocale(), keys,
        onInterim: (t) => { voiceText.textContent = t === '…' ? `Hearing you… (${localeLabel()})` : t || `Listening — ${localeLabel()}`; },
        onFinal: (t) => { insertSpoken(t); voiceText.textContent = `Listening — ${localeLabel()}`; },
        onState: (st) => { voicePill.classList.toggle('busy', st === 'processing'); if (st === 'stopped' && voice) { voice = null; drawMic(); } },
        onLevel: (v) => voiceLevel.style.setProperty('--lv', v.toFixed(2)),
        onError: (msg) => { toast(msg, 'error', 6000); voice?.stop(); voice = null; drawMic(); },
      });
      voiceText.textContent = `Listening — ${localeLabel()}`;
      editor?.commands.focus();
    } catch (e) { toast(e.message, 'error', 6000); voice = null; }
    drawMic();
  }
  micBtn.addEventListener('click', toggleVoice);
  micBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    menu(micBtn, [{ header: 'Speak in' }, ...localesFor(book.meta.language).map(([l, name]) => ({ label: name, checked: l === voiceLocale(), onClick: () => { book.settings.voiceLocale = l; touch('settings'); if (voice) { toggleVoice(); toggleVoice(); } drawMic(); } })),
      { divider: true }, { label: 'Voice settings…', icon: 'settings', onClick: () => import('./settings.js').then((x) => x.openSettings('translate')) },
      { custom: h('div.ph-help', h('span.small.muted', isEnglish(book.meta.language) ? 'Say “comma”, “full stop”, “question mark”, “new paragraph”, “open quote” / “close quote”.' : 'Speak naturally — punctuation is added automatically where the service supports it.')) }]);
  });
  drawMic();

  // ---------- toolbar ----------
  const paraOptions = () => [
    ['p', 'Body text'], ['h1', 'Heading 1'], ['h2', 'Heading 2'], ['h3', 'Heading 3'], ['h4', 'Heading 4'],
    ...PARAGRAPH_STYLES.filter((s) => s.id).map((s) => [`ps:${s.id}`, s.label]),
    ...(book.format.customParaStyles || []).map((c) => [`ps:${c.id}`, `${c.label} ★`]),
  ];
  const styleSel = select(paraOptions(), 'p', (v) => {
    const c = editor.chain().focus();
    if (v === 'p') c.setParagraph().updateAttributes('paragraph', { pstyle: '' }).run();
    else if (v.startsWith('h')) c.toggleHeading({ level: +v[1] }).run();
    else c.setParagraphStyle(v.slice(3)).run();
  }, { class: 'tb-style', title: 'Paragraph style' });
  styleSel.classList.add('tb-style');
  // character styles: named inline styles from Format → Character styles (Alt+Shift+1…9, Alt+Shift+0 clears)
  const charOptions = () => [['', 'Character style'], ...(book.format.charStyles || []).map((c, i) => [c.id, `${c.name}${i < 9 ? `  (Alt⇧${i + 1})` : ''}`]), ['__none', 'Clear character style (Alt⇧0)']];
  const charSel = select(charOptions(), '', (v) => {
    if (!editor) return;
    if (v === '__none' || !v) editor.chain().focus().unsetCharStyle().run(); else editor.chain().focus().setCharStyle(v).run();
    charSel.value = '';
  }, { title: 'Character style (named inline style)' });
  charSel.classList.add('tb-charstyle');
  fillStyleMenus = () => {
    const cur = styleSel.value;
    clear(styleSel); paraOptions().forEach(([v, l]) => styleSel.appendChild(h('option', { value: v }, l))); styleSel.value = cur;
    clear(charSel); charOptions().forEach(([v, l]) => charSel.appendChild(h('option', { value: v }, l))); charSel.value = '';
  };

  const fontSel = select([['', 'Default font'], ...fontOptions(book.meta.language)], '', (v) => {
    v ? editor.chain().focus().setFontFamily(v).run() : editor.chain().focus().unsetFontFamily().run();
  }, { title: 'Font (overrides the book design for selected text)' });
  fontSel.classList.add('tb-font');
  const sizeSel = select([['', 'Size'], ...SIZES], '', (v) => {
    v ? editor.chain().focus().setFontSize(v).run() : editor.chain().focus().unsetFontSize().run();
  }, { title: 'Font size' });
  sizeSel.classList.add('tb-size');

  const tb = {};
  const tbtn = (key, ic, title, fn) => (tb[key] = iconBtn(ic, title, () => fn()));
  const colorBtn = h('button.icon-btn.tb-color', { type: 'button', title: 'Text colour' }, icon('baseline', 18), h('span.bar', { style: { background: '#e07a5f' } }));
  colorBtn.addEventListener('click', () => menu(colorBtn, [{ custom: swatchGrid(COLORS, (c) => editor.chain().focus().setColor(c).run(), () => editor.chain().focus().unsetColor().run()) }]));
  const hlBtn = h('button.icon-btn.tb-color', { type: 'button', title: 'Highlight (for your notes — not printed)' }, icon('highlighter', 18), h('span.bar', { style: { background: '#fef08a' } }));
  hlBtn.addEventListener('click', () => menu(hlBtn, [{ custom: swatchGrid(HIGHLIGHTS, (c) => editor.chain().focus().toggleHighlight({ color: c }).run(), () => editor.chain().focus().unsetHighlight().run()) }]));

  const imgTools = h('span.row.hidden', { style: { gap: '2px' } },
    h('span.sep'),
    select([['25', '25%'], ['33', '33%'], ['50', '50%'], ['66', '66%'], ['75', '75%'], ['100', '100%'], ['page', 'Full page']], '100', (v) => editor.chain().focus().updateAttributes('image', { width: v }).run(), { title: 'Image width' }),
    iconBtn('align-left', 'Image left', () => editor.chain().focus().updateAttributes('image', { align: 'left' }).run()),
    iconBtn('align-center', 'Image centre', () => editor.chain().focus().updateAttributes('image', { align: 'center' }).run()),
    iconBtn('align-right', 'Image right', () => editor.chain().focus().updateAttributes('image', { align: 'right' }).run()),
    iconBtn('pencil', 'Alt text (for accessibility)', async () => {
      const alt = await promptDialog('Image description', 'Alt text (read aloud by screen readers in ebooks)', editor.getAttributes('image').alt || '');
      if (alt != null) editor.chain().focus().updateAttributes('image', { alt }).run();
    }),
  );
  imgTools.querySelector('select').style.width = '72px';

  add(toolbar, 
    iconBtn('panel-left', 'Toggle manuscript panel (Ctrl \\)', () => toggleBinder()),
    h('span.sep'),
    tbtn('undo', 'undo-2', 'Undo (Ctrl Z)', () => editor.chain().focus().undo().run()),
    tbtn('redo', 'redo-2', 'Redo (Ctrl Shift Z)', () => editor.chain().focus().redo().run()),
    h('span.sep'),
    styleSel, charSel, fontSel, sizeSel,
    h('span.sep'),
    tbtn('bold', 'bold', 'Bold (Ctrl B)', () => editor.chain().focus().toggleBold().run()),
    tbtn('italic', 'italic', 'Italic (Ctrl I)', () => editor.chain().focus().toggleItalic().run()),
    tbtn('underline', 'underline', 'Underline (Ctrl U)', () => editor.chain().focus().toggleUnderline().run()),
    tbtn('strike', 'strikethrough', 'Strikethrough', () => editor.chain().focus().toggleStrike().run()),
    tbtn('smallCaps', 'case-sensitive', 'Small caps (Ctrl Shift K)', () => editor.chain().focus().toggleSmallCaps().run()),
    tbtn('superscript', 'superscript', 'Superscript', () => editor.chain().focus().toggleSuperscript().run()),
    tbtn('subscript', 'subscript', 'Subscript', () => editor.chain().focus().toggleSubscript().run()),
    colorBtn, hlBtn,
    h('span.sep'),
    tbtn('left', 'align-left', 'Align left', () => editor.chain().focus().setTextAlign('left').run()),
    tbtn('center', 'align-center', 'Centre', () => editor.chain().focus().setTextAlign('center').run()),
    tbtn('right', 'align-right', 'Align right', () => editor.chain().focus().setTextAlign('right').run()),
    tbtn('justify', 'align-justify', 'Justify', () => editor.chain().focus().setTextAlign('justify').run()),
    h('span.sep'),
    tbtn('bulletList', 'list', 'Bulleted list', () => editor.chain().focus().toggleBulletList().run()),
    tbtn('orderedList', 'list-ordered', 'Numbered list', () => editor.chain().focus().toggleOrderedList().run()),
    tbtn('blockquote', 'text-quote', 'Block quote', () => editor.chain().focus().toggleBlockquote().run()),
    h('span.sep'),
    iconBtn('asterisk', 'Scene break (Ctrl Alt 8)', () => editor.chain().focus().insertSceneBreak().run()),
    iconBtn('separator-horizontal', 'Page break (Ctrl Enter)', () => editor.chain().focus().insertPageBreak().run()),
    iconBtn('image-plus', 'Insert image', () => insertImage()),
    iconBtn('sticky-note', 'Insert footnote / endnote', () => insertFootnote()),
    iconBtn('omega', 'Special characters', (e) => editor && specialCharPicker(e.currentTarget, editor, book)),
    iconBtn('message-square-dashed', 'Note to self (never printed)', () => editor && addAuthorNote(editor)),
    tbtn('link', 'link', 'Link', () => setLink()),
    iconBtn('remove-formatting', 'Clear formatting', () => editor.chain().focus().unsetAllMarks().setParagraph().updateAttributes('paragraph', { pstyle: '' }).unsetTextAlign().run()),
    imgTools,
    h('span.grow'),
    phoneticBtn,
    micBtn,
    iconBtn('languages', 'Translate / suggest wording for the selection (Ctrl Alt T)', () => suggestForSelection(editor, book)),
    iconBtn('wand-sparkles', 'Writing assistant: paraphrase, fix grammar & punctuation, summarize (Ctrl Alt R)', () => openRephrase()),
    iconBtn('search', 'Find & replace (Ctrl F)', () => openFind()),
    tb.trackBtn = iconBtn('file-diff', 'Track changes: suggest edits that can be accepted or rejected (Ctrl Shift E)', () => toggleTrack()),
    iconBtn('audio-lines', 'Read aloud from the cursor (Ctrl Alt A)', () => editor && readAloud(editor, book)),
    tb.sideBtn = iconBtn('columns-2', 'Show another chapter side by side', () => { setApp({ sideBySide: !state.app.sideBySide }); mount(); }),
    tb.focusBtn = iconBtn('focus', 'Focus mode (Ctrl Shift F)', () => toggleFocus()),
    iconBtn('a-large-small', 'Writing view settings', (e) => viewMenu(e.currentTarget)),
    iconBtn('panel-right', 'Toggle side panel', () => toggleInspector()),
  );

  function swatchGrid(colors, pick, reset) {
    return h('div', { style: { padding: '6px' } },
      h('div.swatches', { style: { width: '200px' } }, colors.map((c) => h('button.swatch', { type: 'button', style: { background: c }, title: c, on: { click: () => { pick(c); closeMenu(); } } }))),
      h('div.row', { style: { marginTop: '8px', gap: '6px' } },
        h('input.color', { type: 'color', on: { change: (e) => { pick(e.target.value); closeMenu(); } } }),
        btn('Remove', { cls: 'btn-sm', kind: 'ghost', onClick: () => { reset(); closeMenu(); } })));
  }

  function viewMenu(anchor) {
    const s = book.settings;
    menu(anchor, [
      { header: 'Writing view (does not affect the printed book)' },
      { custom: h('div', { style: { padding: '4px 10px 10px', width: '260px' } },
        field('Writing font', select(fontOptions(book.meta.language), s.writingFont, (v) => { s.writingFont = v; touch('settings'); applyView(); })),
        field('Text size', slider(s.writingSize, 13, 28, 1, (v) => { s.writingSize = v; applyView(); touch('settings'); }, (v) => `${v}px`)),
        field('Page width', slider(s.pageWidth, 520, 1100, 20, (v) => { s.pageWidth = v; applyView(); touch('settings'); }, (v) => `${v}px`)),
        h('div.col', { style: { gap: '10px' } },
          toggle(state.app.typewriter, (v) => setApp({ typewriter: v }), 'Typewriter scrolling'),
          toggle(state.app.styleHints !== false, (v) => { setApp({ styleHints: v }); applyView(); editor?.storage.proofing.schedule(10); }, 'Show style suggestions'),
          toggle(state.app.spellcheck !== false, (v) => { setApp({ spellcheck: v }); editor?.storage.proofing.schedule(10); }, 'Check spelling'),
          toggle(state.app.punctuation !== false, (v) => { setApp({ punctuation: v }); editor?.storage.proofing.schedule(10); }, 'Check punctuation'),
          toggle(state.app.grammar !== false, (v) => { setApp({ grammar: v }); editor?.storage.proofing.schedule(10); }, 'Check grammar'),
        )) },
    ], { align: 'right' });
  }

  function toggleTrack() {
    book.settings.trackChanges = !book.settings.trackChanges;
    touch('settings');
    drawTrack();
    toast(book.settings.trackChanges ? `Track changes on — your edits are suggestions by ${trackAuthor(book)}` : 'Track changes off', 'info', 2200);
  }
  function drawTrack() {
    tb.trackBtn?.classList.toggle('active', !!book.settings.trackChanges);
    center.classList.toggle('tracking', !!book.settings.trackChanges);
  }

  function toggleFocus() {
    focusMode = !focusMode;
    center.classList.toggle('focus-mode', focusMode);
    tb.focusBtn.classList.toggle('active', focusMode);
    toast(focusMode ? 'Focus mode on — only the current paragraph is highlighted' : 'Focus mode off', 'info', 1600);
  }
  const onFocusEvt = () => toggleFocus();
  document.addEventListener('booky:focus-mode', onFocusEvt);

  async function insertImage() {
    const file = await pickFile('image/*');
    if (!file) return;
    const src = await compressImage(file);
    editor.chain().focus().setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') }).run();
  }

  async function insertFootnote() {
    const note = await promptDialog('Footnote', 'Note text (printed as numbered notes at the end of the chapter; pop-up notes in ebooks)', '', { multiline: true, okLabel: 'Insert' });
    if (note) editor.chain().focus().insertFootnote(note).run();
  }

  async function setLink() {
    const prev = editor.getAttributes('link').href || '';
    const url = await promptDialog('Link', 'Web address (leave empty to remove)', prev, { placeholder: 'https://' });
    if (url == null) return;
    if (!url) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  // ---------- page (header + editor) ----------
  let saveContent = null;
  let side = null;
  function mount() {
    if (editor) { saveContent?.flush(); editor.destroy(); editor = null; }
    clear(page);
    page.classList.remove('turn'); void page.offsetWidth; page.classList.add('turn');
    scroller.querySelector('.original-pane')?.remove();
    scroller.classList.remove('with-original');
    side?.destroy(); side = null;
    stopReading();
    const el = currentElement();
    if (!el) {
      page.appendChild(h('div.empty-state', { style: { marginTop: '60px' } }, icon('feather', 30), h('h3', 'Nothing selected'), h('p', 'Pick a chapter on the left or add a new one.')));
      updateStatus();
      return;
    }
    const def = ELEMENT_TYPES[el.type] || ELEMENT_TYPES.custom;
    const nums = computeNumbers(book);
    const label = el.type === 'chapter' || el.type === 'part' ? chapterLabel(book, el, nums) || (el.type === 'chapter' ? 'Unnumbered chapter' : 'Part') : def.label;
    const head = h('div.editor-head', h('div.eh-label', label));
    if (def.heading || el.type === 'chapter' || el.type === 'part') {
      const t = h('input', { value: el.title, placeholder: el.type === 'chapter' ? 'Chapter title (optional)' : 'Title', 'aria-label': 'Title' });
      t.addEventListener('input', () => { el.title = t.value; touch('element-title', el.id); });
      t.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus('start'); } });
      const sub = h('input.sub', { value: el.subtitle || '', placeholder: 'Subtitle (optional)', 'aria-label': 'Subtitle' });
      sub.addEventListener('input', () => { el.subtitle = sub.value; touch('element-title', el.id); });
      add(head, t, sub);
    }
    page.appendChild(head);

    if (el.type === 'toc') {
      const sections = renderSections(book, 'ebook').filter((s) => s.inToc);
      add(page, 
        h('div.generated-note', icon('info', 18), h('div', h('b', 'This table of contents is generated automatically'), h('div', 'It updates as you add, rename and reorder chapters. Page numbers are added in the print PDF. Style it in Format → Table of contents.'))),
        h('ol.toc-preview', sections.map((s) => h('li', s.nav))),
      );
      updateStatus();
      return;
    }
    if (el.type === 'blank') {
      page.appendChild(h('div.generated-note', icon('info', 18), h('div', 'An intentionally blank page (print only). Useful to control which side a page falls on.')));
      updateStatus();
      return;
    }
    if (/\{\{\w+\}\}/.test(el.content)) {
      page.appendChild(h('div.generated-note', icon('sparkles', 18), h('div', h('b', 'Smart page'), h('div', 'Text in {{braces}} is filled from Book details (title, author, ISBN…) when you export. Lines with empty fields are hidden automatically. '), h('a', { href: '#', on: { click: (e) => { e.preventDefault(); import('./details.js').then((m) => m.openDetails('publishing')); } } }, 'Edit book details →'))));
    }

    const host = h('div.editor-host');
    page.appendChild(host);
    const sideBySide = !!(state.app.showOriginal && el.source && book.translation);
    scroller.classList.toggle('with-original', sideBySide);
    if (sideBySide) scroller.insertBefore(originalPane(el, { insert: (text) => editor?.chain().focus().command(({ tr }) => { tr.insertText(text); return true; }).run() }), page);
    else if (state.app.sideBySide && book.elements.length > 1) {
      side = sidePane(book, el.id, { onClose: () => { setApp({ sideBySide: false }); mount(); } });
      scroller.classList.add('with-original');
      scroller.appendChild(side.el);
    }
    tb.sideBtn?.classList.toggle('active', !!state.app.sideBySide);
    rememberPlace(el.id);
    saveContent = debounce(() => {
      if (!editor || editor.isDestroyed) return;
      el.content = editor.getHTML();
      touch('content', el.id);
    }, 350);

    editor = new Editor({
      element: host,
      content: el.content || '<p></p>',
      extensions: [
        ...baseExtensions(),
        ...(state.app.smartQuotes !== false ? [Typography.configure({ oneHalf: false, oneQuarter: false, threeQuarters: false, plusMinus: false, notEqual: false, laquo: false, raquo: false, multiplication: false })] : []),
        Placeholder.configure({ placeholder: el.type === 'chapter' ? 'Once upon a time…' : 'Start writing…' }),
        Focus.configure({ mode: 'shallowest' }),
        CharacterCount,
        Proofing.configure({ getSettings: proofSettings, onUpdate: () => { emit('proof', editor); updateStatus(); } }),
        FindHighlight,
        ReadAloudHighlight,
        BlockBadges,
        TrackChanges.configure({ enabled: () => !!book.settings.trackChanges, author: () => trackAuthor(book) }),
        Typewriter.configure({ enabled: () => state.app.typewriter, scroller: () => scroller }),
        PhoneticTyping.configure({
          enabled: () => phoneticOn(),
          convert: (w) => transliterateWord(w, langInfo(book.meta.language).script),
          onToggle: () => togglePhonetic(),
        }),
        Annotations.configure({
          getComments: () => (state.app.showReviewNotes === false ? [] : ensureReviews(book).comments.filter((c) => c.elId === el.id && c.status === 'open')),
          getReviewer: reviewerById,
        }),
      ],
      editorProps: {
        // English is checked by Booky's own dictionary; other languages use the browser's spell checker if it has one.
        attributes: { spellcheck: isEnglish(book.meta.language) || state.spellLang === String(book.meta.language).split('-')[0] ? 'false' : 'true', lang: book.meta.language || 'en', dir: isRtl(book.meta.language) ? 'rtl' : 'ltr', class: 'book-prose', 'aria-label': 'Manuscript text' },
        // Word / Google Docs / web: keep structure and emphasis, drop fonts, colours and sizes; tidy typography
        transformPastedHTML: (html) => cleanPastedHtml(html, { typography: state.app.smartQuotes !== false, lang: book.meta.language || 'en' }),
        transformPastedText: (text) => (state.app.smartQuotes !== false ? text.split('\n').map((line) => cleanText(line, '', { lang: book.meta.language || 'en' })).join('\n') : text),
        handleClickOn: (view, pos, node, nodePos, event) => {
          if (node.type.name === 'footnote') { editFootnote(nodePos, node); return true; }
          if (node.type.name === 'indexMark') { toast(`Index: ${node.attrs.term}${node.attrs.sub ? ` › ${node.attrs.sub}` : ''} — right-click → Index terms… to rename or delete`, 'info', 3200); return false; }
          return false;
        },
        handleDOMEvents: {
          contextmenu: (view, e) => { contextMenu(e); return true; },
        },
      },
      onUpdate: () => { saveContent(); updateStatus(); },
      onSelectionUpdate: () => { updateToolbar(); updateStatus(); },
      onTransaction: () => updateToolbar(),
    });
    editor.view.dom.addEventListener('click', onProofClick);
    updateToolbar();
    updateStatus();
    emit('editor', editor);
  }

  async function editFootnote(pos, node) {
    const note = await promptDialog('Edit footnote', 'Note text (clear it to delete the note)', node.attrs.note, { multiline: true, okLabel: 'Save' });
    if (note == null) return;
    const tr = editor.state.tr;
    if (!note.trim()) tr.delete(pos, pos + node.nodeSize);
    else tr.setNodeMarkup(pos, null, { note });
    editor.view.dispatch(tr);
  }

  // ---------- proofing interactions ----------
  function onProofClick(e) {
    const target = e.target.closest?.('.pf');
    const annot = e.target.closest?.('.rv-annot');
    if (!target && annot) { showReviewComment(annot.getAttribute('data-comment'), annot.getBoundingClientRect()); return; }
    if (!target) return;
    const pos = editor.view.posAtDOM(target, 0);
    const issues = issuesAt(editor.state, pos + 0);
    if (issues.length) showIssue(issues[0], target.getBoundingClientRect());
  }

  function showReviewComment(id, rect) {
    const c = ensureReviews(book).comments.find((x) => x.id === id);
    if (!c) return;
    const rev = reviewerById(c.reviewerId);
    const pop = h('div.issue-pop',
      h('div.ip-kind', { style: { color: rev?.color } }, `${rev?.name || 'Reviewer'} · ${COMMENT_TYPES[c.type]?.label || 'Comment'}`),
      c.note ? h('div.ip-msg', c.note) : null,
      c.suggestion != null ? h('div.ip-msg', h('s.muted', c.quote), ' → ', h('b', { style: { color: 'var(--success)' } }, c.suggestion)) : null,
      h('div.ip-actions',
        c.suggestion != null ? btn('Apply edit', { icon: 'check', cls: 'btn-sm', kind: 'primary', onClick: () => { closeMenu(); applySuggestion(c); } }) : null,
        btn('Done', { icon: 'circle-check', cls: 'btn-sm', onClick: () => { closeMenu(); setStatus(c, 'resolved'); } }),
        btn('Won’t fix', { cls: 'btn-sm', kind: 'ghost', onClick: () => { closeMenu(); setStatus(c, 'wontfix'); } }),
        btn('Next ›', { cls: 'btn-sm', kind: 'ghost', onClick: () => { closeMenu(); goNext(c); } })));
    popover(rect, pop);
  }

  async function showIssue(issue, rect) {
    const chips = h('div.chips');
    const apply = (rep) => {
      editor.chain().focus().insertContentAt({ from: issue.from, to: issue.to }, rep ? rep : '').run();
      if (!rep) {
        // tidy double spaces left by deletions
        const { from } = editor.state.selection;
        const txt = editor.state.doc.textBetween(Math.max(0, from - 1), Math.min(editor.state.doc.content.size, from + 1));
        if (txt === '  ') editor.chain().deleteRange({ from, to: from + 1 }).run();
      }
      closeMenu();
    };
    const kindLabel = { spelling: 'Spelling', grammar: 'Grammar', style: 'Style suggestion', clarity: 'Clarity' }[issue.kind];
    const actions = h('div.ip-actions');
    const pop = h('div.issue-pop',
      h('div', { class: `ip-kind kind-${issue.kind}` }, kindLabel, issue.title && issue.kind !== 'spelling' ? ` · ${issue.title}` : ''),
      h('div.ip-msg', issue.message),
      chips, actions);
    if (issue.kind === 'spelling') {
      chips.appendChild(h('span.muted.small', 'Finding suggestions…'));
      suggest(issue.word).then((list) => {
        clear(chips);
        if (!list.length) chips.appendChild(h('span.muted.small', 'No suggestions'));
        list.forEach((s) => chips.appendChild(h('button.chip', { type: 'button', on: { click: () => apply(s) } }, s)));
      });
      add(actions, 
        btn('Add to dictionary', { icon: 'plus', cls: 'btn-sm', kind: 'ghost', onClick: () => { addToDictionary(issue.word); closeMenu(); editor.storage.proofing.schedule(10); toast(`“${issue.word}” added to your dictionary`, 'success'); } }),
        btn('Ignore', { cls: 'btn-sm', kind: 'ghost', onClick: () => { ignoreWord(issue.word); closeMenu(); editor.storage.proofing.schedule(10); } }),
      );
    } else {
      (issue.replacements || []).forEach((r) => chips.appendChild(h(`button.chip${r === '' ? '.strike' : ''}`, { type: 'button', on: { click: () => apply(r) } }, r === '' ? editor.state.doc.textBetween(issue.from, issue.to) : r)));
      if (issue.sentence) add(actions, btn('Rephrase sentence', { icon: 'wand-sparkles', cls: 'btn-sm', kind: 'ghost', onClick: () => openRephrase({ from: issue.sentenceFrom, to: issue.sentenceTo }) }));
      add(actions, btn('Dismiss', { cls: 'btn-sm', kind: 'ghost', onClick: () => { dismissed.add(`${issue.rule}:${editor.state.doc.textBetween(issue.from, issue.to)}`); closeMenu(); editor.storage.proofing.schedule(10); } }));
    }
    popover(rect, pop);
  }

  async function contextMenu(e) {
    e.preventDefault();
    const posInfo = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    const items = [];
    const sel = editor.state.selection;
    if (posInfo) {
      const issues = issuesAt(editor.state, posInfo.pos);
      const sp = issues.find((i) => i.kind === 'spelling');
      if (sp) {
        const sugg = await suggest(sp.word);
        items.push({ header: `Spelling: “${sp.word}”` });
        sugg.slice(0, 6).forEach((s) => items.push({ label: s, icon: 'check', onClick: () => editor.chain().focus().insertContentAt({ from: sp.from, to: sp.to }, s).run() }));
        if (!sugg.length) items.push({ label: 'No suggestions', disabled: true });
        items.push({ label: 'Add to dictionary', icon: 'plus', onClick: () => { addToDictionary(sp.word); editor.storage.proofing.schedule(10); } });
        items.push({ label: 'Ignore word', icon: 'eye-off', onClick: () => { ignoreWord(sp.word); editor.storage.proofing.schedule(10); } });
        items.push({ divider: true });
      }
      const other = issues.filter((i) => i.kind !== 'spelling');
      other.slice(0, 2).forEach((i) => {
        items.push({ header: i.title });
        (i.replacements || []).slice(0, 3).forEach((r) => items.push({ label: r === '' ? `Remove “${editor.state.doc.textBetween(i.from, i.to)}”` : r, icon: 'wand-sparkles', onClick: () => editor.chain().focus().insertContentAt({ from: i.from, to: i.to }, r).run() }));
      });
      if (other.length) items.push({ divider: true });
      // word under cursor → synonyms
      const $p = editor.state.doc.resolve(posInfo.pos);
      const text = $p.parent.textContent;
      const off = posInfo.pos - $p.start();
      let a = off, b = off;
      while (a > 0 && /[\p{L}'’]/u.test(text[a - 1])) a--;
      while (b < text.length && /[\p{L}'’]/u.test(text[b])) b++;
      const word = text.slice(a, b);
      const syns = word ? synonymsFor(word) : [];
      if (syns.length) {
        items.push({ label: `Synonyms for “${word}”`, icon: 'book-a', sub: syns.map((s) => ({ label: s, onClick: () => editor.chain().focus().insertContentAt({ from: $p.start() + a, to: $p.start() + b }, s).run() })) });
      }
    }
    items.push({ label: 'Paraphrase…', icon: 'wand-sparkles', hint: 'Ctrl Alt R', onClick: () => openRephrase(posInfo && sel.empty ? { at: posInfo.pos } : null) });
    items.push({ label: 'Fix grammar & punctuation…', icon: 'spell-check', onClick: () => openRephrase(posInfo && sel.empty ? { at: posInfo.pos } : null, 'grammar') });
    if (!sel.empty) items.push({ label: 'Summarize selection…', icon: 'list', onClick: () => openRephrase(null, 'summary') });
    items.push({ label: 'Copy', icon: 'copy', disabled: sel.empty, onClick: () => document.execCommand('copy') });
    items.push({ label: 'Cut', icon: 'copy', disabled: sel.empty, onClick: () => document.execCommand('cut') });
    items.push({ label: 'Paste as plain text', icon: 'text-quote', hint: 'Ctrl Shift V', onClick: async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) editor.chain().focus().insertContent(textToHtml(text)).run();
      } catch { toast('The browser didn’t allow reading the clipboard — press Ctrl+Shift+V (⌘⇧V on Mac) instead.', 'warn', 5000); }
    } });
    items.push({ divider: true });
    items.push({ label: 'Insert footnote', icon: 'sticky-note', onClick: () => insertFootnote() });
    items.push({ label: 'Insert scene break', icon: 'asterisk', onClick: () => editor.chain().focus().insertSceneBreak().run() });
    const tcHere = posInfo ? changeAt(editor.state, posInfo.pos) : null;
    if (tcHere) {
      items.unshift({ divider: true });
      items.unshift({ label: 'Reject this change', icon: 'x', onClick: () => editor.commands.rejectChange(tcHere.id) });
      items.unshift({ label: 'Accept this change', icon: 'check', onClick: () => editor.commands.acceptChange(tcHere.id) });
      items.unshift({ header: `${tcHere.kind === 'ins' ? 'Added' : 'Deleted'} by ${tcHere.author || 'someone'}` });
    }
    items.push({ label: 'Tracked changes…', icon: 'file-diff', onClick: () => openChangesPanel(book) });
    items.push({ label: 'Insert cross-reference…', icon: 'link', onClick: () => crossRefDialog(editor, book) });
    const blk = (() => { const $f = editor.state.selection.$from; return $f.depth ? $f.node(1) : null; })();
    const a = blk?.attrs || {};
    const setOpt = (k, v) => editor.chain().focus().setBlockOption(k, v).run();
    items.push({ label: 'Block options', icon: 'sliders-horizontal', sub: [
      { header: 'Show this block in' },
      { label: 'Print and ebook', checked: !a.only, onClick: () => setOpt('only', null) },
      { label: 'Print only', checked: a.only === 'print', onClick: () => setOpt('only', 'print') },
      { label: 'Ebook only', checked: a.only === 'ebook', onClick: () => setOpt('only', 'ebook') },
      { divider: true },
      { header: 'Print layout fixes' },
      { label: 'Keep with next', checked: !!a.keepNext, onClick: () => setOpt('keepNext', a.keepNext ? null : true) },
      { label: 'Keep lines together', checked: !!a.keepLines, onClick: () => setOpt('keepLines', a.keepLines ? null : true) },
      { label: 'Page break before', checked: !!a.breakBefore, onClick: () => setOpt('breakBefore', a.breakBefore ? null : true) },
      { label: `Tracking${a.tracking ? ` (${a.tracking > 0 ? '+' : ''}${a.tracking})` : ''}`, sub: [-10, -6, -3, 0, 3, 6, 10].map((t) => ({ label: t ? `${t > 0 ? '+' : ''}${t}/1000 em${t < 0 ? ' (tighter — pulls back a short line)' : ' (looser)'}` : 'Normal', checked: (a.tracking || 0) === t, onClick: () => setOpt('tracking', t || null) })) },
    ] });
    items.push({ label: 'Note to self…', icon: 'message-square-dashed', onClick: () => addAuthorNote(editor) });
    items.push({ label: 'Read aloud from here', icon: 'audio-lines', onClick: () => { if (posInfo && sel.empty) editor.commands.setTextSelection(posInfo.pos); readAloud(editor, book); } });
    items.push({ divider: true });
    const cur = currentElement();
    items.push({ label: 'Split chapter here', icon: 'scissors', onClick: () => { if (posInfo && sel.empty) editor.commands.setTextSelection(posInfo.pos); splitChapterHere(editor, book, cur); } });
    items.push({ label: 'Merge with next chapter', icon: 'merge', disabled: !nextInSection(book, cur), onClick: () => mergeWithNext(editor, book, cur) });
    items.push({ label: 'Move selection to…', icon: 'move', disabled: sel.empty, onClick: () => moveSelectionTo(editor, book, cur) });
    items.push({ divider: true });
    items.push({ label: 'Add to index…', icon: 'list-ordered', onClick: () => addToIndexDialog(editor, book) });
    items.push({ label: 'Index terms…', icon: 'list-ordered', onClick: () => openIndexPanel(book, editor) });
    menu({ x: e.clientX, y: e.clientY }, items);
  }

  // ---------- rephrase ----------
  function openRephrase(range, tab = 'paraphrase') {
    if (!editor) return;
    // a range, a point (that paragraph), or nothing (the selection, else the paragraph at the cursor)
    openAssistant(editor, book, range, tab);
  }

  // ---------- find & replace ----------
  function openFind() {
    if (findBar) { findBar.querySelector('input').focus(); return; }
    let query = '', replace = '', opts = { caseSensitive: false, wholeWord: false, regex: false }, scope = 'chapter', idx = 0, matches = [];
    const count = h('span.muted.small', '');
    const q = h('input.input', { placeholder: 'Find…', 'aria-label': 'Find' });
    const r = h('input.input', { placeholder: 'Replace with…', 'aria-label': 'Replace' });
    const refresh = () => {
      if (!editor) return;
      matches = query ? findMatches(editor.state.doc, query, opts) : [];
      idx = Math.min(idx, Math.max(0, matches.length - 1));
      setFindState(editor, matches, idx);
      if (scope === 'book') {
        const total = bookCount();
        count.textContent = query ? `${total} in book` : '';
      } else count.textContent = query ? (matches.length ? `${idx + 1} of ${matches.length}` : 'No results') : '';
    };
    const go = (d) => {
      if (!matches.length) return;
      idx = (idx + d + matches.length) % matches.length;
      setFindState(editor, matches, idx);
      editor.commands.setTextSelection(matches[idx]);
      editor.view.domAtPos(matches[idx].from)?.node?.parentElement?.scrollIntoView?.({ block: 'center' });
      count.textContent = `${idx + 1} of ${matches.length}`;
    };
    const makeRe = () => {
      let src = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (opts.wholeWord) src = `\\b${src}\\b`;
      try { return new RegExp(src, opts.caseSensitive ? 'g' : 'gi'); } catch { return null; }
    };
    const bookCount = () => {
      const re = makeRe();
      if (!re) return 0;
      return state.book.elements.reduce((n, e) => n + ((e.id === state.currentId ? editor.getText() : e.content.replace(/<[^>]+>/g, ' ')).match(re) || []).length, 0);
    };
    const replaceOne = () => {
      if (!matches.length) return;
      const m = matches[idx];
      editor.chain().focus().insertContentAt(m, replace).run();
      refresh();
    };
    const replaceAll = () => {
      if (!query) return;
      let n = 0;
      if (matches.length) {
        const tr = editor.state.tr;
        [...matches].reverse().forEach((m) => { tr.insertText(replace, m.from, m.to); n++; });
        editor.view.dispatch(tr);
      }
      if (scope === 'book') {
        const re = makeRe();
        for (const e of state.book.elements) {
          if (e.id === state.currentId || !re) continue;
          const tpl = document.createElement('template');
          tpl.innerHTML = e.content;
          const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
          let changed = false;
          while (walker.nextNode()) {
            const t = walker.currentNode;
            const nv = t.data.replace(re, () => { n++; changed = true; return replace; });
            if (nv !== t.data) t.data = nv;
          }
          if (changed) { const d = document.createElement('div'); d.appendChild(tpl.content); e.content = d.innerHTML; }
        }
        touch('content');
      }
      toast(`Replaced ${n} occurrence${n === 1 ? '' : 's'}`, 'success');
      refresh();
    };
    q.addEventListener('input', () => { query = q.value; idx = 0; refresh(); });
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(e.shiftKey ? -1 : 1); if (e.key === 'Escape') close(); });
    r.addEventListener('input', () => { replace = r.value; });
    r.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    const optToggle = (key, label, title) => {
      const b = h('button.filter-pill', { type: 'button', title, on: { click: () => { opts[key] = !opts[key]; b.classList.toggle('on', opts[key]); refresh(); } } }, label);
      return b;
    };
    const close = () => { findBar?.remove(); findBar = null; if (editor) setFindState(editor, [], 0); };
    findBar = h('div.findbar',
      h('div.row', q, iconBtn('chevron-up', 'Previous (Shift Enter)', () => go(-1)), iconBtn('chevron-down', 'Next (Enter)', () => go(1)), iconBtn('x', 'Close (Esc)', close)),
      h('div.row', r, btn('Replace', { cls: 'btn-sm', onClick: replaceOne }), btn('All', { cls: 'btn-sm', onClick: replaceAll })),
      h('div.opts', optToggle('caseSensitive', 'Aa', 'Match case'), optToggle('wholeWord', 'Whole word', 'Whole words only'), optToggle('regex', '.*', 'Regular expression'),
        select([['chapter', 'This chapter'], ['book', 'Whole book']], scope, (v) => { scope = v; refresh(); }, { style: 'height:26px;width:auto;font-size:12px' }),
        h('span.grow'), count));
    center.appendChild(findBar);
    const sel = editor?.state.selection;
    if (sel && !sel.empty) { q.value = query = editor.state.doc.textBetween(sel.from, sel.to); refresh(); }
    q.focus();
    findBar._refresh = refresh;
  }

  // ---------- state sync ----------
  function updateToolbar() {
    if (!editor) return;
    const a = (n, attrs) => editor.isActive(n, attrs);
    for (const k of ['bold', 'italic', 'underline', 'strike', 'smallCaps', 'superscript', 'subscript', 'bulletList', 'orderedList', 'blockquote', 'link']) tb[k]?.classList.toggle('active', a(k));
    for (const al of ['left', 'center', 'right', 'justify']) tb[al]?.classList.toggle('active', a({ textAlign: al }));
    tb.undo.disabled = !editor.can().undo();
    tb.redo.disabled = !editor.can().redo();
    let sv = 'p';
    for (let l = 1; l <= 4; l++) if (a('heading', { level: l })) sv = `h${l}`;
    if (sv === 'p') { const ps = editor.getAttributes('paragraph').pstyle; if (ps) sv = `ps:${ps}`; }
    styleSel.value = sv;
    const ts = editor.getAttributes('textStyle');
    fontSel.value = ts.fontFamily?.replace(/["']/g, '').split(',')[0] || '';
    sizeSel.value = SIZES.includes(ts.fontSize) ? ts.fontSize : '';
    imgTools.classList.toggle('hidden', !a('image'));
    if (a('image')) imgTools.querySelector('select').value = editor.getAttributes('image').width || '100';
  }

  function updateStatus() {
    clear(status);
    const el = currentElement();
    if (!editor || !el) return;
    const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ', ' ');
    const words = countWords(text);
    const sel = editor.state.selection;
    const selWords = sel.empty ? 0 : countWords(editor.state.doc.textBetween(sel.from, sel.to, ' '));
    const set = proofKey.getState(editor.state);
    const counts = { spelling: 0, grammar: 0, style: 0, clarity: 0 };
    set?.find().forEach((d) => { const k = d.spec.issue?.kind; if (k in counts) counts[k]++; });
    const target = el.wordTarget || 0;
    const sw = sessionWords();
    add(status, ...[
      h('span', h('b', words.toLocaleString()), target ? ` / ${target.toLocaleString()}` : '', ' words'),
      selWords ? h('span', h('b', selWords), ' selected') : null,
      h('span.divider'),
      h('span', `${Math.max(1, Math.round(words / 238))} min read`),
      h('span.divider'),
      h('span', { title: 'Words written this session' }, icon('flame', 13), ' ', h('b', (sw >= 0 ? '+' : '') + sw.toLocaleString())),
      h('span.divider'),
      h('span', { title: 'Spelling · Grammar · Style issues in this chapter', style: { display: 'inline-flex', gap: '8px', cursor: 'pointer' }, on: { click: () => emit('show-tab', 'check') } },
        h('span', { style: { color: 'var(--spell)' } }, '● ', counts.spelling),
        h('span', { style: { color: 'var(--grammar)' } }, '● ', counts.grammar),
        h('span', { style: { color: 'var(--style)' } }, '● ', counts.style + counts.clarity)),
    ].filter(Boolean));
  }

  // Keyboard navigation between chapters
  const onKey = (e) => {
    if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const list = orderedElements(book);
      const i = list.findIndex((x) => x.id === state.currentId);
      const next = list[i + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) { e.preventDefault(); selectElement(next.id); }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !e.shiftKey) { e.preventDefault(); openFind(); }
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === 'KeyR') { e.preventDefault(); openRephrase(); }
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === 'KeyV') { e.preventDefault(); toggleVoice(); }
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === 'KeyT') { e.preventDefault(); suggestForSelection(editor, book); }
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === 'KeyA') { e.preventDefault(); if (editor) readAloud(editor, book); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyE') { e.preventDefault(); toggleTrack(); }
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && /^Digit[0-9]$/.test(e.code) && editor) {
      const n = +e.code.slice(5);
      const cs = (book.format.charStyles || [])[n - 1];
      if (n === 0) { e.preventDefault(); editor.chain().focus().unsetCharStyle().run(); } else if (cs) { e.preventDefault(); editor.chain().focus().setCharStyle(cs.id).run(); }
    }
  };
  document.addEventListener('keydown', onKey);

  drawTrack();
  mount();
  initSpell().then(() => applyBookSpelling(book)).then(() => editor?.storage.proofing.schedule(10));

  const offs = [
    on('select', () => { if (findBar) { findBar.remove(); findBar = null; } mount(); }),
    on('elements', () => { if (!currentElement() || !editor) mount(); }),
    on('app', (p) => { if ('styleHints' in p || 'spellcheck' in p || 'grammar' in p || 'fictionHints' in p || 'punctuation' in p) { applyView(); editor?.storage.proofing.schedule(10); } }),
    on('app', (p) => { if ('showOriginal' in p) mount(); }),
    on('spell-changed', () => editor?.storage.proofing.schedule(10)),
    on('format', applyView),
    on('meta', () => { drawPhoneticBtn(); applyView(); if (editor && editor.view.dom.getAttribute('lang') !== (book.meta.language || 'en')) mount(); }),
    on('elements', () => { if (editor && editor.view.dom.getAttribute('lang') !== (book.meta.language || 'en')) { drawPhoneticBtn(); applyView(); mount(); } }),
    on('replace-content', () => mount()),
    on('editor-command', (fn) => editor && fn(editor)),
    on('reviews', () => editor?.storage.annotations?.refresh()),
    on('open-rephrase', (r) => openRephrase(r)),
  ];
  return () => {
    voice?.stop();
    saveContent?.flush();
    stopReading();
    side?.destroy();
    offs.forEach((f) => f());
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('booky:focus-mode', onFocusEvt);
    if (editor) { editor.destroy(); editor = null; }
  };
}
