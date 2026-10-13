// Sample / "reader magnet" edition: the first N chapters plus a call-to-action page. Pure, unit-tested;
// the result is an ordinary book object, so the normal EPUB and PDF exporters build it.
import { createElement, orderedElements, escapeHtml } from './model.js';

export const SAMPLE_DEFAULTS = { chapters: 3, buyUrl: '', newsletterUrl: '', message: '' };

const safeUrl = (u) => (/^(https?:\/\/|mailto:)/i.test(String(u || '').trim()) ? String(u).trim() : '');
const STORY = new Set(['chapter']);

/** Which elements go into the sample (in book order). */
export function sampleElements(book, chapters) {
  const want = Math.max(1, +chapters || 1);
  const out = [];
  let count = 0;
  for (const el of orderedElements(book)) {
    if (el.section === 'front') { if (el.type !== 'list-figures' && el.type !== 'also-by') out.push(el); continue; }
    if (el.section === 'body') {
      if (count >= want) continue;
      if (STORY.has(el.type)) count++;
      out.push(el);
      continue;
    }
    if (el.type === 'about-author') out.push(el); // keep the author bio; drop the rest of the back matter
  }
  // a Part page with none of its chapters in the sample is dropped
  return out.filter((el, i) => el.type !== 'part' || (out[i + 1] && out[i + 1].section === 'body' && out[i + 1].type !== 'part'));
}

/** The call-to-action page's HTML. */
export function ctaHtml(book, opts) {
  const buy = safeUrl(opts.buyUrl), news = safeUrl(opts.newsletterUrl);
  const msg = String(opts.message || '').trim() || `Thank you for reading this sample of ${book.meta.title || 'the book'}. The story continues in the full book.`;
  return [
    ...msg.split(/\n{2,}/).map((p) => `<p class="ps-centered">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`),
    buy ? `<p class="ps-centered"><strong><a href="${escapeHtml(buy)}">Get the full book</a></strong></p>` : '',
    news ? `<p class="ps-centered"><a href="${escapeHtml(news)}">Join the newsletter</a> for news of the next book.</p>` : '',
  ].filter(Boolean).join('');
}

/**
 * A sample edition of `book`.
 * opts: { chapters, buyUrl, newsletterUrl, message }
 */
export function sampleBook(book, opts = {}) {
  const o = { ...SAMPLE_DEFAULTS, ...opts };
  const els = sampleElements(book, o.chapters).map((e) => structuredClone(e));
  const cta = createElement('newsletter', { title: 'Enjoyed the sample?', content: ctaHtml(book, o) });
  cta.id = 'el_sample_cta';
  const backStart = els.findIndex((e) => e.section === 'back');
  els.splice(backStart < 0 ? els.length : backStart, 0, cta);
  const sample = structuredClone({ ...book, elements: [] });
  sample.id = `${book.id}-sample`;
  sample.elements = els;
  // a sample is its own (free) edition: no ISBNs, no print page numbers
  sample.meta = { ...sample.meta, isbnEbook: '', isbnPrint: '', isbnHardcover: '', subtitle: sample.meta.subtitle ? `${sample.meta.subtitle} (sample)` : 'Free sample' };
  sample.format = { ...sample.format, ebook: { ...sample.format.ebook, pageList: false } };
  sample.reviews = { reviewers: [], comments: [], overall: [], rounds: [] };
  return sample;
}
