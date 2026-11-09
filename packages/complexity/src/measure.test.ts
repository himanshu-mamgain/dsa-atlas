import { describe, expect, it } from "vitest";
import { classOf, fitComplexity, fittedAt, type ClassId } from "./fit";
import { extractExamples, parseArgs } from "./examples";
import { fingerprint, makeInputs, planInputs, rng } from "./inputs";
import { findEntries, pickEntry } from "./entry";

const sizes = (from: number, to: number) => {
  const out: number[] = [];
  for (let n = from; n <= to; n *= 2) out.push(n);
  return out;
};

/** Timings shaped like a real run: a fixed cost per call, the work, and ±10% noise. */
function timings(f: (n: number) => number, ns: number[], seed = 1, noise = 0.1) {
  const r = rng(seed);
  return ns.map((n) => ({ n, ms: (0.00005 + f(n) * 1e-6) * (1 + (r() * 2 - 1) * noise) }));
}

describe("fitComplexity", () => {
  const cases: [ClassId, (n: number) => number, number[]][] = [
    ["1", () => 3, sizes(4, 262144)],
    ["log n", (n) => 40 * Math.log2(n), sizes(4, 262144)],
    ["n", (n) => n, sizes(4, 262144)],
    ["n log n", (n) => n * Math.log2(n), sizes(4, 262144)],
    ["n^2", (n) => n * n, sizes(4, 8192)],
    ["n^3", (n) => n ** 3, sizes(4, 512)],
    ["2^n", (n) => 1.618 ** n, [8, 12, 16, 20, 24, 28, 32, 36]],
  ];
  for (const [want, f, ns] of cases) {
    it.each([1, 2, 3, 4, 5])(`finds O(${want}) (seed %i)`, (seed) => {
      expect(fitComplexity(timings(f, ns, seed))?.id).toBe(want);
    });
  }

  it("reports the base of an exponential", () => {
    const fit = fitComplexity(timings((n) => 1.618 ** n, [10, 14, 18, 22, 26, 30], 7, 0.02))!;
    expect(fit.base).toBeCloseTo(1.618, 1);
    expect(fittedAt(fit, 30) / fittedAt(fit, 29)).toBeCloseTo(1.618, 1);
  });

  it("says how time grows when n doubles", () => {
    expect(fitComplexity(timings((n) => n * n, sizes(64, 8192), 1, 0.02))!.doubling).toBeCloseTo(4, 0);
  });

  it("needs a few points", () => {
    expect(fitComplexity([{ n: 1, ms: 1 }])).toBeNull();
  });
});

describe("classOf", () => {
  it.each([
    ["O(1)", "1"],
    ["O(log n)", "log n"],
    ["O(n)", "n"],
    ["O(n + m)", "n"],
    ["O(n log n)", "n log n"],
    ["O(n^2)", "n^2"],
    ["O(n²)", "n^2"],
    ["O(2^n)", "2^n"],
    ["O(n) — one pass", "n"],
  ])("%s is %s", (bigO, want) => {
    expect(classOf(bigO)).toBe(want);
  });
});

describe("extractExamples", () => {
  it("reads named arguments", () => {
    const [ex] = extractExamples("Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: nums[0] + nums[1] == 9");
    expect(ex.args).toEqual([
      { name: "nums", value: [2, 7, 11, 15] },
      { name: "target", value: 9 },
    ]);
    expect(ex.output).toBe("[0,1]");
  });

  it("reads a bare word and several examples", () => {
    const exs = extractExamples("Input : malayalam\nOutput : Yes\nReverse of malayalam is also\nmalayalam.\n\nInput : max\nOutput : No");
    expect(exs.map((e) => e.args[0].value)).toEqual(["malayalam", "max"]);
    expect(exs.map((e) => e.output)).toEqual(["Yes", "No"]);
  });

  it("reads grids across lines and Python spellings", () => {
    const [ex] = extractExamples('Input: grid = [\n  ["1","1","0"],\n  ["0","1","0"]\n]\nOutput: 1');
    expect(ex.args[0].value).toEqual([
      ["1", "1", "0"],
      ["0", "1", "0"],
    ]);
    expect(parseArgs("root = [3,9,20,None,None,15,7]")[0].value).toEqual([3, 9, 20, null, null, 15, 7]);
    expect(parseArgs('s = "a,b", k = 2')).toEqual([
      { name: "s", value: "a,b" },
      { name: "k", value: 2 },
    ]);
  });
});

