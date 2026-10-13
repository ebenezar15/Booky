// Paginated print preview: renders the book with Paged.js inside an isolated
// iframe. The same iframe is printed to produce the print-ready PDF.
import pagedPolyfill from '../../node_modules/pagedjs/dist/paged.polyfill.min.js?raw'; // relative path: the @paged alias loses ?raw in the dev server
import { renderSections } from './book.js';
import { typographyCss, printCss, ebookCss, previewChromeCss } from './css.js';
import { fontFaceCss, fontsUsedBy } from '../core/fonts.js';
import { isRtl } from '../core/languages.js';
import { escapeHtml } from '../core/model.js';

const safeScript = (code) => code.replace(/<\/script/gi, '<\\/script');

export function printDocument(book, { onlyId, token = '', interactive = true } = {}) {
  const sections = renderSections(book, 'print', { onlyId });
  const css = typographyCss(book, 'print') + printCss(book, sections);
  const body = sections.map((s) => s.html).join('\n');
  return {
    sections,
    html: `<!doctype html><html lang="${escapeHtml(book.meta.language || 'en')}" dir="${isRtl(book.meta.language) ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<title>${escapeHtml(book.meta.title)}</title>
<style data-pagedjs-ignore>${fontFaceCss(fontsUsedBy(book))}</style>
${interactive ? `<style data-pagedjs-ignore>${previewChromeCss()}</style>` : ''}
<style>${css}</style>
</head><body>
${body}
<script>
window.PagedConfig = {
  auto: true,
  after: function (flow) {
    // Folios: front matter in lower-case roman numerals, body restarting at 1.
    var roman = function (n) { var m = [[1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],[100,'c'],[90,'xc'],[50,'l'],[40,'xl'],[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']], r = ''; m.forEach(function (p) { while (n >= p[0]) { r += p[1]; n -= p[0]; } }); return r; };
    var pages = Array.prototype.slice.call(document.querySelectorAll('.pagedjs_page'));
    var start = ${book.format.pageNumbers.frontRoman ? "pages.findIndex(function (p) { return p.querySelector('[data-body-start]:not([data-split-from])'); })" : '-1'};
    pages.forEach(function (p, i) {
      var n = start > 0 && i < start ? roman(i + 1) : String((start > 0 ? i - start : i) + ${Math.max(0, +book.format.pageNumbers.startAt || 1)});
      var folio = ${JSON.stringify({ plain: '#', dashes: '— # —', page: 'Page #', brackets: '[ # ]', dots: '· # ·', pipe: '| #' }[book.format.pageNumbers.style] || '#')}.replace('#', n);
      p.style.setProperty('--bk-folio', JSON.stringify(folio));
      p.setAttribute('data-folio', folio);
      p.setAttribute('data-page-n', n);
    });
    // Index: replace each entry's page links with merged ranges ("12–14, 20").
    var rv = function (s) { var v = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }, t = 0; for (var k = 0; k < s.length; k++) { var a = v[s[k]], b = v[s[k + 1]] || 0; t += a < b ? -a : a; } return t; };
    var merge = function (list) {
      var seen = {}, items = [];
      list.forEach(function (p) { if (!p || seen[p]) return; seen[p] = 1; items.push({ p: p, k: /^\\d+$/.test(p) ? 1 : /^[ivxlcdm]+$/.test(p) ? 0 : 2, v: /^\\d+$/.test(p) ? +p : rv(p) }); });
      items.sort(function (a, b) { return a.k - b.k || a.v - b.v; });
      var out = [];
      for (var i = 0; i < items.length;) { var j = i; while (j + 1 < items.length && items[i].k < 2 && items[j + 1].k === items[i].k && items[j + 1].v === items[j].v + 1) j++; out.push(j > i ? items[i].p + '\u2013' + items[j].p : items[i].p); i = j + 1; }
      return out.join(', ');
    };
    Array.prototype.forEach.call(document.querySelectorAll('.bk-ix-refs'), function (span) {
      var nums = Array.prototype.map.call(span.querySelectorAll('a.bk-ix-ref'), function (a) {
        var t = document.getElementById(a.getAttribute('href').slice(1)) || document.querySelector('[data-id="' + a.getAttribute('href').slice(1) + '"]');
        var pg = t && t.closest('.pagedjs_page');
        return pg ? pg.getAttribute('data-page-n') : '';
      });
      span.textContent = merge(nums);
      span.classList.add('is-merged');
    });
    // Cross-references: "see page N" with the same folio numbers as the index.
    Array.prototype.forEach.call(document.querySelectorAll('a.bk-xref[href^="#"]'), function (a) {
      var t = document.getElementById(a.getAttribute('href').slice(1)) || document.querySelector('[data-id="' + a.getAttribute('href').slice(1) + '"]');
      var pg = t && t.closest('.pagedjs_page');
      if (!pg) return;
      a.textContent = a.textContent + pg.getAttribute('data-page-n');
      a.classList.add('is-resolved');
    });
    parent.postMessage({ type: 'booky-paged', token: ${JSON.stringify(token)}, pages: flow.total }, '*');
  }
};
window.addEventListener('error', function (e) { parent.postMessage({ type: 'booky-paged-error', token: ${JSON.stringify(token)}, message: String(e.message) }, '*'); });
</script>
<script>${safeScript(pagedPolyfill)}</script>
</body></html>`,
  };
}

