# Booky — write, format and publish books offline

Booky is a book-writing studio that runs entirely on your computer. You can draft a manuscript, organise chapters, check spelling and grammar, design a print-ready interior, make a cover, and export **print-ready PDF**, **EPUB**, **DOCX** and more. It never needs an internet connection.

It takes ideas from Atticus, Reedsy Studio, Scrivener and InDesign and puts them in one simple tool.

---

## Quick start (no installation)

1. Download **[`release/Booky.html`](release/Booky.html)**.
2. Double-click it to open it in **Chrome, Edge or Brave**. Firefox and Safari also work, but print output is best in Chromium browsers.
3. Click **New book**, pick a template and start writing.

The app is that one file. Fonts, the English dictionary and every library are built in, so it keeps working offline. Your books are saved automatically inside the browser's private storage.

> **Back up your work.** Browser storage is tied to that browser on that computer. Use **Publish → Project backup** (or ⋮ → *Download backup*) now and then, and keep the `.booky` file somewhere safe. You can open it on any computer with **Open backup** on the home screen.

---

## Features

### 🗃️ Projects & appearance
- Keep any number of book projects. Search them, sort by recent / newest / title / length, and duplicate, back up or delete them.
- Colour schemes:
  - **Cadenza violet** (the same deep-violet look as Mindapp and Practise-app) is the default.
  - Other presets: Orchid, Indigo, Ocean, Emerald, Rose, Notes orange and Graphite, or pick **your own colours**.
  - Light, sepia or dark mode.
  - A deep-colour or light sidebar.
  - Change them from the 🎨 button.

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

### 🔤 Translate a book
Turn any book into a **new project in another language**. The original stays untouched.
1. Library card ⋯ → *Translate…* (or ⋮ → *Translate into another language…* inside a book). Pick the language and how to translate:
   - **Built-in browser translator**: free and private, translated on your computer (desktop Chrome / Edge). Keeps paragraphs and footnotes, but not bold or italic inside a paragraph.
   - **Claude (Anthropic)**: literary-quality translation that keeps all formatting, footnotes and smart fields. You can give it notes, e.g. "keep character names in English, use informal நீ between friends". Needs your Anthropic API key.
   - **Google Cloud Translation** (API key) or a **LibreTranslate** server.
   - **Manual**: makes the project with the original beside every page, for you or a human translator.
2. The title, subtitle, description, chapter titles and every page are translated. Fonts, chapter words and layout switch to the new language. You can stop at any time and *Continue translation* later.
3. **Correct it** side by side:
   - The **Original** tab shows each page's original text, and a status: *needs check* or *reviewed*.
   - **Side by side** puts the original next to your editor. Click any original paragraph to translate just that paragraph again and insert it at the cursor.
   - **Retranslate page** saves a History snapshot first.
   - **Next page to review** and the binder markers (◐ not reviewed yet) make sure no page is missed.

API keys are stored only in this browser (Settings → Translation) and sent only to the service you pick. Claude translation uses the `claude-opus-5-5` model, with Anthropic's server-side fallback switched on so a declined passage is retried automatically.

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

**Online links (optional, with your Supabase project).** Instead of a file you can send a **link**:
- Click *Share online link* in the review-copy dialog.
- The reviewer opens the link and signs in with the invited email. They get a one-time code by email, then enter the passcode.
- When they click *Send to author*, the comments arrive on your Feedback screen. Booky checks for them automatically, or click **Check for new comments**.
- You can **withdraw** a link at any time.
- Everything is encrypted on your computer first, so Supabase only stores scrambled data.