describe("planInputs and makeInputs", () => {
  it("grows arrays and keeps scalars", () => {
    const plan = planInputs(["nums", "target"], parseArgs("nums = [2,7,11,15], target = 9"))!;
    expect(plan.n).toBe("length of nums");
    const [nums, target] = makeInputs(plan, 100, 0, 1) as [number[], number];
    expect(nums).toHaveLength(100);
    expect(target).toBe(9);
    expect(plan.variants).toContain("all equal");
  });

  it("tries sorted input first when the example is sorted", () => {
    const plan = planInputs(["nums", "target"], parseArgs("nums = [-1,0,3,5,9,12], target = 9"))!;
    expect(plan.variants.slice(0, 3)).toEqual(["ascending", "ascending with repeats", "all equal"]);
    expect(plan.variants).toContain("random");
    for (let v = 0; v < 3; v++) {
      const [nums] = makeInputs(plan, 500, v, 3) as [number[]];
      expect(nums.every((x, i) => i === 0 || nums[i - 1] <= x)).toBe(true);
    }
  });

  it("rotates rotated input", () => {
    const plan = planInputs(["nums", "target"], parseArgs("nums = [4,5,6,7,0,1,2], target = 0"))!;
    const [nums] = makeInputs(plan, 50, 0, 3) as [number[]];
    const drops = nums.filter((x, i) => i > 0 && nums[i - 1] > x).length;
    expect(drops).toBe(1);
  });

  it("makes strings, palindromes and balanced brackets", () => {
    const plan = planInputs(["s"], parseArgs("malayalam"))!;
    const pal = plan.variants.indexOf("palindrome");
    const [s] = makeInputs(plan, 101, pal, 5) as [string];
    expect(s).toHaveLength(101);
    expect([...s].reverse().join("")).toBe(s);

    const brackets = planInputs(["s"], parseArgs('s = "()[]{}"'))!;
    const [b] = makeInputs(brackets, 200, 0, 9) as [string];
    const stack: string[] = [];
    const close: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    for (const c of b) {
      if (close[c]) expect(stack.pop()).toBe(close[c]);
      else stack.push(c);
    }
    expect(stack).toHaveLength(0);
    expect(b).toHaveLength(200);
  });

  it("builds linked lists and trees when the code uses them", () => {
    const list = planInputs(["head"], parseArgs("head = [1,2,3,4,5]"), "while (current !== null) current = current.next")!;
    expect(list.specs[0].kind).toBe("list");
    let node = makeInputs(list, 30, 0, 1)[0] as { next: unknown } | null;
    let count = 0;
    while (node) {
      count++;
      node = node.next as typeof node;
    }
    expect(count).toBe(30);

    const tree = planInputs(["root"], parseArgs("root = [3,9,20,null,null,15,7]"), "return 1 + Math.max(depth(root.left), depth(root.right))")!;
    expect(tree.specs[0].kind).toBe("tree");
    const size = (t: { left: unknown; right: unknown } | null): number => (t ? 1 + size(t.left as typeof t) + size(t.right as typeof t) : 0);
    for (let v = 0; v < 3; v++) expect(size(makeInputs(tree, 255, v, 1)[0] as never)).toBe(255);
  });

  it("makes grids and intervals", () => {
    const grid = planInputs(["grid"], parseArgs('grid = [["1","1","0"],["0","1","0"],["1","0","1"]]'))!;
    expect(grid.n).toBe("cells in grid");
    const [g] = makeInputs(grid, 100, 0, 1) as [string[][]];
    expect(g).toHaveLength(10);
    expect(g.flat().every((c) => c === "1" || c === "0")).toBe(true);

    const iv = planInputs(["intervals"], parseArgs("intervals = [[1,3],[2,6],[8,10],[15,18]]"))!;
    expect(iv.specs[0].kind).toBe("tuples");
    const [list] = makeInputs(iv, 40, 1, 1) as [number[][]];
    expect(list).toHaveLength(40);
    expect(list.every(([a, b]) => a <= b)).toBe(true);
  });

  it("treats a lone number as n", () => {
    const plan = planInputs(["n"], parseArgs("n = 3"))!;
    expect(plan.specs[0].kind).toBe("size");
    expect(makeInputs(plan, 42, 0, 1)).toEqual([42]);
  });

  it("gives up on what it can't make", () => {
    expect(planInputs(["a", "b"], parseArgs("x = 1"))).toBeNull();
    expect(planInputs(["ops"], parseArgs('ops = [{"a":1}]'))).toBeNull();
  });

  it("same seed, same input; fingerprints change when inputs do", () => {
    const plan = planInputs(["nums"], parseArgs("nums = [3,1,2]"))!;
    const a = makeInputs(plan, 64, 0, 7);
    expect(makeInputs(plan, 64, 0, 7)).toEqual(a);
    const before = fingerprint(a);
    (a[0] as number[]).sort((x, y) => x - y);
    expect(fingerprint(a)).not.toBe(before);
  });
});

