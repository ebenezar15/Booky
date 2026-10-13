# Booky — write, format and publish books offline

Booky is a book-writing studio that runs entirely on your computer. You can draft a manuscript, organise chapters, check spelling and grammar, design a print-ready interior, make a cover, and export **print-ready PDF**, **EPUB**, **DOCX** and more. It never needs an internet connection.

It takes ideas from Atticus, Reedsy Studio, Scrivener and InDesign and puts them in one simple tool.

---

## Install the desktop app (Windows & Mac)
Booky is also an installable app with its own icon. It works the same on Windows and macOS: both use the same engine, so books, layouts and PDFs come out identical.

- **Download:** from the **[Releases page](https://github.com/ebenezar15/Booky/releases/latest)**. They're also under Actions → Desktop apps → latest run → Artifacts.
- **No install needed:** open **https://ebenezar15.github.io/Booky/** and click *Open Booky in your browser*.
  - **Windows:** `Booky-Setup-x.y.z.exe`, the installer, which adds Start-menu and desktop shortcuts. There is also a `portable` .exe that runs without installing.
  - **Mac:** `Booky-x.y.z-mac-arm64.dmg` for Apple Silicon (M1–M4), or `…-mac-x64.dmg` for Intel Macs. Open it and drag Booky to Applications.
- **First launch:** the app isn't signed with a paid Apple or Microsoft certificate yet, so each system asks once.
  - **Windows:** "Windows protected your PC" → *More info* → *Run anyway*.
  - **Mac:** if macOS says it can't check the app, open System Settings → Privacy & Security → *Open Anyway*. Or run `xattr -cr /Applications/Booky.app` once in Terminal.
- **Desktop extras:**
  - **Save vector PDF** gives sharp, print-ready text at the exact trim size with no print dialog.
  - Double-click `.booky` backups and `.bookyreview` comment files to open them.
  - Native menus; the app remembers its window size.
  - The microphone is used only during voice typing.
- **Your data:**
  - The desktop app has its own library, stored in the app's folder.
  - To move books between the browser and the app, use *Download backup* in one and open the `.booky` file in the other.

Build it yourself: `npm run dist:win` on Windows or `npm run dist:mac` on a Mac. Output goes to `release/desktop/`.

## Quick start (no installation)

1. Download **[`release/Booky.html`](release/Booky.html)**.
2. Double-click it to open it in **Chrome, Edge or Brave**. Firefox and Safari also work, but print output is best in Chromium browsers.
3. Click **New book**, pick a template and start writing.

The app is that one file. Fonts, the English dictionary and every library are built in, so it keeps working offline. Your books are saved automatically inside the browser's private storage.

> **Back up your work.** Browser storage is tied to that browser on that computer. Use **Publish → Project backup** (or ⋮ → *Download backup*) now and then, and keep the `.booky` file somewhere safe. You can open it on any computer with **Open backup** on the home screen.

---

## Features

### 🗃️ Projects & appearance
- **Animations**: a splash screen, page turns between chapters, smooth mode switches, springy dialogs and buttons, a pulsing microphone, shimmer while suggestions load, and a confetti burst when you finish an export, a translation or the last review comment. Turn them off in Settings → General; they also stay off if your system is set to reduce motion.
- Keep any number of book projects. Search them, sort by recent / newest / title / length, and duplicate, back up or delete them.
- Colour schemes:
  - **Cadenza violet** (the same deep-violet look as Mindapp and Practise-app) is the default.
  - Other presets: Orchid, Indigo, Ocean, Emerald, Rose, Notes orange and Graphite, or pick **your own colours**.
  - Light, sepia or dark mode.
  - A deep-colour or light sidebar.
  - Change them from the 🎨 button.

### 🛟 Keep your work safe
- **Automatic folder backups** (Settings → Backups): choose a folder — ideally one that is itself backed up, like Dropbox, OneDrive, iCloud Drive or a USB stick.
  - Booky writes a dated `.booky` copy of each book you edit there every 30 minutes of editing and when you close it, and keeps the newest 10 per book (you can change the number).
  - Works in the desktop app and in Chrome and Edge. Browsers ask you to allow the folder again after a restart; Booky shows a one-click *Allow* bar.
  - Firefox and Safari can't write to folders, so Booky reminds you instead.
- **Backup status**: each book card and the top bar show when the book was last backed up. A reminder bar appears when a book hasn't been backed up for 7 days.
- **Milestones**: save a named copy of the whole book ("Sent to editor", "Proof 1") from the top-bar backup menu or the History tab. Compare any page with a milestone word by word, and restore one page (a snapshot of the current text is taken first, so it can be undone). Milestones are included in backups.
- **Storage health** (Settings → Backups, and the library footer): space used and free, and whether the browser has promised not to clear your books. Booky warns when space runs low and if a save fails.

### ✍️ Write
- **Binder** with front matter, body and back matter. Drag and drop to reorder, filter, set status labels (To Do → Final), and choose per page whether it appears in print, in the ebook, or both.
- **Every standard book page**, each ready to fill in: half title, series page, *Also by*, frontispiece, title page, copyright, dedication, epigraph, table of contents (generated automatically), list of illustrations, foreword, preface, introduction, prologue, parts, chapters, interludes, epilogue, afterword, acknowledgments, appendix, glossary, notes, bibliography, index, about the author, reading-group guide, excerpt, newsletter / call to action, colophon, blank pages and custom pages.
- **Smart pages**: the title and copyright pages use fields such as `{{title}}`, `{{author}}` and `{{isbnPrint}}`, which are filled from *Book details*. Lines whose fields are empty are hidden automatically.
- **Rich editor**:
  - Paragraph styles: body, no indent, verse, epigraph, attribution, letter, signature, caption, callout box, hanging indent, small print, display title and more.
  - Headings 1–4, bold, italic, underline, strikethrough, small caps, superscript and subscript.
  - Any font and size, text colour and highlight, all four alignments, lists, block quotes and links.
  - Images with width and alignment controls and alt text.
  - Footnotes, scene breaks and page breaks.
- **Writing comfort**:
  - Focus mode and typewriter scrolling.
  - Smart quotes and dashes.
  - A writing font that is separate from the book design.
  - Light, sepia and dark themes.
  - Word count, reading time and session progress.
- **Find & replace** in the current chapter or the whole book, with match case, whole word and regular-expression options.
- **Snapshots**: save versions of a chapter and restore them at any time.
- **Split, merge and move**: right-click → *Split chapter here* (a heading at the cursor becomes the new chapter's title), *Merge with next chapter* (also in the binder menu), and *Move selection to…* another chapter. A snapshot is taken first, so each can be undone from the History tab.
- **Quick jump** (Ctrl/⌘ P): type part of a chapter title, a heading, a story-bible name, or a print page number (“p 142”) and press Enter.
- **Notes to self and placeholders**: add a note to self (toolbar or right-click) — a small marker with a tooltip that is never printed or exported. Booky also spots the placeholders `TK`, `XX`, `[[…]]` and `???`. *Notes to self & placeholders* (top-bar ⋮ menu) lists them all, and exports ask before going ahead while any placeholders remain (with *Export anyway*).
- **Read aloud** (Ctrl Alt A, or right-click → *Read aloud from here*): uses your computer's own voices, highlights the sentence being read, with pause, speed and voice choice. It stops as soon as you start typing, and tells you plainly when no voice for the book's language is installed.
- **Special characters** (Ω): dashes and special spaces, curly quotes and primes, fractions, ©, ™, §, arrows and currencies (including ₹), every letter and sign of the book's script, and the ones you used recently.
- **Two chapters side by side**: show another chapter next to the one you're writing, read-only or editable, for continuity checks.

### 🌏 Languages & fonts
- Write in **Tamil, Hindi, Malayalam, Telugu, Kannada, Bengali, Marathi, Gujarati, Punjabi, Odia, Assamese, Sanskrit, Nepali, Urdu, Sinhala, Arabic** and 12 European and world languages (Spanish, French, German, Indonesian, Swahili, Vietnamese…), as well as English.
- Choosing a language (when you create a book, or later in *Book details*) sets everything up to suit it:
  - suitable body and heading fonts;
  - local words for "Chapter", "Part" and "Contents" (e.g. அத்தியாயம், अध्याय), which you can edit;
  - comfortable line spacing and no hyphenation for Indian scripts;
  - right-to-left layout for Urdu and Arabic, in print and in the ebook.
- **112 fonts are built in and work offline**, grouped by script in every font menu with the book's own script first:
  - **English & European (56):** the classic book faces (EB Garamond, Caslon, Baskerville, Crimson, Lora, Merriweather, Source Serif, Literata, Vollkorn…), Times New Roman / Calibri / Cambria-compatible fonts (Tinos, Carlito, Caladea), popular sans-serifs (Inter, Open Sans, Roboto, Lato, Montserrat, Poppins…), display, script and typewriter fonts.
  - **Tamil (11):** Noto Serif/Sans Tamil, Tiro Tamil, Hind Madurai, Mukta Malar, Catamaran, Pavanam, Arima, Meera Inimai, Baloo Thambi 2, Kavivanar.
  - **Hindi, Marathi, Sanskrit & Nepali (11):** Noto Serif/Sans Devanagari, Tiro Devanagari (Hindi, Marathi, Sanskrit), Martel, Mukta, Hind, Laila, Kalam, Yatra One.
  - **Malayalam, Telugu, Kannada, Bengali, Gujarati, Punjabi, Odia (3–5 each),** plus Urdu (Noto Nastaliq, Gulzar), Arabic and Sinhala.
  - Fonts installed on your computer (Times New Roman, Georgia, Nirmala UI, Latha, Mangal…) and your own font files can be used too.
- Only the fonts a book actually uses are embedded in its PDF, EPUB and review copies, so files stay small.
- **Phonetic typing** for nine Indian scripts: type in English letters and each word turns into the script when you press space, e.g. `vaNakkam` → வணக்கம், `namaste` → नमस्ते. Switch it on and off with the அ button or Ctrl + Shift + Space; right-click the button for the key guide. Ctrl + Z restores the English letters. (Your computer's own Tamil/Hindi keyboards work as well.)
- English spelling and grammar checks switch off automatically for other languages; the browser's own spell checker is used where it has a dictionary.

### 🎙️ Voice typing
- Click the 🎙 microphone in the toolbar, or press **Ctrl + Alt + V** (⌘ ⌥ V on Mac), and speak. Words appear at the cursor.
- **Languages:** speech follows the book's language: English (US, UK, India…), தமிழ் (India, Sri Lanka, Singapore, Malaysia), हिन्दी, മലയാളം, తెలుగు, ಕನ್ನಡ, বাংলা, मराठी, ગુજરાતી, ਪੰਜਾਬੀ, ଓଡ଼ିଆ, اردو and more. Right-click the microphone to change it.
- **Spoken punctuation in English:** say "comma", "full stop", "question mark", "new paragraph", "open quote" / "close quote". Sentences are capitalised for you.
- A floating bar shows that Booky is listening, with a live sound level and a Stop button.
- **Where it works:**
  - In Chrome, Edge and Safari it uses the browser's free speech service.
  - In the desktop app, add a Google Cloud key with the Speech-to-Text API enabled (Settings → Voice & translation).
  - Your computer's own dictation also types straight into Booky everywhere: **Windows + H**, or **Fn (🌐) twice** on a Mac.

### 🔤 Translate a book
Turn any book into a **new project in another language**. The original stays untouched.
1. Library card ⋯ → *Translate…* (or ⋮ → *Translate into another language…* inside a book). Pick the language and how to translate:
   - **Built-in browser translator** (free): private, translated on your computer (desktop Chrome / Edge). Keeps paragraphs and footnotes, but not bold or italic inside a paragraph. If it isn't available, Booky switches to MyMemory automatically.
   - **MyMemory** (free, no key): works everywhere, including the desktop app. About 5,000 characters a day, or 50,000 if you add your email in Settings → Voice & translation. Long books translate over a few days with *Continue translation*.
   - **Claude (Anthropic)**: literary-quality translation that keeps all formatting, footnotes and smart fields. You can give it notes, e.g. "keep character names in English, use informal நீ between friends". Needs your Anthropic API key.
   - **Google Cloud Translation** (API key) or a **LibreTranslate** server.
   - **Manual**: makes the project with the original beside every page, for you or a human translator.
2. The title, subtitle, description, chapter titles and every page are translated. Fonts, chapter words and layout switch to the new language. You can stop at any time and *Continue translation* later.
3. **Correct it** side by side:
   - The **Original** tab shows each page's original text, and a status: *needs check* or *reviewed*.
   - **Side by side** puts the original next to your editor. Click any original paragraph to translate just that paragraph again and insert it at the cursor.
   - **Retranslate page** saves a History snapshot first.
   - **Next page to review** and the binder markers (◐ not reviewed yet) make sure no page is missed.

**Contextual suggestions for any word or sentence.** Select text and press **Ctrl + Alt + T** (or the 文A button):
- **In any book:** translate the selection into any language. The whole paragraph is used as context, so "bank" by a river and "bank" for money come out differently. Pick the target language in the popup.
- **In a translation project:** get better wordings for part of the translation, based on the original paragraph. Each option fits the surrounding sentence.
- **In side by side:** click an original paragraph, or select words in it, for translations you can insert at the cursor.
- With Claude you get 3–5 options, best first, each with a note on its nuance (literal, idiomatic, formal, colloquial, poetic) and when to use it. One click replaces the selection. Other providers give one translation.
- Whole-book translation with Claude also reads the book's title, genre and summary, the chapter title, and the paragraph before each passage. This keeps names, tone and meaning consistent.

API keys are stored only on this computer (Settings → Voice & translation) and sent only to the service you pick. Claude translation uses the `claude-opus-5-5` model, with Anthropic's server-side fallback switched on so a declined passage is retried automatically.

### 🔎 Check (all offline)
- **Spelling**: built-in Hunspell English dictionary, with suggestions, a personal dictionary and ignore lists.
- **Grammar & punctuation**:
  - Repeated words, *a/an* and capitalization.
  - Spacing and punctuation errors.
  - Commonly confused words: could of, then/than, its/it's, your/you're, less/fewer and more.
  - Subject–verb agreement, verb forms and unbalanced quotes.
- **Style suggestions**:
  - Wordy phrases and redundancies.
  - Weak modifiers (with stronger words to use instead), clichés and passive voice.
  - Adverbs on dialogue tags, filter words ("she felt", "he saw") and very long sentences.
- **Sentence reframing** (Ctrl Alt R or right-click) offers alternatives: simpler, active voice, stronger words, more concise, split in two, reordered, lead with the image or the setting, casual/formal, and varied word choice.
- **Synonyms** from the right-click menu, a **readability score** with grade level, a most-used-words list, and **Proofread whole book** in the Publish tab.

### 🔬 Review (whole book)
- **Proofread**: every chapter checked for spelling, grammar, punctuation and style, with a proofreading score. Click any card to jump to that sentence in the editor. **Auto-fix safe issues** corrects unambiguous mistakes (double spaces, repeated words, a/an, "could of"…) and saves a snapshot first.
- **Readability**: a 0–100 readability score, Flesch reading ease, grade level, words per sentence, passive voice, adverbs, long sentences and dialogue share, with plain-language suggestions. Each chapter is scored separately.
- **Repetition**: similar or duplicate sentences anywhere in the book, repeated phrases, runs of sentences that start the same way, and echo words used twice within a few lines.
- **Originality (plagiarism check)**: compares your manuscript, 7+ words at a time, with famous passages and quotations, your other Booky projects, and any reference texts you add (paste or import .docx/.txt/.md/.html). It reports an originality percentage and every matching passage. This runs offline, so it cannot search the internet; a **Search online** button checks a suspicious passage on the web when you are connected.

### 🧹 Editing and consistency (Review screen)
- **Style sheet** — the record a copyeditor keeps for a book:
  - US, UK or Indian English spelling (this also changes spell-check, so *colour* and *realised* are accepted in UK and Indian books);
  - serial comma, dash style, quotation marks, ellipses, numbers, percentages and dates;
  - a word list of chosen spellings, capitalisation and hyphenation, which can be filled from the story bible.
  - Print it for your copyeditor. It also goes with review copies as a last page.
- **Consistency**: finds variant spellings in the same book (*colour/color*, *e-mail/email*, *judgement/judgment*), forms that differ from the word list or from the first use, numbers, dashes, quotes, ellipses and serial commas that break the style sheet, and **character-name near-misses** (*Meenatchi* for the story-bible name *Meenakshi*). Each finding offers *Show*, *Fix this*, *Fix all* (a snapshot is taken first) and *Add to style sheet*.
- **Typography**: one-click clean-up with a preview of every change:
  - curly quotes and apostrophes (’90s too), one-character ellipses, single spaces, and no space before punctuation (French books get thin spaces);
  - no-break spaces in “5 km”, “Dr. Rao”, “Chapter 12” and “page 4”.
  - The same tidying happens when you paste.
- **Clean paste from Word and Google Docs**: headings, quotes, bold, italic, underline, small caps and footnotes come through. Fonts, colours, sizes and stray spans are dropped. *Paste as plain text* is in the right-click menu (or Ctrl+Shift+V).
- **Hand formatting**: lists text whose font, size or colour was set by hand (which wouldn't follow your design), with *Clear*, *Clear all* or *Use a style…*.
- **Compare versions**: compare any snapshot or milestone with the current text, word by word, and *Restore this paragraph*.
- **Script check** for Indian languages and Urdu: finds text not in standard (NFC) form, stray zero-width joiners, Latin letters or digits inside words, letters from another script, doubled vowel signs, and — in Urdu — Arabic look-alike letters (ي ك ه instead of ی ک ہ), with *Fix all*.
- **Spelling for other languages**: Booky can't bundle Indian-language or Urdu dictionaries — the free ones are under licences (GPL, MPL) that don't fit Booky's. Import a Hunspell dictionary (.aff + .dic) in Settings → Proofing, and Booky checks spelling as you write.

### 💬 Feedback (private review copies)
Share your book with editors, beta readers or friends. Only the people you invite can read it, and they can comment but not change it.
1. **Invite**: Feedback → *Invite reviewer* → enter their name and email. Booky creates a **review copy** (one HTML file) that is **encrypted** and locked to that email address plus a passcode. You can set it to expire after 7, 14, 30 or 90 days.
2. **Share**: email the file as an attachment, *or* upload it to Google Drive / Dropbox / OneDrive and send the **link**. The invitation email is written for you. Send the passcode separately (text message, WhatsApp or a separate email). If the link is forwarded, nobody else can open it without the email + passcode.
3. **They review** in any browser, with no account or install:
   - Highlight in five colours, comment, ask a question, flag an error, suggest an edit ("replace with…") or leave praise, plus an overall star rating and review.
   - They **can't edit, copy, cut or print** your text, and every page is watermarked with their email.
   - Their notes are saved in their browser until they click **Send to author**.
4. **Collect**: they email you the small `.bookyreview` file. Drop it on the Feedback screen. Sending again later updates their notes; withdrawn notes disappear.
5. **Work through everything without missing a note**:
   - All reviewers' comments merge into one list **in reading order, grouped by chapter**. Each reviewer has their own colour, which you can change.
   - Filter by reviewer, type (comments, suggestions, questions, errors…), status (to do / done) or search, with a progress bar (e.g. 37 / 140 done).
   - **Start correcting** opens the first open comment in the editor with the text selected. The open comments are shown inline in each reviewer's colour.
   - From the **Comments** side panel: **Apply edit** (applies a suggested change in one click), **Done**, **Won't fix**, a private note to yourself, and **Next open comment**, which takes you straight to the next one anywhere in the book.
   - **Download checklist** gives a printable list of every comment.

**Online links (optional, free).** Instead of a file you can send a **link**:
- Click *Share online link* in the review-copy dialog.
- The reviewer opens the link and unlocks it with their email + passcode. There's no account or sign-in.
- When they click *Send to author*, the comments arrive on your Feedback screen. Booky checks for them automatically, or click **Check for new comments**.
- You can **withdraw** a link at any time.

Setup takes one step, described under [Online sharing setup](#online-sharing-setup-supabase-free-plan).

> Copy protection stops copying, cutting, printing and right-click in the review copy. Like any on-screen document, it can't prevent screenshots or someone retyping the text. The watermark discourages that.

### 🗂️ Plan
- **Corkboard**: chapter cards with synopsis and status. Drag a card to reorder chapters.
- **Outline**: a table of chapters with POV/label, synopsis, status, word count and target.
- **Story bible**: characters, places, objects, lore, research and timeline entries, each with a picture. One click adds all names to your dictionary.
- **Goals**: a book word goal, a daily goal, a deadline calculator, a 30-day chart, a streak counter and a 15-minute **writing sprint** timer.

### 🎨 Format (interior design)
- **Customisable templates**: when you create a book you can choose the theme, trim size, body and heading fonts, text size, line spacing, paragraph style, alignment, chapter-number style and drop caps, with a live sample. **Save any book's design as your own template** (Format → My templates). It appears on the home screen and in New book, and you can apply it to other projects.
- **Word count & statistics**: total words, printed pages, words per page, reading time, and each chapter's word count and starting page.
- **12 design themes**: Classic, Literary, Modern, Romance, Fantasy, Thriller, Mystery, Non-fiction, Memoir, Children's, Poetry and Academic. Every setting can be fine-tuned.
- **Trim sizes**: 18 presets (5×8, 5.5×8.5, 6×9, A5, A4, B-format, square, landscape…) plus custom sizes.
- **Margins**: mirrored margins with gutter guidance, optional bleed and crop marks.
- **Body text and spacing**: font, size, line spacing, letter spacing, word spacing, justified or left-aligned, hyphenation, first-line indent or block paragraphs, extra space between paragraphs, and widow/orphan control.
- **Fine typography**:
  - *Keep headings with the next paragraph* (on by default), so a subheading never ends a page.
  - *Hanging punctuation*: an opening quote at the start of a flush-left paragraph sits in the margin, so the letters line up.
  - *Numbers*: switch to lining figures (the height of capitals) in fonts that have them, such as Cormorant Garamond, Alegreya, Playfair Display and Sorts Mill Goudy. Booky tells you when your font has only one style.
  - *Hyphenated lines in a row* (at most 2 or 3). Browsers can't enforce this yet, so the Layout check reports pages that go over it.
- **Layout check** (Format → Layout check, and Publish → pre-flight) reads the typeset pages and lists, with buttons to show the page and edit the text:
  - widows and orphans that slipped through;
  - a heading or scene break left at the foot of a page;
  - chapters whose last page has fewer than 4 lines;
  - too many hyphenated lines in a row, and very loose justified lines;
  - unexpected blank pages, and how many blank pages right-hand chapter starts added.
- **Chapter headings**:
  - Number style (One / 1 / 01 / I / hidden), prefix, case, size and spacing.
  - Title font, size, weight, italic and case.
  - Ornaments, a heading image, the space above the heading (sink), and part pages.
- **Opening paragraphs**: drop caps (2–5 lines, separate font and colour) and small-caps lead-ins.
- **Scene breaks**: symbols, a custom glyph or your own image.
- **Running heads and page numbers**: author / title / chapter on verso and recto pages, positioned centred or on the outside edge. Page numbers have a style (12, — 12 —, Page 12, [ 12 ], · 12 ·), a starting number, font, size and colour. Front matter uses roman numerals and body numbering restarts. No running heads appear on opening or display pages.
- **Page flow**: chapters, parts and front matter can start on right-hand pages, and individual pages can be overridden.
- **Table of contents**: page numbers, dot leaders and depth.
- **Live paginated preview** (Paged.js) shown as spreads or single pages, with zoom and margin guides. For long books, the chapter you're working on appears in under a second while the whole book is typeset in the background. There is also an **ebook preview** on e-reader, phone and tablet frames with light, sepia and dark reading modes.

### 🖼️ Cover
- **9 cover templates**, gradient, colour or image backgrounds with overlay, and text layers you drag into place. Each layer has its own font, size, colour, alignment, caps, shadow, outline and spacing, and you can add logo or image layers.
- **Full print wrap**: back cover blurb, spine text, barcode area, and a **spine-width calculator** that uses page count and paper type (white, cream or colour). Bleed and safe-zone guides are shown.
- Exports: an **ebook cover** (1600 × 2560 JPG and other sizes) and a **print cover** as a PDF or 300-DPI PNG.

### 📦 Publish
- **Export PDF** (top bar, Format and Publish):
  - **Desktop app: Save vector PDF** — real, sharp text with embedded fonts, at your exact trim size, in one click.
  - **Vector PDF via the print dialog** (browser): the same quality, saved through the browser's print dialog.
  - **Image-based PDF (proof / fallback)**: one click, rendered at 150, 220 or 300 DPI. Good for proofs; text is softer. Not recommended for Tamil, Hindi and other complex scripts: with letter spacing, joined letters can come out broken.
  - Every PDF Booky makes or receives is finished for print: trim and bleed boxes are set, interior bleed is kept only on the outside, top and bottom edges (as printers require), title, author, keywords and language are written into the file, and the page count is made even.
- **Publish to a platform**: ready-to-upload ZIP packages that check each platform's requirements (trim sizes, page limits, margins, ISBN) and offer one-click fixes.
  - **Ebook stores**: Amazon Kindle (KDP), Apple Books, Kobo, Google Play Books, Barnes & Noble Press and Draft2Digital. Each package contains an EPUB, a cover JPG at the store's recommended size, and a metadata sheet (plus a DOCX for Draft2Digital).
  - **Print-on-demand**: KDP Paperback, KDP Hardcover, IngramSpark, Lulu and B&N Press print. Each package contains the interior PDF, a full cover PDF with the spine width calculated for that printer's paper, and a metadata sheet.
    - **Desktop app**: the interior is a vector PDF made automatically.
    - **Browser**: save the interior from the print dialog and drop it into the platform dialog. You can also choose the image-based PDF as a fallback.
    - **Interior PDF check**, run before anything goes into the package:
      - the page size matches your trim (with or without bleed);
      - the page count is within the platform's limits (and even);
      - every font is embedded;
      - no page is a single full-page image.
    - Booky makes **standard PDFs** (RGB colour, fonts embedded), not PDF/X-1a. KDP, Lulu and B&N accept them, and IngramSpark's file checker accepts them too.
- **EPUB 3** with cover, navigation, landmarks, metadata, series information and pop-up footnotes. Validated with EPUBCheck: 0 errors, 0 warnings.
  - **Accessibility metadata** (asked for by stores and libraries, and by the European Accessibility Act): access modes, features, hazards and a summary.
    - Booky only states conformance to *EPUB Accessibility 1.1 / WCAG 2.1 AA* when its checks pass: every image has alt text, there's a table of contents, the language is set, and headings are in order.
    - Headings are re-levelled automatically so they never skip a level.
  - **Print page numbers** (page-list): when the book has a print edition, the EPUB marks where each printed page starts, so readers and teachers can say "page 112". Switch it off in Format → Ebook.
    - A page that starts mid-paragraph is marked at the start of that paragraph.
- **Image checks** (pre-flight and platform dialogs). Click a finding to jump to the image:
  - **resolution** at the printed size (warns under 300 ppi, error under 150);
  - **colour images** on black-and-white paper;
  - **full-page images** without bleed;
  - **missing alt text**, with a *Fill in alt text* shortcut.
- **Full-page images**: set an image's width to *Full page* to give it a page of its own that runs to the edges (into the bleed when bleed is on).
- **Back-of-book index**: select a word, right-click and choose *Add to index…* (with optional sub-entry, *see* and *see also*).
  - *Index terms…* (right-click, or the Index page's side panel) lists every term with how often it's marked. From there you can rename or merge terms, delete them, or *Mark all* places a word appears in the book.
  - The Index page is generated automatically: A–Z letter groups, sub-entries indented, page numbers merged into ranges (e.g. *12–14, 20*). In the ebook, each entry links to the chapters it appears in.
- **Cross-references**: right-click → *Insert cross-reference…* to point to a chapter, heading or figure.
  - Print shows "see page 42"; the ebook shows a link.
  - Pre-flight lists any cross-reference whose target was deleted or renamed.
- **Sample / reader magnet**: an EPUB or PDF of the first chapters (you choose how many) with a closing page linking to where readers can buy the full book and join your newsletter. The sample has no ISBN, so you can give it away on your website, in your newsletter or on BookFunnel.
- **DOCX** with real Word styles, mirrored margins, footnotes and images, and Word index entries (use *Insert → Index* in Word).
- **HTML** (a single web page), **print-ready HTML**, **Markdown**, **plain text** and **.booky backups**.
- **Pre-flight check**: missing metadata, ISBNs, copyright page, contents, empty chapters, leftover sample text, page count, and gutter width for your page count.
- **ISBNs**: Book details checks every ISBN as you type.
  - It catches wrong check digits and turns an ISBN-10 into the ISBN-13 printers use.
  - It warns when two formats share one: each of paperback, hardcover and ebook needs its own.
- **Real ISBN barcode** on the back cover: a scannable EAN-13 with the ISBN printed above it.
  - It has an optional price add-on (e.g. 51499 for US$14.99, or 90000 for no price).
  - Bars are drawn on whole pixels at 300 DPI, with clear margins.
  - Or choose *Leave a white area* if your printer adds the barcode (KDP can).
- **Metadata sheet** in every package lists:
  - BISAC codes, series and edition, and contributors with their roles;
  - the reading age, and all ISBNs neatly formatted;
  - your keywords, with warnings when you go over KDP's 7 keywords or 50 characters.

### 📥 Import
Word (.docx), Markdown, plain text, HTML, RTF and Booky backups. Chapters are detected automatically from headings, from "Chapter …" lines or from a custom separator. *Prologue*, *Epilogue*, *Acknowledgments* and similar headings become the matching page types.

---

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Bold / Italic / Underline | Ctrl B / I / U |
| Small caps | Ctrl Shift K |
| Heading 1 / 2 / 3 · Body text | Ctrl Alt 1 / 2 / 3 · Ctrl Alt 0 |
| Align left / centre / right / justify | Ctrl Shift L / E / R / J |
| Scene break · Page break | Ctrl Alt 8 · Ctrl Enter |
| Rephrase sentence | Ctrl Alt R |
| Find & replace | Ctrl F |
| Focus mode | Ctrl Shift F |
| Toggle manuscript panel | Ctrl \ |
| Next / previous chapter | Alt ↓ / Alt ↑ |
| Phonetic typing on / off (Indian languages) | Ctrl Shift Space |
| Voice typing on / off | Ctrl Alt V |
| Translate / suggest wording for the selection | Ctrl Alt T |
| Save now | Ctrl S |

---

## Getting a print-ready PDF

1. Choose a theme and trim size in **Format**, and check the preview.
2. **Desktop app:** click **Export PDF → Save vector PDF**, or build a platform package (Publish → choose the printer). You're done.
3. **Browser:** open **Publish → choose the printer → Interior PDF → Open print dialog**.
   - In the dialog, set **Destination: Save as PDF**, **Margins: Default/None** and **Scale: 100%**, and tick **Background graphics**.
   - Drop the saved PDF into the same dialog. Booky checks it, fixes the page boxes and bleed, and adds it to the package.
4. Upload to KDP Print, IngramSpark, Lulu or your printer, and order a printed proof before you publish.

---

## Online sharing setup (Supabase, free plan)
You only need this for online review links. Everything else works offline. **No sign-in, no email settings and no payment are needed.**

1. **Run the setup SQL once.**
   - In Booky, go to Settings → Online sharing → **Copy setup SQL**.
   - In supabase.com, open your project → **SQL Editor** → New query, paste the SQL and click **Run**. Running it again is safe.
   - If your project is linked to this GitHub repository, the same SQL is in `supabase/migrations/` and may already have run.
2. **Check the connection.** Click **Save & test connection**. Your project (`ptoletclsllykfpzlyhi`) and its publishable key are already filled in.

How it stays private:
- The book and the comments are encrypted on your computer with the reviewer's email + passcode, so the database only holds scrambled data.
- Each copy also has two random secrets:
  - your **owner secret** stays in your Booky, to read comments and withdraw the link;
  - the **write secret** is hidden inside the encrypted copy, so only someone who unlocked it with the right email + passcode can send comments.
- The tables themselves are locked, and visitors can only call the `booky_*` functions, which check those secrets and the expiry dates.

**Staying free:**
- Supabase's free plan pauses a project after about a week without activity. The `Keep Supabase awake` workflow pings it every three days to stop that.
- If the project ever does pause, open supabase.com and click **Restore project** (free).
- Old expired copies are deleted automatically, and only each reviewer's latest few sends are kept, so storage stays tiny.

### What's free and what's optional
| Feature | Free option | Optional paid alternative |
| --- | --- | --- |
| Writing, formatting, PDF, EPUB, review files | Everything, offline | — |
| Online review links | Supabase free plan + GitHub Pages | — |
| Translation | Built-in Chrome/Edge translator (unlimited, on your computer). Otherwise **MyMemory**: no key; about 5,000 characters a day, or 50,000 with your email added in Settings | Claude, Google Cloud |
| Word/sentence suggestions | MyMemory alternatives + the whole sentence for context | Claude (3–5 options with explanations) |
| Voice typing | Chrome/Edge/Safari speech; Windows + H or Fn Fn (Mac) dictation, including in the desktop app | Google Cloud Speech-to-Text |
| Desktop apps & website | GitHub Releases + GitHub Pages (free for public repositories) | — |

## For developers

```bash
npm install
npm run dev        # development server
npm test           # unit tests (grammar, rephrasing, feedback, ISBN/barcode, PDF boxes, index, layout check, backups…)
npm run build      # → dist/Booky.html (single offline file)
npm run release    # build and copy to release/Booky.html
npm run desktop    # run the desktop app (Electron)
npm run dist:win   # Windows installer → release/desktop (run on Windows)
npm run dist:mac   # macOS .dmg → release/desktop (run on a Mac)
npm run icons      # re-render app icons from assets/logo.svg
npm run test:epub  # build EPUBs from tests/fixtures (and a sample edition) in a headless browser and run EPUBCheck (needs Java)
node scripts/perf-preview.mjs [words]   # time the Paged.js print preview on a generated 120,000-word novel
```

The app is plain JavaScript (no framework), built with Vite into a single self-contained HTML file.

The app's source entry is `app.html`. The repository root is published as is by GitHub Pages ("Deploy from a branch", root folder):
- `index.html` is the landing page;
- `release/Booky.html` is the app;
- `review.html` is the online review page.

`npm run release` refreshes the last two, so run it before pushing.

| Folder | What it does |
| --- | --- |
| `src/core` | Book model, page templates, themes, storage (IndexedDB), fonts, ISBN/barcodes, index, layout-check rules, backups, sample editions |
| `src/editor` | TipTap/ProseMirror extensions: paragraph styles, scene and page breaks, footnotes, live proofing, find |
| `src/lang` | Spell-check worker (nspell + Hunspell en), grammar and style rules, rephrasing, thesaurus, phonetic typing (`translit.js`), translation providers (`translate.js`) |
| `src/render` | Book → HTML, print/ebook CSS generator, Paged.js preview, canvas cover renderer |
| `src/export` | EPUB (with accessibility metadata and print page-list), DOCX, HTML, Markdown and text exporters; PDF finishing (`pdf-post.js`: page boxes, XMP) and checking (`pdf-check.js`) |
| `src/share` | Encrypted review copies (AES-GCM + PBKDF2), the reviewer's reading/commenting page, sharing transports |
| `src/import` | DOCX (Mammoth), Markdown, text, HTML and RTF import with chapter detection |
| `src/ui` | All screens: library, binder, editor, inspector, plan, format, cover, publish |
| `desktop` | Electron shell: window, menus, vector PDF, file opening, microphone permission |
| `build`, `assets` | App icons (`icon.png` → macOS .icns, `icon.ico` → Windows) and the logo source |

Sharing is built around a small transport interface (`src/share/transport.js`):
- **Files:** an encrypted review copy goes out and a `.bookyreview` comments file comes back.
- **Supabase:** `src/share/cloud.js` uses plain REST calls, with no SDK. It stores the same encrypted copy, and `review.html` (generated by `scripts/post-build.mjs`) posts encrypted comments back.
- The schema and row-level security rules are in `supabase/migrations/`.

When hosted over http(s), Booky also registers a service worker, so it can be installed as an app (PWA).

### Licences
Booky is MIT-licensed. It bundles open-source components:
- TipTap/ProseMirror (MIT)
- Paged.js (MIT)
- nspell (MIT) with the Hunspell English dictionary (MIT/BSD)
- Mammoth (BSD-2)
- JSZip (MIT)
- Lucide icons (ISC)
- Fonts under the SIL Open Font License
