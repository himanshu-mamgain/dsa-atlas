import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { Attempt, ChecklistState, Goal, Problem } from "@dsa-atlas/shared";
import { newReview } from "@dsa-atlas/review";
import { db, markDeleted } from "../db/db";
import { mergeAtlas, mergeReview, stable, type AtlasData } from "./merge";
import { applySnapshot, onLocalChange, snapshot } from "./data";

const DAY = 86_400_000;
const T = Date.UTC(2026, 10, 22);

function problem(id: string, patch: Partial<Problem> = {}): Problem {
  return {
    id,
    title: id,
    url: "",
    platform: "LeetCode",
    difficulty: "Easy",
    topics: [],
    patterns: [],
    structuraTopics: [],
    approaches: [],
    notes: "",
    review: newReview(T),
    createdAt: T,
    updatedAt: T,
    ...patch,
  };
}

const data = (patch: Partial<AtlasData> = {}): AtlasData => ({ version: 1, problems: [], checklist: [], goals: [], attempts: [], deleted: {}, ...patch });

describe("mergeAtlas", () => {
  it("keeps problems from both devices, and the later edit of the same one", () => {
    const phone = data({ problems: [problem("two-sum", { notes: "phone", updatedAt: T + 2 }), problem("lru-cache")] });
    const laptop = data({ problems: [problem("two-sum", { notes: "laptop", updatedAt: T + 1 }), problem("3sum")] });
    const merged = mergeAtlas(phone, laptop, T);
    expect(merged.problems.map((p) => p.id)).toEqual(["3sum", "lru-cache", "two-sum"]);
    expect(merged.problems.find((p) => p.id === "two-sum")!.notes).toBe("phone");
  });

  it("keeps every review, and the schedule from the most recent one", () => {
    const a = { stage: 2, lastSeen: T + 3 * DAY, nextDue: T + 10 * DAY, history: [{ at: T + DAY, result: "ok" as const }, { at: T + 3 * DAY, result: "easy" as const }] };
    const b = { stage: 1, lastSeen: T + 2 * DAY, nextDue: T + 5 * DAY, history: [{ at: T + DAY, result: "ok" as const }, { at: T + 2 * DAY, result: "forgot" as const }] };
    const r = mergeReview(b, a);
    expect(r.stage).toBe(2);
    expect(r.nextDue).toBe(T + 10 * DAY);
    expect(r.history.map((h) => h.result)).toEqual(["ok", "forgot", "easy"]);
  });

  it("takes your own tick over Notion's, then the later of your ticks", () => {
    const fromNotion: ChecklistState = { id: "two-sum", done: true, doneAt: T, updatedAt: T + 9 };
    const unticked: ChecklistState = { id: "two-sum", done: false, doneAt: null, touched: true, updatedAt: T + 1 };
    expect(mergeAtlas(data({ checklist: [fromNotion] }), data({ checklist: [unticked] }), T).checklist[0].done).toBe(false);
    const ticked: ChecklistState = { id: "two-sum", done: true, doneAt: T + 2, touched: true, updatedAt: T + 2, problemId: "two-sum" };
    const merged = mergeAtlas(data({ checklist: [unticked] }), data({ checklist: [ticked] }), T).checklist[0];
    expect(merged.done).toBe(true);
    expect(merged.problemId).toBe("two-sum");
  });

  it("doesn't bring back what you deleted, unless it changed after that", () => {
    const goal: Goal = { id: "gokwik", company: "GoKwik", targetDate: "2026-12-31", items: [], note: "", createdAt: T, updatedAt: T };
    const phone = data({ problems: [problem("old"), problem("edited", { updatedAt: T + 5 })], goals: [goal] });
    const laptop = data({ deleted: { "problem:old": T + 1, "problem:edited": T + 1, "goal:gokwik": T + 1 } });
    const merged = mergeAtlas(phone, laptop, T + 2);
    expect(merged.problems.map((p) => p.id)).toEqual(["edited"]);
    expect(merged.goals).toEqual([]);
    expect(merged.deleted["problem:old"]).toBe(T + 1);
  });

  it("merges saved solutions and measurements, and drops deleted solutions", () => {
    const base: Attempt = { id: "two-sum", language: "javascript", code: "", updatedAt: T };
    const keep = { id: "s1", name: "Brute force", language: "javascript" as const, code: "a", createdAt: T, updatedAt: T };
    const gone = { id: "s2", name: "Hash map", language: "javascript" as const, code: "b", createdAt: T + 1, updatedAt: T + 1 };
    const phone = data({ attempts: [{ ...base, code: "mine", updatedAt: T + 4, saved: [keep, gone], current: "s2" }] });
    const laptop = data({
      attempts: [{ ...base, runs: { mine: { key: "k", bigO: "O(n)", basis: "steps", n: "n", variant: "v", points: [], stopped: "size", at: T } } }],
      deleted: { "saved:two-sum/s2": T + 2 },
    });
    const a = mergeAtlas(phone, laptop, T + 3).attempts[0];
    expect(a.code).toBe("mine");
    expect(a.saved!.map((s) => s.id)).toEqual(["s1"]);
    expect(a.current).toBeUndefined();
    expect(a.runs!.mine.bigO).toBe("O(n)");
  });

  it("forgets deletions after 180 days", () => {
    const merged = mergeAtlas(data({ deleted: { "goal:x": T } }), data(), T + 181 * DAY);
    expect(merged.deleted).toEqual({});
  });

  it("gives the same answer whichever device merges", () => {
    const phone = data({ problems: [problem("a", { updatedAt: T + 1 })], checklist: [{ id: "c", done: true, doneAt: T, touched: true, updatedAt: T + 1 }] });
    const laptop = data({ problems: [problem("a", { updatedAt: T + 2 }), problem("b")], checklist: [{ id: "c", done: false, doneAt: null, touched: true, updatedAt: T + 2 }] });
    expect(stable(mergeAtlas(phone, laptop, T))).toBe(stable(mergeAtlas(laptop, phone, T)));
  });
});

describe("the device's copy (IndexedDB)", () => {
  it("writes the account's copy without counting it as your change, and sees your own changes", async () => {
    await db.open();
    let changes = 0;
    const stop = onLocalChange(() => changes++);
    const before = await snapshot();
    const merged = mergeAtlas(before, data({ problems: [problem("from-laptop")], deleted: { "goal:none": Date.now() } }));
    await applySnapshot(merged, before);
    expect(changes).toBe(0);
    const after = await snapshot();
    expect(after.problems.some((p) => p.id === "from-laptop")).toBe(true);
    expect(stable(after)).toBe(stable(merged));

    await db.problems.delete("from-laptop");
    await markDeleted("problem:from-laptop");
    expect(changes).toBe(2);
    expect((await snapshot()).deleted["problem:from-laptop"]).toBeGreaterThan(0);
    stop();
  });
});