describe("findEntries", () => {
  it("skips helpers the entry calls", () => {
    const code = `// Time: O(n)
function isPalindromeHelper(s, start, end) {
  if (start >= end) return true;
  return (s.charAt(start) === s.charAt(end)) && isPalindromeHelper(s, start + 1, end - 1);
}

function isPalindrome(s) {
  return isPalindromeHelper(s, 0, s.length - 1);
}`;
    expect(findEntries(code).map((e) => e.name)).toEqual(["isPalindrome"]);
    expect(pickEntry(code, 1)).toEqual({ name: "isPalindrome", params: ["s"] });
  });

  it("reads arrow functions, defaults and class Solution", () => {
    expect(pickEntry("const twoSum = (nums, target = 0) => {\n  const seen = new Map();\n  return [];\n};", 2)?.name).toBe("twoSum");
    expect(pickEntry("var climb = n => n < 2 ? 1 : climb(n - 1) + climb(n - 2);", 1)?.name).toBe("climb");
    const cls = pickEntry("class Solution {\n  maxDepth(root) {\n    if (!root) return 0;\n    return 1 + Math.max(this.maxDepth(root.left), this.maxDepth(root.right));\n  }\n}", 1);
    expect(cls).toEqual({ name: "maxDepth", params: ["root"], className: "Solution" });
  });

  it("ignores braces and names in strings and comments", () => {
    const code = `function isValid(s) {
  const pairs = { ")": "(", "]": "[", "}": "{" }; // { not a block
  const stack = [];
  for (const c of s) if (pairs[c]) { if (stack.pop() !== pairs[c]) return false; } else stack.push(c);
  return stack.length === 0;
}
console.log(isValid("()"));`;
    expect(pickEntry(code, 1)?.name).toBe("isValid");
  });

  it("prefers the name the notes use", () => {
    const code = "function a(x) { return x }\nfunction b(x) { return x }";
    expect(pickEntry(code, 1, "a")?.name).toBe("a");
    expect(pickEntry(code, 1)?.name).toBe("b");
    expect(pickEntry(code, 3)).toBeNull();
  });
});

import { chargeBuiltins, instrument, sizeOf } from "./instrument";

/** Runs instrumented code once and returns its step count. */
function count(code: string, entry: string, ...args: unknown[]) {
  const steps = { n: 0 };
  const spread = (x: unknown) => ((steps.n += sizeOf(x)), x);
  const fn = new Function("__steps", "__spread", `${instrument(code)}\nreturn ${entry};`)(steps, spread) as (...a: unknown[]) => unknown;
  const undo = chargeBuiltins(steps);
  try {
    fn(...args);
  } finally {
    undo();
  }
  return steps.n;
}

describe("instrument", () => {
  it("counts loop passes and calls", () => {
    const code = "function sum(a) { let s = 0; for (const x of a) s += x; return s; }";
    expect(count(code, "sum", [1, 2, 3, 4])).toBe(5);
    expect(count(code, "sum", new Array(100).fill(1))).toBe(101);
    const fib = "const fib = (n) => n < 2 ? n : fib(n - 1) + fib(n - 2);";
    expect(count(fib, "fib", 10)).toBe(177);
  });

  it("charges built-ins and spreads, and puts them back", () => {
    const nums = Array.from({ length: 64 }, (_, i) => 64 - i);
    expect(count("function f(a) { return a.slice().sort(); }", "f", nums)).toBe(1 + 64 + 64 * 6);
    expect(count("function f(a) { return [...a]; }", "f", nums)).toBe(65);
    expect(count("function f(a) { return new Set(a).size; }", "f", nums)).toBe(65);
    // A comparator counts itself, call by call (shuffled, or TimSort finds one run).
    const shuffled = nums.map((x) => (x * 37) % 64);
    expect(count("function f(a) { return a.slice().sort((x, y) => x - y); }", "f", shuffled)).toBeGreaterThan(64 * 4);
    expect([3, 1, 2].sort().join()).toBe("1,2,3");
    expect(Array.prototype.sort.name).toBe("sort");
  });

  it("keeps code working", () => {
    const code = "class Solution { twoSum(nums, t) { const m = new Map(); for (let i = 0; i < nums.length; i++) { if (m.has(t - nums[i])) return [m.get(t - nums[i]), i]; m.set(nums[i], i); } } }";
    const steps = { n: 0 };
    const S = new Function("__steps", "__spread", `${instrument(code)}\nreturn Solution;`)(steps, (x: unknown) => x);
    expect(new S().twoSum([2, 7, 11, 15], 9)).toEqual([0, 1]);
    expect(() => instrument("function (")).toThrow();
  });
});
