/**
 * Turns Big-O strings like "O(n log n)" or "O(n^2 + m)" into growth functions
 * for the graph. Unknown terms return null so the UI can say so.
 */

export type Growth = (n: number) => number;

const log2 = (x: number) => (x <= 1 ? 0 : Math.log2(x));

/** Parses "O(...)" into a function of n. Other variables (m, k, V, E) are treated as n. */
export function parseBigO(input: string): Growth | null {
  const m = input.trim().match(/^O\s*\((.+)\)$/i);
  if (!m) return null;
  const expr = normalize(m[1]);
  const terms = expr.split("+").map((t) => t.trim()).filter(Boolean);
  if (!terms.length) return null;
  const fns = terms.map(parseTerm);
  if (fns.some((f) => f === null)) return null;
  return (n) => (fns as Growth[]).reduce((sum, f) => sum + f(n), 0);
}

function normalize(s: string) {
  return s
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\*\*/g, "^")
    .replace(/√\s*n/gi, "sqrt(n)")
    .replace(/\b(m|k|v|e|h|w|l)\b/gi, "n")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** A term is a product of factors: 1, n, n^k, log n, log^k n, sqrt(n), 2^n, n!. */
function parseTerm(term: string): Growth | null {
  // Collapse multi-word factors into single tokens before splitting.
  const t = term
    .replace(/\b(?:log|lg)\s*\^\s*(\d)\s*\(?\s*n\s*\)?/g, " L$1 ")
    .replace(/\b(?:log|lg)\s*\(?\s*n\s*\)?/g, " L1 ")
    .replace(/sqrt\s*\(?\s*n\s*\)?/g, " S ");
  const factors = t.split(/[\s*·×]+/).filter(Boolean);
  const fns: Growth[] = [];
  for (const f of factors) {
    const fn = parseFactor(f);
    if (!fn) return null;
    fns.push(fn);
  }
  return fns.length ? (n) => fns.reduce((p, f) => p * f(n), 1) : null;
}

function parseFactor(f: string): Growth | null {
  if (/^\d+$/.test(f)) return () => 1; // constants don't change growth
  if (f === "n") return (n) => n;
  if (f === "n!") return factorial;
  if (f === "S") return (n) => Math.sqrt(n);
  let m = f.match(/^L(\d)$/);
  if (m) {
    const k = Number(m[1]);
    return (n) => log2(n) ** k;
  }
  m = f.match(/^n\^(\d+(?:\.\d+)?)$/);
  if (m) {
    const k = Number(m[1]);
    return (n) => n ** k;
  }
  m = f.match(/^(\d+)\^n$/);
  if (m) {
    const b = Number(m[1]);
    return (n) => b ** n;
  }
  return null;
}

function factorial(n: number) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Ordering of common classes, for sorting and colouring. */
export function rank(input: string): number {
  const g = parseBigO(input);
  if (!g) return Infinity;
  return g(1000);
}

export interface CurvePoint {
  n: number;
  [series: string]: number;
}

/**
 * Samples several Big-O expressions over n = 1..maxN into one dataset.
 * Values above `cap` are clipped to keep slow curves on screen.
 */
export function sampleCurves(series: Record<string, string>, maxN = 50, steps = 50, cap = 10_000): CurvePoint[] {
  const parsed = Object.entries(series).map(([k, v]) => [k, parseBigO(v)] as const);
  const points: CurvePoint[] = [];
  // Whole-number n only, without repeats (repeats draw as steps).
  const ns = new Set<number>();
  for (let i = 1; i <= steps; i++) ns.add(Math.max(1, Math.round((i / steps) * maxN)));
  for (const n of ns) {
    const p: CurvePoint = { n };
    for (const [k, g] of parsed) if (g) p[k] = Math.min(g(n), cap);
    points.push(p);
  }
  return points;
}
