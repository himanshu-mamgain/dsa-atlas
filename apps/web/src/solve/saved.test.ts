import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db } from "../db/db";
import { deleteSolution, freshName, openSolution, renameSolution, saveAttempt, saveSolution } from "./solve";

const now = 0;
const sol = (name: string) => ({ id: name, name, language: "javascript" as const, code: "", createdAt: now, updatedAt: now });

describe("freshName", () => {
  it("numbers solutions and avoids clashes", () => {
    expect(freshName(undefined)).toBe("Solution 1");
    expect(freshName([sol("Solution 1")])).toBe("Solution 2");
    expect(freshName([sol("Two pointers")], "Two pointers")).toBe("Two pointers (2)");
    expect(freshName([sol("Brute")], "Optimal")).toBe("Optimal");
  });
});

describe("named solutions", () => {
  const id = "two-sum-hash-map";

  it("saves, updates, opens, renames and deletes, keeping the draft and runs", async () => {
    await saveAttempt(id, { code: "draft", language: "javascript", example: "nums = [1], target = 1" });
    const brute = await saveSolution(id, { name: "Brute force", language: "javascript", code: "function a() {}" });
    const optimal = await saveSolution(id, { name: "Optimal", language: "javascript", code: "function b() {}" });

    let a = await db.attempts.get(id);
    expect(a?.saved?.map((s) => s.name)).toEqual(["Brute force", "Optimal"]);
    expect(a?.current).toBe(optimal);
    expect(a?.example).toBe("nums = [1], target = 1");

    // Save again while editing "Optimal" updates it instead of adding one.
    await saveSolution(id, { name: "Optimal", language: "javascript", code: "function b2() {}" }, optimal);
    a = await db.attempts.get(id);
    expect(a?.saved).toHaveLength(2);
    expect(a?.saved?.find((s) => s.id === optimal)?.code).toBe("function b2() {}");

    // Opening puts it in the editor.
    await openSolution(id, brute);
    a = await db.attempts.get(id);
    expect(a?.code).toBe("function a() {}");
    expect(a?.current).toBe(brute);

    await renameSolution(id, brute, "  Nested loops  ");
    expect((await db.attempts.get(id))?.saved?.find((s) => s.id === brute)?.name).toBe("Nested loops");

    await deleteSolution(id, brute);
    a = await db.attempts.get(id);
    expect(a?.saved?.map((s) => s.name)).toEqual(["Optimal"]);
    expect(a?.current).toBeUndefined();
  });
});
