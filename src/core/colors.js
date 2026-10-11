// App colour schemes. "Cadenza" violet matches the author's other apps (Mindapp, Practise-app).
export const COLOR_SCHEMES = {
  cadenza: { label: 'Cadenza violet', primary: '#7c3aed', accent: '#d946ef', deep: '#1f0b44', deep2: '#12052a' },
  orchid: { label: 'Orchid', primary: '#a855f7', accent: '#f472b6', deep: '#2e1065', deep2: '#170531' },
  indigo: { label: 'Indigo ink', primary: '#4f46e5', accent: '#8b5cf6', deep: '#1e1b4b', deep2: '#0f0d2e' },
  ocean: { label: 'Ocean', primary: '#2563eb', accent: '#06b6d4', deep: '#0c1e45', deep2: '#06122b' },
  emerald: { label: 'Emerald', primary: '#059669', accent: '#84cc16', deep: '#052e25', deep2: '#021a15' },
  rose: { label: 'Rose', primary: '#e11d48', accent: '#fb923c', deep: '#3f0a1c', deep2: '#24040f' },
  sunset: { label: 'Notes orange', primary: '#ff6719', accent: '#f5a524', deep: '#3a1606', deep2: '#210b02' },
  graphite: { label: 'Graphite', primary: '#334155', accent: '#64748b', deep: '#1e293b', deep2: '#0f172a' },
};

// Darken a hex colour for custom schemes' sidebar.
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function schemeColors(app) {
  if (app.colorScheme === 'custom' && /^#[0-9a-f]{6}$/i.test(app.customPrimary || '')) {
    const p = app.customPrimary;
    const a = /^#[0-9a-f]{6}$/i.test(app.customAccent || '') ? app.customAccent : p;
    return { primary: p, accent: a, deep: shade(p, 0.22), deep2: shade(p, 0.12) };
  }
  return COLOR_SCHEMES[app.colorScheme] || COLOR_SCHEMES.cadenza;
}

export function applyColors(app) {
  const c = schemeColors(app);
  const r = document.documentElement.style;
  r.setProperty('--primary-base', c.primary);
  r.setProperty('--accent-base', c.accent);
  r.setProperty('--deep-base', c.deep);
  r.setProperty('--deep-base-2', c.deep2);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.primary);
}
