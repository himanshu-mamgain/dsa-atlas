/**
 * Makes inputs of any size that look like a problem's example, so a solution
 * can be timed as n grows. The example decides the shape (an int array, a
 * string, a grid, a linked list, a tree…) and anything that looks like a
 * precondition (sorted, rotated). Each shape has a few variants (random, all
 * equal, a palindrome, balanced brackets…), because Big-O is about the worst
 * case and a random input often lets a solution stop early.
 */

import type { Arg } from "./examples";

export type ArgSpec =
  | { kind: "size"; name: string } // a number that is n itself (climbStairs(n))
  | { kind: "fixed"; name: string; value: unknown } // kept as in the example (target = 9, k = 2)
  | { kind: "ints"; name: string; order: "any" | "sorted" | "rotated"; min: number; max: number; float: boolean }
  | { kind: "string"; name: string; alphabet: string; brackets: boolean }
  | { kind: "words"; name: string; alphabet: string; length: number }
  | { kind: "grid"; name: string; cells: (string | number)[]; numeric: boolean; sortedRows: boolean; min: number; max: number }
  | { kind: "tuples"; name: string; width: number; intervals: boolean; min: number; max: number }
  | { kind: "list"; name: string; sorted: boolean; min: number; max: number }
  | { kind: "tree"; name: string; min: number; max: number };