Setup is described under [Online sharing setup](#online-sharing-setup-supabase).

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
- **Chapter headings**:
  - Number style (One / 1 / 01 / I / hidden), prefix, case, size and spacing.
  - Title font, size, weight, italic and case.
  - Ornaments, a heading image, the space above the heading (sink), and part pages.
- **Opening paragraphs**: drop caps (2–5 lines, separate font and colour) and small-caps lead-ins.
- **Scene breaks**: symbols, a custom glyph or your own image.
- **Running heads and page numbers**: author / title / chapter on verso and recto pages, positioned centred or on the outside edge. Page numbers have a style (12, — 12 —, Page 12, [ 12 ], · 12 ·), a starting number, font, size and colour. Front matter uses roman numerals and body numbering restarts. No running heads appear on opening or display pages.
- **Page flow**: chapters, parts and front matter can start on right-hand pages, and individual pages can be overridden.
- **Table of contents**: page numbers, dot leaders and depth.
- **Live paginated preview** (Paged.js) shown as spreads or single pages, with zoom and margin guides. There is also an **ebook preview** on e-reader, phone and tablet frames with light, sepia and dark reading modes.

### 🖼️ Cover
- **9 cover templates**, gradient, colour or image backgrounds with overlay, and text layers you drag into place. Each layer has its own font, size, colour, alignment, caps, shadow, outline and spacing, and you can add logo or image layers.
- **Full print wrap**: back cover blurb, spine text, barcode area, and a **spine-width calculator** that uses page count and paper type (white, cream or colour). Bleed and safe-zone guides are shown.
- Exports: an **ebook cover** (1600 × 2560 JPG and other sizes) and a **print cover** as a PDF or 300-DPI PNG.

### 📦 Publish
- **Export PDF** (top bar, Format and Publish):
  - **Download PDF file**: one click, rendered at 150, 220 or 300 DPI and sized exactly to your trim.
  - **Vector PDF via the print dialog**: the sharpest text.
- **Publish to a platform**: ready-to-upload ZIP packages that check each platform's requirements (trim sizes, page limits, margins, ISBN) and offer one-click fixes.
  - **Ebook stores**: Amazon Kindle (KDP), Apple Books, Kobo, Google Play Books, Barnes & Noble Press and Draft2Digital. Each package contains an EPUB, a cover JPG at the store's recommended size, and a metadata sheet (plus a DOCX for Draft2Digital).
  - **Print-on-demand**: KDP Paperback, KDP Hardcover, IngramSpark, Lulu and B&N Press print. Each package contains a 300-DPI interior PDF, a full cover PDF with the spine width calculated for that printer's paper, and a metadata sheet.
- **EPUB 3** with cover, navigation, landmarks, metadata, series information and pop-up footnotes. Validated with EPUBCheck: 0 errors, 0 warnings.
- **DOCX** with real Word styles, mirrored margins, footnotes and images.
- **HTML** (a single web page), **print-ready HTML**, **Markdown**, **plain text** and **.booky backups**.
- **Pre-flight check**: missing metadata, ISBNs, copyright page, contents, empty chapters, leftover sample text, page count, and gutter width for your page count.

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
| Save now | Ctrl S |

---

## Getting a print-ready PDF

1. Choose a theme and trim size in **Format**, and check the preview.
2. Go to **Publish → Print-ready PDF → Create PDF → Open print dialog**.
3. In the dialog set **Destination: Save as PDF**, **Margins: Default/None**, **Scale: 100%**, and tick **Background graphics**.
4. Upload the PDF to KDP Print, IngramSpark, Lulu or your printer. The page size already matches your trim size and the fonts are embedded.

---

## Online sharing setup (Supabase)
You only need this for online review links. Everything else works offline.

1. **Database.**
   - If your Supabase project is connected to this GitHub repository, the migration in `supabase/migrations/` creates the tables and security rules automatically when it reaches the project's production branch. In Supabase → Project Settings → Integrations → GitHub, set the production branch to the branch you deploy (or merge into it).
   - Otherwise, run it by hand: Booky → Settings → Online sharing → *Copy setup SQL*, then paste it into Supabase → SQL Editor and run it.
2. **Sign-in emails.**
   - In Supabase → Authentication → Emails → *Magic Link* template, add `{{ .Token }}` so emails contain a 6-digit code.
   - Supabase's built-in email sender only delivers to your project's team members, and only a few emails an hour. For real reviewers, add **custom SMTP** under Authentication → Emails → SMTP Settings (e.g. Resend, Brevo, SendGrid or Gmail).
3. **Review page.**
   - The workflow `.github/workflows/pages.yml` publishes the app and `review.html` to GitHub Pages. Turn it on once under repository Settings → Pages → Source: **GitHub Actions**.
   - The review page will then be at `https://ebenezar15.github.io/Booky/review.html`. Add this address under Supabase → Authentication → URL Configuration → *Redirect URLs*.
4. **Connect Booky.** In Settings → Online sharing:
   - Paste the **Project URL** and the **anon / publishable key** (Project Settings → API). Never use the service-role or secret key.
   - Click *Save & test connection*, then sign in with your email.

Security: row-level security lets an author see only their own copies and comments. A reviewer can only open the copy shared with their signed-in email, and only until it expires or is withdrawn. Anonymous visitors can read nothing.

## For developers

```bash
npm install
npm run dev        # development server
npm test           # unit tests (grammar, rephrasing, readability, feedback, phonetic typing, translation)
npm run build      # → dist/Booky.html (single offline file)
npm run release    # build and copy to release/Booky.html
```

The app is plain JavaScript (no framework), built with Vite into a single self-contained HTML file.

| Folder | What it does |
| --- | --- |
| `src/core` | Book model, page templates, themes, storage (IndexedDB), fonts |
| `src/editor` | TipTap/ProseMirror extensions: paragraph styles, scene and page breaks, footnotes, live proofing, find |
| `src/lang` | Spell-check worker (nspell + Hunspell en), grammar and style rules, rephrasing, thesaurus, phonetic typing (`translit.js`), translation providers (`translate.js`) |
| `src/render` | Book → HTML, print/ebook CSS generator, Paged.js preview, canvas cover renderer |
| `src/export` | EPUB, DOCX, HTML, Markdown and text exporters |
| `src/share` | Encrypted review copies (AES-GCM + PBKDF2), the reviewer's reading/commenting page, sharing transports |
| `src/import` | DOCX (Mammoth), Markdown, text, HTML and RTF import with chapter detection |
| `src/ui` | All screens: library, binder, editor, inspector, plan, format, cover, publish |

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
