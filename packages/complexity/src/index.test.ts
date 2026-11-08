import { describe, expect, it } from "vitest";
import { parseBigO, rank } from "./index";

describe("parseBigO", () => {
  it.each([
    ["O(1)", 1024, 1],
    ["O(n)", 1024, 1024],
    ["O(log n)", 1024, 10],
    ["O(n log n)", 1024, 10240],
    ["O(n^2)", 10, 100],
    ["O(n²)", 10, 100],
    ["O(2^n)", 10, 1024],
    ["O(n!)", 5, 120],
    ["O(sqrt(n))", 16, 4],
    ["O(V + E)", 10, 20],
    ["O(n * m)", 10, 100],
    ["O(log^2 n)", 16, 16],
  ])("%s at n=%i is %i", (expr, n, want) => {
    expect(parseBigO(expr)?.(n)).toBeCloseTo(want);
  });

  it("rejects things it can't read", () => {
    expect(parseBigO("fast")).toBeNull();
    expect(parseBigO("O(banana)")).toBeNull();
  });

  it("ranks classes in order", () => {
    const order = ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n^2)", "O(2^n)"].map(rank);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
