/**
 * Checking a solution against a problem's examples: turning example values into
 * call arguments (arrays into linked lists or trees where the code expects them),
 * turning results back into plain values, and comparing them with the expected
 * output the way a judge would (Yes/No as booleans, any order where order can't
 * matter to the problem, a little float tolerance).
 */
import { parseValue } from "./examples";
import { plainBuilders, type ArgSpec, type Builders } from "./inputs";

export type ArgShape = "list" | "tree" | null;

/** Which arguments are linked lists or trees, from the input plan's specs. */
export const shapesOf = (specs: ArgSpec[] | undefined, count: number): ArgShape[] =>
  Array.from({ length: count }, (_, i) => {
    const k = specs?.[i]?.kind;
    return k === "list" || k === "tree" ? k : null;
  });

function listFrom(values: unknown[], b: Builders): unknown {
  let head: unknown = null;
  for (let i = values.length - 1; i >= 0; i--) head = new b.ListNode(values[i] as number, head);
  return head;
}

/** LeetCode's level-order array ([3,9,20,null,null,15,7]) as a tree. */
function treeFrom(values: unknown[], b: Builders): unknown {
  if (!values.length || values[0] === null) return null;
  type Node = { val: number; left: unknown; right: unknown };
  const root = new b.TreeNode(values[0] as number) as Node;
  const queue: Node[] = [root];
  let i = 1;
  while (queue.length && i < values.length) {
    const node = queue.shift()!;
    for (const side of ["left", "right"] as const) {
      if (i >= values.length) break;
      const v = values[i++];
      if (v !== null && v !== undefined) {
        const child = new b.TreeNode(v as number) as Node;
        node[side] = child;
        queue.push(child);
      }
    }
  }
  return root;
}

/** A fresh copy of the example's values as call arguments. */
export function argsFor(values: unknown[], shapes: ArgShape[], b: Builders = plainBuilders): unknown[] {
  return values.map((v, i) => {
    const copy = structuredClone(v);
    if (shapes[i] === "list" && Array.isArray(copy)) return listFrom(copy, b);
    if (shapes[i] === "tree" && Array.isArray(copy)) return treeFrom(copy, b);
    return copy;
  });
}

const isNode = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && "val" in x;

/** A result as a plain value: linked lists and trees back to arrays. */
export function toPlain(x: unknown, seen = new Set<unknown>()): unknown {
  if (isNode(x) && ("next" in x || "left" in x || "right" in x)) {
    if ("next" in x) {
      const out: unknown[] = [];
      let cur: unknown = x;
      // A cycle would loop forever; stop after a generous length.
      while (isNode(cur) && out.length < 10_000) {
        out.push(cur.val);
        cur = cur.next;
      }
      return out;
    }
    const out: unknown[] = [];
    const queue: unknown[] = [x];
    while (queue.length && out.length < 10_000) {
      const n = queue.shift();
      if (isNode(n)) {
        out.push(n.val);
        queue.push(n.left ?? null, n.right ?? null);
      } else out.push(null);
    }
    while (out.length && out[out.length - 1] === null) out.pop();
    return out;
  }
  if (Array.isArray(x)) {
    if (seen.has(x)) return "[circular]";
    seen.add(x);
    return x.map((v) => toPlain(v, seen));
  }
  if (x instanceof Set) return toPlain([...x], seen);
  if (x instanceof Map) return toPlain(Object.fromEntries(x), seen);
  if (typeof x === "object" && x !== null) {
    if (seen.has(x)) return "[circular]";
    seen.add(x);
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, toPlain(v, seen)]));
  }
  return x;
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b));

function equal(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return close(a, b);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equal(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => equal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return a === b;
}

/** Arrays compared as bags, nested ones too ([[1,2],[3]] matches [[3],[2,1]]). */
const canonical = (x: unknown): string => (Array.isArray(x) ? `[${x.map(canonical).sort().join(",")}]` : JSON.stringify(x));

export type Verdict = { pass: true; anyOrder?: boolean } | { pass: false };

/** Compares a plain result with the example's expected output text. */
export function judge(got: unknown, expectedText: string): Verdict {
  const expected = parseValue(expectedText);
  if (typeof got === "boolean" && typeof expected === "string") {
    if (/^(yes|true)$/i.test(expected)) return { pass: got };
    if (/^(no|false)$/i.test(expected)) return { pass: !got };
  }
  if (equal(got, expected)) return { pass: true };
  if (typeof got === "string" && typeof expected !== "string" && equal(parseValue(got), expected)) return { pass: true };
  if (Array.isArray(got) && Array.isArray(expected) && canonical(got) === canonical(expected)) return { pass: true, anyOrder: true };
  return { pass: false };
}

/** A result as short text for the results panel. */
export function show(x: unknown): string {
  if (x === undefined) return "undefined";
  const s = typeof x === "string" ? JSON.stringify(x) : JSON.stringify(x);
  return s === undefined ? String(x) : s.length > 400 ? `${s.slice(0, 400)}…` : s;
}
