import { describe, expect, it } from "vitest";
import { argsFor, judge, shapesOf, show, toPlain } from "./check";
import { pickEntry } from "./entry";

describe("pickEntry with optional parameters", () => {
  const code = `function isPalindrome(s, left = 0, right = s.length - 1) {
  if (left >= right) return true;
  return s.charAt(left) === s.charAt(right) && isPalindrome(s, left + 1, right - 1);
}`;
  it("takes a function whose extra parameters have defaults", () => {
    expect(pickEntry(code, 1)).toEqual({ name: "isPalindrome", params: ["s"] });
    expect(pickEntry(code, 3)).toEqual({ name: "isPalindrome", params: ["s", "left", "right"] });
    expect(pickEntry(code, 4)).toBeNull();
  });

  it("still prefers an exact match, and handles rest parameters", () => {
    const both = "function helper(a, b = 1) { return a + b }\nfunction solve(a) { return a }";
    expect(pickEntry(both, 1)?.name).toBe("solve");
    expect(pickEntry("function sum(...xs) { return xs.length }", 3)?.name).toBe("sum");
    expect(pickEntry("function f(a, b) {}", 1)).toBeNull();
  });

  it("isn't fooled by comparisons in defaults", () => {
    expect(pickEntry("function f(a, b = a === 1) { return b }", 1)?.name).toBe("f");
  });
});

describe("argsFor and toPlain", () => {
  it("builds lists and trees from example arrays and reads them back", () => {
    const [head, root, k] = argsFor([[1, 2, 3], [3, 9, 20, null, null, 15, 7], 2], ["list", "tree", null]);
    expect(toPlain(head)).toEqual([1, 2, 3]);
    expect(toPlain(root)).toEqual([3, 9, 20, null, null, 15, 7]);
    expect(k).toBe(2);
  });

  it("gives each run a fresh copy", () => {
    const values = [[3, 1, 2]];
    const [a] = argsFor(values, [null]) as number[][];
    a.sort();
    expect(values[0]).toEqual([3, 1, 2]);
  });

  it("finds shapes from the input plan", () => {
    expect(shapesOf([{ kind: "list", name: "head", sorted: false, min: 0, max: 9 }, { kind: "fixed", name: "k", value: 2 }], 2)).toEqual(["list", null]);
    expect(shapesOf(undefined, 2)).toEqual([null, null]);
  });
});

describe("judge", () => {
  it("compares values, with Yes/No as booleans", () => {
    expect(judge(true, "Yes")).toEqual({ pass: true });
    expect(judge(false, "Yes")).toEqual({ pass: false });
    expect(judge(false, "No")).toEqual({ pass: true });
    expect(judge(true, "true")).toEqual({ pass: true });
    expect(judge([0, 1], "[0,1]")).toEqual({ pass: true });
    expect(judge(6, "6")).toEqual({ pass: true });
    expect(judge(2.000001, "2.00000")).toEqual({ pass: true });
    expect(judge("fl", '"fl"')).toEqual({ pass: true });
    expect(judge(5, "6")).toEqual({ pass: false });
  });

  it("accepts any order when only the order differs", () => {
    expect(judge([[ "bat" ], ["nat", "tan"], ["ate", "eat", "tea"]], '[["bat"],["nat","tan"],["ate","eat","tea"]]')).toEqual({ pass: true });
    expect(judge([["tan", "nat"], ["bat"], ["eat", "tea", "ate"]], '[["bat"],["nat","tan"],["ate","eat","tea"]]')).toEqual({ pass: true, anyOrder: true });
    expect(judge([1, 2, 2], "[1,2,3]")).toEqual({ pass: false });
  });

  it("shows results as short text", () => {
    expect(show("ab")).toBe('"ab"');
    expect(show(undefined)).toBe("undefined");
    expect(show([1, 2])).toBe("[1,2]");
  });
});
