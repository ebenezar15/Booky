// Recursive merge for plain settings objects (arrays are replaced, not merged).
export function deepMerge(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return b ?? a;
  if (typeof a !== 'object' || a === null) return b === undefined ? a : b;
  const out = { ...a };
  for (const k of Object.keys(b || {})) {
    out[k] = typeof a[k] === 'object' && a[k] !== null && !Array.isArray(a[k]) ? deepMerge(a[k], b[k]) : b[k];
  }
  return out;
}
