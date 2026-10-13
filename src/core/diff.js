// Word-level text comparison (Myers' algorithm), for comparing a chapter with a milestone. Pure, unit-tested.

const tokenize = (s) => String(s).match(/\s+|[^\s]+/g) || [];

/** Shortest edit script between token arrays: [{ op: '=' | '-' | '+', text }], neighbouring ops merged. */
export function diffTokens(a, b, maxD = 4000) {
  const n = a.length, m = b.length;
  // trim the common start and end (cheap and the common case)
  let s = 0;
  while (s < n && s < m && a[s] === b[s]) s++;
  let e = 0;
  while (e < n - s && e < m - s && a[n - 1 - e] === b[m - 1 - e]) e++;
  const A = a.slice(s, n - e), B = b.slice(s, m - e);
  const mid = myers(A, B, maxD) || [...A.map((t) => ['-', t]), ...B.map((t) => ['+', t])];
  const ops = [...a.slice(0, s).map((t) => ['=', t]), ...mid, ...a.slice(n - e).map((t) => ['=', t])];
  const out = [];
  for (const [op, t] of ops) {
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += t; else out.push({ op, text: t });
  }
  return out;
}

function myers(a, b, maxD) {
  const n = a.length, m = b.length, max = n + m;
  if (!n) return b.map((t) => ['+', t]);
  if (!m) return a.map((t) => ['-', t]);
  const off = max + 1;
  let v = new Int32Array(2 * max + 3);
  const trace = [];
  for (let d = 0; d <= Math.min(max, maxD); d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) return backtrack(trace, a, b, off, d);
    }
  }
  return null; // too different: caller shows "removed everything / added everything"
}

function backtrack(trace, a, b, off, dEnd) {
  const ops = [];
  let x = a.length, y = b.length;
  for (let d = dEnd; d > 0; d--) {
    const v = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? k + 1 : k - 1;
    const prevX = v[off + prevK], prevY = prevX - prevK;
    while (x > prevX && y > prevY) { ops.push(['=', a[--x]]); y--; }
    if (x === prevX) ops.push(['+', b[--y]]); else ops.push(['-', a[--x]]);
  }
  while (x > 0 && y > 0) { ops.push(['=', a[--x]]); y--; }
  return ops.reverse();
}

/** Compare two texts word by word. */
export const diffWords = (a, b) => diffTokens(tokenize(a), tokenize(b));

/** Words added and removed: { added, removed }. */
export function diffStats(parts) {
  const words = (t) => (t.match(/[^\s]+/g) || []).length;
  return parts.reduce((s, p) => (p.op === '+' ? { ...s, added: s.added + words(p.text) } : p.op === '-' ? { ...s, removed: s.removed + words(p.text) } : s), { added: 0, removed: 0 });
}
