// Small DOM toolkit: element builder, icons, modals, menus, toasts and file helpers.
import { ICONS } from './icon-set.js';

const ALIASES = {
  'trash-2': 'trash', 'align-left': 'text-align-start', 'align-center': 'text-align-center', 'align-right': 'text-align-end',
  'align-justify': 'text-align-justify', history: 'clock-arrow-left', 'circle-help': 'circle-question-mark', 'indent-increase': 'list-indent-increase',
  books: 'book-copy', 'book-marked': 'book-heart', 'wrap-text': 'text-wrap',
};

export function icon(name, size = 18, cls = '') {
  const node = ICONS[name] || ICONS[ALIASES[name]] || ICONS.file;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `icon ${cls}`);
  const build = (parent, [tag, attrs, kids]) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    (kids || []).forEach((k) => build(el, k));
    parent.appendChild(el);
  };
  node.forEach((n) => build(svg, n));
  return svg;
}

/** h('div.cls#id', {attrs, on:{click}}, ...children) */
export function h(tag, props, ...children) {
  const m = tag.match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m?.[1] || 'div');
  (m?.[2]?.match(/[.#][\w-]+/g) || []).forEach((p) => (p[0] === '.' ? el.classList.add(p.slice(1)) : (el.id = p.slice(1))));
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'on') for (const [e, fn] of Object.entries(v)) el.addEventListener(e, fn);
      else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
      else if (k === 'class') el.className += ' ' + v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
      else if (k === 'value' || k === 'checked' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// Append children, skipping null/false (Element.append would print "null").
export function add(el, ...kids) { append(el, kids); return el; }

export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

export function btn(label, { icon: ic, onClick, cls = '', title, kind = '', size = 16, disabled } = {}) {
  return h(`button.btn${kind ? '.btn-' + kind : ''}${cls ? '.' + cls.split(' ').join('.') : ''}`, {
    type: 'button', title: title || (typeof label === 'string' ? label : ''), disabled, on: onClick ? { click: onClick } : null,
  }, ic ? icon(ic, size) : null, label ? h('span', label) : null);
}

export function iconBtn(ic, title, onClick, { cls = '', size = 18, active = false } = {}) {
  const b = h(`button.icon-btn${cls ? '.' + cls : ''}`, { type: 'button', title, 'aria-label': title, on: { click: onClick } }, icon(ic, size));
  if (active) b.classList.add('active');
  return b;
}

export function debounce(fn, ms = 300) {
  let t, pending = false;
  const d = (...a) => { clearTimeout(t); pending = true; t = setTimeout(() => { pending = false; fn(...a); }, ms); };
  // Runs a waiting call now; does nothing when no call is waiting (so it can't overwrite newer data with stale state).
  d.flush = (...a) => { clearTimeout(t); if (pending) { pending = false; fn(...a); } };
  return d;
}

// ---------- toasts ----------
let toastHost;
export function toast(msg, kind = 'info', ms = 2800) {
  if (!toastHost) { toastHost = h('div.toast-host', { role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastHost); }
  const ic = { info: 'info', success: 'circle-check', error: 'triangle-alert', warn: 'triangle-alert' }[kind] || 'info';
  const t = h(`div.toast.toast-${kind}`, icon(ic, 16), h('span', msg));
  toastHost.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

// ---------- celebration ----------
/** A short confetti burst from a point (or the centre of an element) for finished milestones. */
export function celebrate(from) {
  if (document.documentElement.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = from instanceof Element ? from.getBoundingClientRect() : null;
  const x = r ? r.left + r.width / 2 : from?.x ?? innerWidth / 2, y = r ? r.top + r.height / 2 : from?.y ?? innerHeight / 3;
  const colors = ['#7c3aed', '#a855f7', '#d946ef', '#fbbf24', '#34d399', '#60a5fa'];
  for (let i = 0; i < 36; i++) {
    const p = h('i.confetti', { style: { left: `${x}px`, top: `${y}px`, background: colors[i % colors.length] } });
    document.body.appendChild(p);
    const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 170;
    p.animate([
      { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d - 60}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 1, offset: 0.7 },
      { transform: `translate(${Math.cos(a) * d * 1.1}px, ${Math.sin(a) * d + 80}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => p.remove();
  }
}

// ---------- modals ----------
export function modal({ title, body, footer, width = 560, onClose, cls = '' }) {
  // the same dialog asked for twice (a double click, a shortcut pressed twice) is shown once
  const open = [...document.querySelectorAll('.modal-overlay')].find((o) => o.dataset.title === title && !o.classList.contains('closing'));
  if (open?._handle) { open._handle.box.querySelector('input, textarea, select, button')?.focus(); return open._handle; }
  let closed = false;
  const close = () => { if (closed) return; closed = true; overlay.classList.add('closing'); overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 180); document.removeEventListener('keydown', onKey); onClose?.(); };
  // Escape closes only the dialog on top, and leaves it alone while a menu is open over it
  const onKey = (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('.menu')) return;
    const top = [...document.querySelectorAll('.modal-overlay:not(.closing)')].pop();
    if (top === overlay) { e.preventDefault(); close(); }
  };
  const box = h(`div.modal${cls ? '.' + cls : ''}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': title, style: { width: `min(${width}px, calc(100vw - 32px))` } },
    h('header.modal-head', h('h2', title), iconBtn('x', 'Close', close)),
    h('div.modal-body', body),
    footer ? h('footer.modal-foot', footer) : null,
  );
  const overlay = h('div.modal-overlay', { dataset: { title }, on: { mousedown: (e) => { if (e.target === overlay) close(); } } }, box);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => overlay.classList.add('show'));
  setTimeout(() => box.querySelector('input, textarea, select, button.btn-primary')?.focus(), 50);
  overlay._handle = { close, box, overlay };
  return overlay._handle;
}

export function confirmDialog(title, message, { okLabel = 'OK', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title, width: 440,
      body: h('p.muted', message),
      footer: [
        btn('Cancel', { onClick: () => { done = true; m.close(); resolve(false); } }),
        btn(okLabel, { kind: danger ? 'danger' : 'primary', onClick: () => { done = true; m.close(); resolve(true); } }),
      ],
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

export function promptDialog(title, label, value = '', { multiline = false, okLabel = 'OK', placeholder = '' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const input = multiline ? h('textarea.input', { rows: 5, placeholder }, value) : h('input.input', { value, placeholder });
    const ok = () => { done = true; m.close(); resolve(input.value); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !multiline) ok(); });
    const m = modal({
      title, width: 460,
      body: h('label.field', h('span', label), input),
      footer: [btn('Cancel', { onClick: () => { done = true; m.close(); resolve(null); } }), btn(okLabel, { kind: 'primary', onClick: ok })],
      onClose: () => { if (!done) resolve(null); },
    });
    setTimeout(() => { input.focus(); input.select?.(); }, 60);
  });
}

// ---------- menus / popovers ----------
let openMenu = null;
export function closeMenu() { openMenu?.remove(); openMenu = null; }
document.addEventListener('mousedown', (e) => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openMenu) { closeMenu(); e.preventDefault(); } });

/** items: [{label, icon, onClick, danger, checked, sub:[], divider:true, hint}] */
export function menu(anchorOrPoint, items, { align = 'left', cls = '' } = {}) {
  closeMenu();
  const m = h(`div.menu${cls ? '.' + cls : ''}`, { role: 'menu' });
  const build = (list, host) => {
    for (const it of list) {
      if (!it) continue;
      if (it.divider) { host.appendChild(h('div.menu-sep')); continue; }
      if (it.header) { host.appendChild(h('div.menu-header', it.header)); continue; }
      if (it.custom) { host.appendChild(it.custom); continue; }
      const row = h(`button.menu-item${it.danger ? '.danger' : ''}${it.disabled ? '.disabled' : ''}`, {
        type: 'button', role: 'menuitem', disabled: it.disabled,
        on: { click: (e) => { e.stopPropagation(); if (it.sub) return; closeMenu(); it.onClick?.(); } },
      },
      it.checked != null ? h('span.menu-check', it.checked ? icon('check', 14) : null) : it.icon ? icon(it.icon, 15) : h('span.menu-check'),
      h('span.menu-label', it.label),
      it.hint ? h('span.menu-hint', it.hint) : null,
      it.sub ? icon('chevron-right', 14) : null);
      if (it.style) row.querySelector('.menu-label').setAttribute('style', it.style);
      if (it.sub) {
        const sub = h('div.menu.submenu');
        build(it.sub, sub);
        row.appendChild(sub);
        row.classList.add('has-sub');
      }
      host.appendChild(row);
    }
  };
  build(items, m);
  document.body.appendChild(m);
  let x, y;
  if (anchorOrPoint instanceof Element) {
    const r = anchorOrPoint.getBoundingClientRect();
    x = align === 'right' ? r.right - m.offsetWidth : r.left;
    y = r.bottom + 4;
  } else ({ x, y } = anchorOrPoint);
  const mw = m.offsetWidth, mh = m.offsetHeight;
  x = Math.max(8, Math.min(x, innerWidth - mw - 8));
  if (y + mh > innerHeight - 8) y = Math.max(8, (anchorOrPoint instanceof Element ? anchorOrPoint.getBoundingClientRect().top - mh - 4 : y - mh));
  m.style.left = x + 'px';
  m.style.top = y + 'px';
  openMenu = m;
  return m;
}

export function popover(anchorRect, content, { cls = '' } = {}) {
  closeMenu();
  const p = h(`div.menu.popover${cls ? '.' + cls : ''}`, content);
  document.body.appendChild(p);
  let x = anchorRect.left, y = anchorRect.bottom + 6;
  x = Math.max(8, Math.min(x, innerWidth - p.offsetWidth - 8));
  if (y + p.offsetHeight > innerHeight - 8) y = anchorRect.top - p.offsetHeight - 6;
  p.style.left = x + 'px';
  p.style.top = Math.max(8, y) + 'px';
  openMenu = p;
  return p;
}

// ---------- form controls ----------
export function field(label, control, hint) {
  return h('label.field', h('span.field-label', label), control, hint ? h('small.hint', hint) : null);
}

export function select(options, value, onChange, attrs = {}) {
  const s = h('select.input', { ...attrs, on: { change: () => onChange(s.value) } },
    options.map((o) => {
      const [v, l, style, disabled] = Array.isArray(o) ? o : typeof o === 'object' ? [o.value ?? o.id, o.label, o.style, o.disabled] : [o, o];
      return h('option', { value: v, selected: String(v) === String(value), style, disabled }, l);
    }));
  return s;
}

export function input(value, onInput, attrs = {}) {
  const i = h('input.input', { value: value ?? '', ...attrs });
  i.addEventListener('input', () => onInput(attrs.type === 'number' ? (i.value === '' ? '' : +i.value) : i.value));
  return i;
}

export function textarea(value, onInput, attrs = {}) {
  const t = h('textarea.input', { rows: 4, ...attrs }, value ?? '');
  t.addEventListener('input', () => onInput(t.value));
  return t;
}

export function toggle(checked, onChange, label) {
  const i = h('input', { type: 'checkbox', checked: !!checked, on: { change: () => onChange(i.checked) } });
  return h('label.toggle', i, h('span.toggle-track', h('span.toggle-thumb')), label ? h('span.toggle-label', label) : null);
}

export function slider(value, min, max, step, onInput, fmt = (v) => v) {
  const out = h('output.slider-val', fmt(value));
  const r = h('input.range', { type: 'range', min, max, step, value });
  r.addEventListener('input', () => { out.textContent = fmt(+r.value); onInput(+r.value); });
  return h('div.slider', r, out);
}

export function color(value, onInput) {
  const c = h('input.color', { type: 'color', value: value || '#000000' });
  c.addEventListener('input', () => onInput(c.value));
  return c;
}

export function segmented(options, value, onChange) {
  const wrap = h('div.segmented', { role: 'radiogroup' });
  for (const o of options) {
    const [v, label, ic] = Array.isArray(o) ? o : [o.value, o.label, o.icon];
    const b = h('button', { type: 'button', role: 'radio', title: typeof label === 'string' ? label : '', 'aria-checked': String(v === value), class: v === value ? 'on' : '' },
      ic ? icon(ic, 15) : null, !ic ? label : null);
    b.addEventListener('click', () => {
      wrap.querySelectorAll('button').forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('on');
      b.setAttribute('aria-checked', 'true');
      onChange(v);
    });
    wrap.appendChild(b);
  }
  return wrap;
}

// ---------- files ----------
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function pickFile(accept, { multiple = false } = {}) {
  return new Promise((resolve) => {
    const i = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    i.addEventListener('change', () => { resolve(multiple ? [...i.files] : i.files[0] || null); i.remove(); });
    document.body.appendChild(i);
    i.click();
  });
}

export const readAsDataURL = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
export const readAsText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });
export const readAsArrayBuffer = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(file); });

export async function compressImage(file, maxDim = 2400, quality = 0.88) {
  const url = await readAsDataURL(file);
  if (/svg|gif/.test(file.type)) return url;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  if (scale === 1 && file.size < 900000) return url;
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
}

export function slugify(s) {
  return (s || 'book').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'book';
}

export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(ts).toLocaleDateString();
}
