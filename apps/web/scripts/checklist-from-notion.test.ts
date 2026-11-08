import { describe, expect, it } from "vitest";
import { checklistFromBlocks, countItems } from "./checklist-from-notion";
import type { RawBlock } from "./notion-lib";

const text = (content: string, href?: string) => [{ type: "text", plain_text: content, href: href ?? null, annotations: {} }];
const h = (n: 1 | 2, t: string): RawBlock => ({ id: t, type: `heading_${n}`, has_children: false, [`heading_${n}`]: { rich_text: text(t) } });
const todo = (t: string, checked: boolean, href?: string, kids?: RawBlock[]): RawBlock => ({
  id: t,
  type: "to_do",
  has_children: Boolean(kids),
  to_do: { rich_text: text(t, href), checked },
  kids,
});

describe("checklistFromBlocks", () => {
  const blocks: RawBlock[] = [
    h(1, "How to Practice"),
    { id: "c", type: "code", has_children: false, code: { rich_text: text("1. Read problem\n2. Identify pattern\n3. Write brute force first") } },
    h(1, "Tier 1 — Must Solve (Highest Frequency)"),
    h(2, "Arrays & Strings"),
    todo("Two Sum (Hash Map)", true, "/39563e41004f80ca8a3dc01bde0107a5"),
    todo("Longest Common Prefix", false, undefined, [todo("Longest Palindromic Substring", false)]),
    h(2, "Graphs"),
    todo("Number of Islands", false),
    h(1, "Tier 2 — Very Commonly Asked"),
    h(2, "Stack"),
    todo("Min Stack", false),
    h(1, "Pattern Recognition Cheat Sheet"),
    {
      id: "t",
      type: "table",
      has_children: true,
      table: { has_column_header: true },
      kids: [
        { id: "r0", type: "table_row", has_children: false, table_row: { cells: [text("If problem mentions..."), text("Think...")] } },
        { id: "r1", type: "table_row", has_children: false, table_row: { cells: [text("Sorted array, find pair/target"), text("Two Pointers")] } },
      ],
    },
  ];

  const c = checklistFromBlocks(blocks, "https://app.notion.com/p/x");

  it("reads tiers, patterns and to-dos, nested ones included", () => {
    expect(c.tiers.map((t) => [t.tier, t.title])).toEqual([
      [1, "Must Solve (Highest Frequency)"],
      [2, "Very Commonly Asked"],
    ]);
    expect(c.tiers[0].sections.map((s) => s.pattern)).toEqual(["Arrays & Strings", "Graphs"]);
    expect(countItems(c)).toBe(5);
    expect(c.tiers[0].sections[0].items.map((i) => i.title)).toContain("Longest Palindromic Substring");
  });

  it("keeps the same ids as the saved checklist, ticks and Notion links", () => {
    expect(c.tiers[0].sections[0].items[0]).toEqual({
      id: "two-sum-hash-map",
      title: "Two Sum (Hash Map)",
      notion: "https://app.notion.com/p/39563e41004f80ca8a3dc01bde0107a5",
      done: true,
    });
  });

  it("reads practice steps and pattern signals", () => {
    expect(c.practice).toEqual(["Read problem", "Identify pattern", "Write brute force first"]);
    expect(c.signals).toEqual([{ when: "Sorted array, find pair/target", think: "Two Pointers" }]);
  });
});
