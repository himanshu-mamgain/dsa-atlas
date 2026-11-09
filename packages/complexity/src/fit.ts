/**
 * Works out a time complexity from timings: given how long a solution took at
 * growing input sizes, which of O(1), O(log n), O(n), O(n log n), O(n²), O(n³),
 * O(2ⁿ) or O(n!) explains them best.
 *
 * Each class is fitted as  time = a + c·f(n)  (a is the fixed cost of a call),
 * weighted so every point counts by its relative error, not its size. The
 * simplest class that fits about as well as the best one wins, because a
 * bigger class with a free constant can always bend to fit a smaller one.
 */

import { parseBigO } from "./index";

export interface Timing {
  n: number;
  /** Milliseconds for one call. */
  ms: number;
}

export type ClassId = "1" | "log n" | "n" | "n log n" | "n^2" | "n^3" | "2^n" | "n!";

const log2 = (n: number) => Math.log2(Math.max(n, 2));
const factorial = (n: number) => {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
};

export const CLASSES: { id: ClassId; label: string; f: (n: number) => number }[] = [
  { id: "1", label: "O(1)", f: () => 1 },
  { id: "log n", label: "O(log n)", f: log2 },
  { id: "n", label: "O(n)", f: (n) => n },
  { id: "n log n", label: "O(n log n)", f: (n) => n * log2(n) },
  { id: "n^2", label: "O(n²)", f: (n) => n * n },
  { id: "n^3", label: "O(n³)", f: (n) => n ** 3 },
  { id: "2^n", label: "O(2ⁿ)", f: (n) => 2 ** n },
  { id: "n!", label: "O(n!)", f: factorial },
];

const ORDER = new Map(CLASSES.map((c, i) => [c.id, i]));
export const classLabel = (id: ClassId) => CLASSES[ORDER.get(id)!].label;
/** Position in the order O(1) < O(log n) < … < O(n!). */
export const classRank = (id: ClassId) => ORDER.get(id)!;

export interface ClassFit {
  id: ClassId;
  label: string;
  /** Root-mean-square relative error of the fit (0.1 = typically 10% off). */
  error: number;
  /** Fixed cost per call, in ms. */
  a: number;
  /** Cost per unit of f(n), in ms. */
  c: number;
}

export interface Fit {
  id: ClassId;
  label: string;
  error: number;
  a: number;
  c: number;
  /** Every class, best first. */
  scores: ClassFit[];
  /** How time grows when n doubles, from the largest inputs: 2 means it doubles too. */
  doubling: number;
  /** For O(2ⁿ) and worse: how much one more element multiplies the time by. */
  base?: number;
  confidence: "good" | "rough";
}

/** Weighted least squares for t = a + c·f, with 0 ≤ a ≤ the fastest time and c ≥ 0. */
function fitOne(points: Timing[], f: (n: number) => number): { a: number; c: number; error: number } {
  const fs = points.map((p) => f(p.n));
  if (fs.some((x) => !Number.isFinite(x))) return { a: 0, c: 0, error: Infinity };
  const w = points.map((p) => 1 / (p.ms * p.ms));
  let sw = 0,
    sf = 0,
    sff = 0,
    st = 0,
    sft = 0;
  points.forEach((p, i) => {
    sw += w[i];
    sf += w[i] * fs[i];
    sff += w[i] * fs[i] * fs[i];
    st += w[i] * p.ms;
    sft += w[i] * fs[i] * p.ms;
  });
  const minT = Math.min(...points.map((p) => p.ms));
  const constant = fs.every((x) => x === fs[0]);
  let a: number;
  let c: number;
  if (constant) {
    a = 0;
    c = st / sf;
  } else {
    const det = sw * sff - sf * sf;
    a = (st * sff - sf * sft) / det;
    c = (sw * sft - sf * st) / det;
    if (!(a >= 0) || !(c >= 0) || a > minT) {
      // Clamp the fixed cost and refit the slope.
      a = Math.min(Math.max(Number.isFinite(a) ? a : 0, 0), minT);
      let num = 0,
        den = 0;
      points.forEach((p, i) => {
        num += w[i] * fs[i] * (p.ms - a);
        den += w[i] * fs[i] * fs[i];
      });
      c = Math.max(num / den, 0);
    }
  }
  let sq = 0;
  points.forEach((p, i) => {
    const r = (p.ms - a - c * fs[i]) / p.ms;
    sq += r * r;
  });
  return { a, c, error: Math.sqrt(sq / points.length) };
}

/** Slope of log(time) against log(n) over the largest points, as a doubling factor. */
function doublingFactor(points: Timing[]) {
  const top = points.slice(-Math.max(3, Math.ceil(points.length / 2)));
  const xs = top.map((p) => Math.log2(p.n));
  const ys = top.map((p) => Math.log2(p.ms));
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let num = 0,
    den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  return den ? 2 ** (num / den) : 1;
}