export interface InputPlan {
  specs: ArgSpec[];
  /** What n means, in words: "length of nums". */
  n: string;
  /** Names of the variants tried for the worst case. */
  variants: string[];
  /** Largest n worth trying (memory). */
  maxN: number;
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const sortedAsc = (a: number[]) => a.every((x, i) => i === 0 || a[i - 1] <= x);
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const BRACKETS = "()[]{}";

function rotatedSorted(a: number[]) {
  if (a.length < 3 || sortedAsc(a)) return false;
  let drops = 0;
  for (let i = 1; i < a.length; i++) if (a[i] < a[i - 1]) drops++;
  return drops === 1 && a[a.length - 1] <= a[0];
}

function alphabetOf(text: string) {
  const chars = [...new Set(text)];
  if (chars.length && chars.every((c) => BRACKETS.includes(c))) return BRACKETS;
  if (chars.every((c) => /[a-z]/.test(c))) return LOWER;
  if (chars.every((c) => /[a-zA-Z]/.test(c))) return LOWER + LOWER.toUpperCase();
  if (chars.every((c) => /[0-9]/.test(c))) return "0123456789";
  // Mixed text ("A man, a plan…"): its own characters, plus letters for variety.
  return [...new Set(LOWER + text)].join("");
}

/** True when an array in level order has nulls, i.e. it's a tree written LeetCode's way. */
const looksLikeTree = (a: unknown[]) => a.includes(null) && a.every((x) => x === null || isNum(x));

/**
 * Works out how to make inputs for a function with these parameters, from one
 * example call. `code` lets it tell a linked list (`head.next`) or a tree
 * (`root.left`) from a plain array. Returns null when a parameter can't be made.
 */
export function planInputs(params: string[], example: Arg[], code = ""): InputPlan | null {
  if (example.length !== params.length) return null;
  const specs: ArgSpec[] = [];
  const sizedNames: string[] = [];
  let grid = false;
  let list = false;
  let tree = false;
  for (let i = 0; i < params.length; i++) {
    const name = params[i];
    const v = example[i].value;
    const uses = (prop: string) => new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\s*(\\?\\.|\\.)\\s*${prop}\\b`).test(code);
    if (Array.isArray(v) && (uses("next") || /^(head|l\d|list\d?|head[AB])$/i.test(name)) && v.every(isNum)) {
      const nums = v as number[];
      specs.push({ kind: "list", name, sorted: nums.length > 1 && sortedAsc(nums), ...range(nums, 0, 100) });
      sizedNames.push(name);
      list = true;
    } else if (Array.isArray(v) && (uses("left") || uses("right") || looksLikeTree(v) || /^(root\d?|tree)$/i.test(name)) && v.every((x) => x === null || isNum(x))) {
      specs.push({ kind: "tree", name, ...range(v.filter(isNum), 0, 100) });
      sizedNames.push(name);
      tree = true;
    } else if (Array.isArray(v) && v.length > 0 && v.every(Array.isArray)) {
      const rows = v as unknown[][];
      const widths = new Set(rows.map((r) => r.length));
      const flat = rows.flat();
      const numeric = flat.every(isNum);
      const width = rows[0].length;
      if (widths.size === 1 && width <= 3 && rows.length !== width && numeric) {
        const intervals = width === 2 && rows.every((r) => (r[0] as number) <= (r[1] as number));
        specs.push({ kind: "tuples", name, width, intervals, ...range(flat as number[], 0, 100) });
      } else if (flat.every((x) => isNum(x) || typeof x === "string")) {
        const sortedRows = numeric && sortedAsc(flat as number[]);
        specs.push({ kind: "grid", name, cells: [...new Set(flat as (string | number)[])], numeric, sortedRows, ...(numeric ? range(flat as number[], 0, 100) : { min: 0, max: 0 }) });
        grid = true;
      } else return null;
      sizedNames.push(name);
    } else if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      const words = v as string[];
      const avg = words.length ? Math.round(words.reduce((s, w) => s + w.length, 0) / words.length) : 3;
      // An array of one-character strings is really a string (["a","b","c"]).
      if (words.every((w) => w.length === 1) && words.length > 1) specs.push({ kind: "words", name, alphabet: alphabetOf(words.join("")), length: 1 });
      else specs.push({ kind: "words", name, alphabet: alphabetOf(words.join("") || "abc"), length: Math.max(1, avg) });
      sizedNames.push(name);
    } else if (Array.isArray(v) && v.every(isNum)) {
      const nums = v as number[];
      const order = nums.length > 1 && sortedAsc(nums) ? "sorted" : rotatedSorted(nums) ? "rotated" : "any";
      specs.push({ kind: "ints", name, order, float: !nums.every(isInt), ...range(nums, 0, 100) });
      sizedNames.push(name);
    } else if (typeof v === "string") {
      specs.push({ kind: "string", name, alphabet: alphabetOf(v || "abc"), brackets: v.length > 0 && [...v].every((c) => BRACKETS.includes(c)) });
      sizedNames.push(name);
    } else if (v === null || typeof v === "boolean" || isNum(v)) {
      specs.push({ kind: "fixed", name, value: v });
    } else return null;
  }
  // With nothing to grow, the first whole number is n (fib(n), climbStairs(n)).
  if (sizedNames.length === 0) {
    const i = specs.findIndex((s) => s.kind === "fixed" && isInt(s.value) && (s.value as number) >= 0);
    if (i < 0) return null;
    specs[i] = { kind: "size", name: specs[i].name };
    return { specs, n: `the value of ${specs[i].name}`, variants: ["as is"], maxN: 1 << 22 };
  }
  const what = grid ? "cells in" : list || tree ? "nodes in" : "length of";
  return {
    specs,
    n: `${what} ${sizedNames.join(" and ")}`,
    variants: variantNames(specs),
    maxN: tree ? 1 << 16 : list || grid ? 1 << 17 : 1 << 18,
  };
}

function range(nums: number[], lo: number, hi: number) {
  return nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : { min: lo, max: hi };
}

// ─── Variants ────────────────────────────────────────────────────────────────

const INT_ANY = ["random", "spread out", "ascending", "descending", "all equal"];
// A sorted example may be a precondition (binary search) or chance (Two Sum's
// [2,7,11,15]), so sorted variants come first and unsorted ones are tried too.
// Code written for sorted input still finishes on any input; counting only
// needs it to run, not to be right.
const INT_SORTED = ["ascending", "ascending with repeats", "all equal", "random", "spread out", "descending"];
const INT_ROTATED = ["rotated", "ascending", "random", "spread out"];
const STRING = ["random", "one letter", "palindrome", "cycling letters"];
const BRACKET = ["balanced", "random", "all opening"];
const TREE = ["balanced", "random", "skewed"];

function variantsFor(s: ArgSpec): string[] {
  switch (s.kind) {
    case "ints":
      return s.order === "sorted" ? INT_SORTED : s.order === "rotated" ? INT_ROTATED : INT_ANY;
    case "list":
      return s.sorted ? ["ascending", "all equal", "random"] : ["random", "ascending", "all equal"];
    case "string":
      return s.brackets ? BRACKET : STRING;
    case "words":
      return s.length === 1 ? STRING : ["random", "anagrams", "all equal"];
    case "grid":
      return s.sortedRows ? ["ascending"] : ["random", "all the same", "checkerboard"];
    case "tuples":
      return s.intervals ? ["random", "sorted", "disjoint", "nested"] : ["random", "all equal"];
    case "tree":
      return TREE;
    default:
      return [];
  }
}

/** One variant index applies to every argument; each takes it modulo its own count. */
function variantNames(specs: ArgSpec[]): string[] {
  const lists = specs.map(variantsFor).filter((l) => l.length);
  const count = Math.max(1, ...lists.map((l) => l.length));
  return Array.from({ length: count }, (_, i) => [...new Set(lists.map((l) => l[i % l.length]))].join(" + "));
}

// ─── Making values ───────────────────────────────────────────────────────────

/** A small fast seeded random generator (mulberry32), so runs can be repeated. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Builders {
  ListNode: new (val: number, next?: unknown) => { val: number; next: unknown };
  TreeNode: new (val: number, left?: unknown, right?: unknown) => { val: number; left: unknown; right: unknown };
}

/** Plain-object nodes, for tests and when a solution brings no node classes. */
export const plainBuilders: Builders = {
  ListNode: class {
    constructor(
      public val: number,
      public next: unknown = null,
    ) {}
  },
  TreeNode: class {
    constructor(
      public val: number,
      public left: unknown = null,
      public right: unknown = null,
    ) {}
  },
};

type Rand = () => number;
const int = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

function ints(s: Extract<ArgSpec, { kind: "ints" | "list" }>, n: number, variant: string, r: Rand): number[] {
  const nonNeg = s.min >= 0;
  // Small values repeat a lot; spread-out values hardly ever do.
  const small = { lo: nonNeg ? Math.max(0, s.min) : Math.min(s.min, -10), hi: Math.max(s.max, 10) };
  const wide = { lo: nonNeg ? 0 : -4 * n, hi: 4 * n + 10 };
  const pick = (b: { lo: number; hi: number }) => Array.from({ length: n }, () => int(r, b.lo, b.hi));
  const float = "float" in s && s.float;
  const out = (() => {
    switch (variant) {
      case "random":
        return pick(small);
      case "spread out":
        return pick(wide);
      case "ascending":
      case "rotated": {
        let x = s.min;
        const a = Array.from({ length: n }, () => (x += int(r, 1, 3)));
        if (variant === "rotated" && n > 1) {
          const k = int(r, 1, n - 1);
          return [...a.slice(k), ...a.slice(0, k)];
        }
        return a;
      }
      case "ascending with repeats":
        return pick(small).sort((x, y) => x - y);
      case "descending":
        return pick(wide).sort((x, y) => y - x);
      case "all equal":
        return new Array<number>(n).fill(s.max >= s.min ? s.max : 1);
      default:
        return pick(small);
    }
  })();
  return float ? out.map((x) => x + Math.round(r() * 100) / 100) : out;
}

function text(alphabet: string, n: number, variant: string, r: Rand): string {
  const ch = () => alphabet[Math.floor(r() * alphabet.length)];
  switch (variant) {
    case "one letter":
      return alphabet[0].repeat(n);
    case "palindrome": {
      const half = Array.from({ length: n >> 1 }, ch).join("");
      return half + (n % 2 ? ch() : "") + [...half].reverse().join("");
    }
    case "cycling letters":
      return Array.from({ length: n }, (_, i) => alphabet[i % alphabet.length]).join("");
    case "balanced": {
      // Nested and side by side, every bracket closed: the case that reads to the end.
      const pairs = ["()", "[]", "{}"];
      const open: string[] = [];
      let s = "";
      for (let i = 0; i < n - (n % 2); i++) {
        const left = n - (n % 2) - i;
        // Open only while there's room left to close everything.
        if (open.length < left - 1 && (open.length === 0 || r() < 0.5)) {
          const p = pairs[Math.floor(r() * 3)];
          open.push(p[1]);
          s += p[0];
        } else s += open.pop();
      }
      return s;
    }
    case "all opening":
      return "(".repeat(n);
    default:
      return Array.from({ length: n }, ch).join("");
  }
}

function buildList(values: number[], b: Builders) {
  let head: unknown = null;
  for (let i = values.length - 1; i >= 0; i--) head = new b.ListNode(values[i], head);
  return head;
}

function buildTree(n: number, variant: string, s: Extract<ArgSpec, { kind: "tree" }>, r: Rand, b: Builders) {
  const values = Array.from({ length: n }, (_, i) => s.min + i);
  if (n === 0) return null;
  if (variant === "skewed") {
    let root: unknown = null;
    for (let i = n - 1; i >= 0; i--) root = new b.TreeNode(values[i], null, root);
    return root;
  }
  if (variant === "balanced") {
    const build = (lo: number, hi: number): unknown => {
      if (lo > hi) return null;
      const mid = (lo + hi) >> 1;
      return new b.TreeNode(values[mid], build(lo, mid - 1), build(mid + 1, hi));
    };
    return build(0, n - 1);
  }
  // A random binary search tree: shuffled inserts, so depth stays near log n.
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  type T = { val: number; left: T | null; right: T | null };
  const root = new b.TreeNode(values[0]) as unknown as T;
  for (let i = 1; i < n; i++) {
    let node = root;
    for (;;) {
      const side = values[i] < node.val ? "left" : "right";
      if (node[side]) node = node[side]!;
      else {
        node[side] = new b.TreeNode(values[i]) as unknown as T;
        break;
      }
    }
  }
  return root;
}

function makeArg(s: ArgSpec, n: number, variantIndex: number, r: Rand, b: Builders): unknown {
  const vs = variantsFor(s);
  const v = vs.length ? vs[variantIndex % vs.length] : "";
  switch (s.kind) {
    case "size":
      return n;
    case "fixed":
      return s.value;
    case "ints":
      return ints(s, n, v, r);
    case "list":
      return buildList(ints(s, n, v, r), b);
    case "tree":
      return buildTree(n, v, s, r, b);
    case "string":
      return text(s.alphabet, n, v, r);
    case "words": {
      if (s.length === 1) return [...text(s.alphabet, n, v, r)];
      const base = text(LOWER, s.length, "random", r);
      return Array.from({ length: n }, () =>
        v === "all equal" ? base : v === "anagrams" ? [...base].sort(() => r() - 0.5).join("") : text(s.alphabet.replace(/[^a-z]/g, "") || LOWER, s.length, "random", r),
      );
    }
    case "grid": {
      const side = Math.max(1, Math.round(Math.sqrt(n)));
      if (s.numeric && s.sortedRows) {
        let x = s.min;
        return Array.from({ length: side }, () => Array.from({ length: side }, () => (x += int(r, 1, 3))));
      }
      const cells = s.numeric ? null : s.cells;
      const cell = (i: number, j: number) => {
        if (v === "all the same") return cells ? cells[0] : s.max;
        if (v === "checkerboard") return cells ? cells[(i + j) % cells.length] : (i + j) % 2 ? s.max : s.min;
        return cells ? cells[Math.floor(r() * cells.length)] : int(r, s.min, s.max);
      };
      return Array.from({ length: side }, (_, i) => Array.from({ length: side }, (_, j) => cell(i, j)));
    }
    case "tuples": {
      const span = Math.max(10, 4 * n);
      if (!s.intervals) {
        const row = () => Array.from({ length: s.width }, () => int(r, s.min, Math.max(s.max, s.min + 10)));
        const first = row();
        return Array.from({ length: n }, () => (v === "all equal" ? [...first] : row()));
      }
      if (v === "nested") return Array.from({ length: n }, (_, i) => [i, 2 * n - i]);
      if (v === "disjoint") return Array.from({ length: n }, (_, i) => [3 * i, 3 * i + 1]);
      const list = Array.from({ length: n }, () => {
        const a = int(r, 0, span);
        return [a, a + int(r, 0, 10)];
      });
      return v === "sorted" ? list.sort((x, y) => x[0] - y[0]) : list;
    }
  }
}

/** The arguments for one call at size n. The same seed gives the same input. */
export function makeInputs(plan: Pick<InputPlan, "specs">, n: number, variant: number, seed: number, builders: Builders = plainBuilders): unknown[] {
  const r = rng(seed);
  return plan.specs.map((s) => makeArg(s, n, variant, r, builders));
}

/** A cheap fingerprint of inputs, to see whether a call changed them (and so needs fresh copies). */
export function fingerprint(args: unknown[]): string {
  const seen = new Set<unknown>();
  const parts: string[] = [];
  const walk = (v: unknown, depth: number) => {
    if (parts.length > 2_000_000) return;
    if (v === null || typeof v !== "object") return void parts.push(String(v));
    if (seen.has(v)) return void parts.push("^");
    seen.add(v);
    if (Array.isArray(v)) {
      parts.push("[");
      for (const x of v) walk(x, depth + 1);
      parts.push("]");
      return;
    }
    // Nodes: walk iteratively along next/right so long chains don't overflow.
    let node = v as Record<string, unknown>;
    for (;;) {
      parts.push(`(${String(node.val)}`);
      if (node.left !== undefined && depth < 2000) walk(node.left, depth + 1);
      const next = (node.next ?? node.right) as Record<string, unknown> | null | undefined;
      if (!next || typeof next !== "object" || seen.has(next)) {
        parts.push(")");
        break;
      }
      seen.add(next);
      node = next;
    }
  };
  for (const a of args) walk(a, 0);
  return parts.join(",");
}