export class PrintPreview {
  constructor(host) {
    this.host = host;
    this.iframe = null;
    this.zoom = 1;
    this.spread = true;
    this.guides = false;
    this.pages = 0;
  }

  render(book, opts = {}) {
    const token = Math.random().toString(36).slice(2);
    const { html, sections } = printDocument(book, { ...opts, token });
    this.sections = sections;
    const old = this.iframe;
    const iframe = document.createElement('iframe');
    iframe.className = 'preview-frame';
    iframe.setAttribute('title', 'Print preview');
    iframe.style.opacity = '0';
    this.host.appendChild(iframe);
    this.iframe = iframe;
    return new Promise((resolve, reject) => {
      const onMsg = (ev) => {
        if (!ev.data || ev.data.token !== token) return;
        if (ev.data.type === 'booky-paged') {
          window.removeEventListener('message', onMsg);
          this.pages = ev.data.pages;
          old?.remove();
          iframe.style.opacity = '1';
          this.applyView();
          resolve({ pages: ev.data.pages });
        } else if (ev.data.type === 'booky-paged-error') {
          console.warn('Preview error:', ev.data.message);
        }
      };
      window.addEventListener('message', onMsg);
      setTimeout(() => { window.removeEventListener('message', onMsg); old?.remove(); iframe.style.opacity = '1'; resolve({ pages: this.pages, timeout: true }); }, 120000);
      iframe.srcdoc = html;
    });
  }

  get doc() { return this.iframe?.contentDocument; }

  applyView() {
    const d = this.doc;
    if (!d?.body) return;
    d.body.classList.toggle('spread', this.spread);
    d.body.classList.toggle('guides', this.guides);
    const pages = d.querySelector('.pagedjs_pages');
    if (pages) {
      pages.style.zoom = String(this.zoom);
    }
  }

  setZoom(z) { this.zoom = Math.max(0.25, Math.min(2.5, z)); this.applyView(); }
  setSpread(v) { this.spread = v; this.applyView(); }
  setGuides(v) { this.guides = v; this.applyView(); }

  fitWidth() {
    const d = this.doc;
    const page = d?.querySelector('.pagedjs_page');
    if (!page) return;
    const w = page.getBoundingClientRect().width / this.zoom * (this.spread ? 2 : 1);
    this.setZoom((this.host.clientWidth - 60) / w);
  }

  goToElement(elId) {
    const d = this.doc;
    const target = d?.querySelector(`[data-el="${elId}"]`);
    const page = target?.closest('.pagedjs_page');
    if (page) {
      page.scrollIntoView({ block: 'start', behavior: 'smooth' });
      page.classList.add('bk-flash');
      setTimeout(() => page.classList.remove('bk-flash'), 1200);
    }
  }

  goToPage(n, flash = false) {
    const page = this.doc?.querySelectorAll('.pagedjs_page')[n - 1];
    page?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (page && flash) { page.classList.add('bk-flash'); setTimeout(() => page.classList.remove('bk-flash'), 1400); }
  }

  currentPage() {
    const d = this.doc;
    if (!d) return 1;
    const pages = [...d.querySelectorAll('.pagedjs_page')];
    const top = this.iframe.contentWindow.scrollY + 80;
    let n = 1;
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].offsetTop * this.zoom <= top) n = i + 1;
    }
    return n;
  }

  print() {
    const w = this.iframe?.contentWindow;
    if (!w) return;
    const prev = { spread: this.spread, zoom: this.zoom, guides: this.guides };
    this.spread = false; this.zoom = 1; this.guides = false;
    this.applyView();
    w.focus();
    w.print();
    Object.assign(this, prev);
    this.applyView();
  }
}

// Scrolling ebook preview (reflowable, like an e-reader).
export function ebookPreviewHtml(book, sections, { theme = 'light', fontScale = 1 } = {}) {
  const colors = { light: ['#ffffff', '#1d1d1f'], sepia: ['#f6edd9', '#3b2f1e'], dark: ['#151515', '#d9d6cf'] }[theme] || ['#fff', '#111'];
  return `<!doctype html><html lang="${escapeHtml(book.meta.language || 'en')}" dir="${isRtl(book.meta.language) ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<style>${fontFaceCss(fontsUsedBy(book))}</style>
<style>
${ebookCss(book)}
html { background: ${colors[0]}; color: ${colors[1]}; font-size: ${16 * fontScale}px; }
body { padding: 28px 26px 60px; }
.bk-sec { margin-bottom: 3em; padding-bottom: 2.5em; border-bottom: 1px dashed rgba(128,128,128,.35); }
img { max-width: 100%; }
::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: rgba(128,128,128,.4); border-radius: 3px; }
</style></head><body>${sections.map((s) => s.html).join('\n')}</body></html>`;
}