/** Slope of ln(time) against n, as a per-element factor (for exponential growth). */
function perElementFactor(points: Timing[]) {
  const xs = points.map((p) => p.n);
  const ys = points.map((p) => Math.log(p.ms));
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let num = 0,
    den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  return den ? Math.exp(num / den) : 1;
}

/** Relative error of t = a + c·bⁿ for a fitted base b (exponentials rarely have base exactly 2). */
function fitExponential(points: Timing[]) {
  const b = perElementFactor(points);
  if (!(b > 1.05)) return null;
  const fit = fitOne(points, (n) => b ** n);
  return { b, ...fit };
}

/**
 * How much of a log n factor the data shows between its smallest and largest
 * n, once divided by `base`: about 1 for a true extra log n, about 0 for none.
 * Memory effects make O(n) work creep up a little as n grows; a real
 * O(n log n) grows by the whole log factor.
 */
function logShare(points: Timing[], base: (n: number) => number, a: number) {
  // Averages of the two smallest and two largest sizes, with the fixed cost taken off.
  const ends = [points.slice(0, 2), points.slice(-2)].map((ps) => ({
    work: ps.reduce((s, p) => s + Math.log(Math.max(p.ms - a, p.ms * 0.05) / base(p.n)), 0) / ps.length,
    log: ps.reduce((s, p) => s + Math.log(log2(p.n)), 0) / ps.length,
  }));
  const logGrew = ends[1].log - ends[0].log;
  return logGrew > 0 ? (ends[1].work - ends[0].work) / logGrew : 0;
}

export function fitComplexity(input: Timing[]): Fit | null {
  const all = input.filter((p) => p.n > 0 && p.ms > 0 && Number.isFinite(p.ms)).sort((x, y) => x.n - y.n);
  if (all.length < 3) return null;
  // Big-O is about large n: tiny inputs are mostly call overhead and JIT warm-up.
  const large = all.filter((p) => p.n >= 16);
  const points = large.length >= 5 ? large : all.slice(-Math.min(all.length, 5));
  const maxN = points[points.length - 1].n;
  const scores: ClassFit[] = CLASSES.map(({ id, label, f }) => {
    // Exponential classes only make sense on small inputs.
    if ((id === "2^n" && maxN > 200) || (id === "n!" && maxN > 40)) return { id, label, a: 0, c: 0, error: Infinity };
    return { id, label, ...fitOne(points, f) };
  });
  // An exponential with its own base, scored as O(2ⁿ).
  let base: number | undefined;
  if (maxN <= 200) {
    const exp = fitExponential(points);
    const two = scores.find((s) => s.id === "2^n")!;
    if (exp && exp.error < two.error) {
      two.error = exp.error;
      two.a = exp.a;
      two.c = exp.c;
      base = exp.b;
    }
  }
  const sorted = [...scores].sort((x, y) => x.error - y.error);
  const best = sorted[0];
  // The simplest class within reach of the best one.
  const within = best.error * 1.25 + 0.03;
  let pick = scores.find((s) => s.error <= within) ?? best;
  // n log n against n, and log n against 1: only the full log factor counts.
  const byId = (id: ClassId) => scores.find((s) => s.id === id)!;
  if (pick.id === "n log n" && logShare(points, (n) => n, pick.a) < 0.6) pick = byId("n");
  else if (pick.id === "log n" && logShare(points, () => 1, pick.a) < 0.5) pick = byId("1");
  const result: Fit = {
    id: pick.id,
    label: pick.label,
    error: pick.error,
    a: pick.a,
    c: pick.c,
    scores: sorted,
    doubling: doublingFactor(points),
    confidence: pick.error < 0.2 && points.length >= 5 ? "good" : "rough",
  };
  if (pick.id === "2^n" && base) result.base = base;
  return result;
}

/** The class a written Big-O ("O(n + m)", "O(n·log n)") belongs to, or null if it can't be read. */
export function classOf(bigO: string): ClassId | null {
  const g = parseBigO(bigO.replace(/\s*[—–-].*$/, ""));
  if (!g) return null;
  const small = /\b\d+\s*\^\s*n\b|n!|2ⁿ/i.test(bigO);
  const ns = small ? [4, 6, 8, 10, 12, 14, 16] : [16, 64, 256, 1024, 4096, 16384, 65536];
  const pts = ns.map((n) => ({ n, ms: Math.max(g(n), 1e-9) }));
  return fitComplexity(pts)?.id ?? null;
}

/** The fitted curve at n, for drawing. */
export function fittedAt(fit: Pick<Fit, "id" | "a" | "c" | "base">, n: number) {
  const f = fit.id === "2^n" && fit.base ? (x: number) => fit.base! ** x : CLASSES[ORDER.get(fit.id)!].f;
  return fit.a + fit.c * f(n);
}
