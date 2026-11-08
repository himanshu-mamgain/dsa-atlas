import { describe, expect, it } from "vitest";
import type { NotesIndex } from "@dsa-atlas/shared";
import { normalizeTitle, noteIdIn, notesForProblem, searchNotes } from "./notes";

const note = (id: string, title: string, summary = "") => ({ id, title, url: "", edited: "", parent: null, summary, words: 1 });
const index: NotesIndex = {
  title: "DSA",
  url: "",
  built: "",
  notes: [
    note("39563e41-004f-80ca-8a3d-c01bde0107a5", "Two Sum (Hash Map)", "Store complements in a map"),
    note("38a63e41-004f-8050-b71d-cae6af5033db", "Stock Buy and Sell Problem", "A family of problems"),
    note("11111111-1111-1111-1111-111111111111", "Array"),
  ],
};

describe("notesForProblem", () => {
  it("matches titles ignoring brackets and case", () => {
    expect(normalizeTitle("Two Sum (Hash Map)")).toBe("two sum");
    expect(notesForProblem({ title: "two sum", notes: "" }, index).map((n) => n.title)).toEqual(["Two Sum (Hash Map)"]);
  });

  it("follows links to Notion pages (from the checklist or the notes)", () => {
    const linked = ["https://app.notion.com/p/38a63e41004f8050b71dcae6af5033db"];
    expect(notesForProblem({ title: "Best Time to Buy and Sell Stock", notes: "" }, index, linked).map((n) => n.title)).toEqual(["Stock Buy and Sell Problem"]);
    expect(notesForProblem({ title: "X", notes: "See https://www.notion.so/Array-11111111111111111111111111111111" }, index).map((n) => n.title)).toEqual(["Array"]);
  });

  it("finds notes from links and search", () => {
    expect(noteIdIn("https://www.notion.so/Two-Sum-39563e41004f80ca8a3dc01bde0107a5", index)).toBe("39563e41-004f-80ca-8a3d-c01bde0107a5");
    expect(noteIdIn("https://example.com/x", index)).toBeNull();
    expect(searchNotes(index, "complement").map((n) => n.title)).toEqual(["Two Sum (Hash Map)"]);
  });
});
