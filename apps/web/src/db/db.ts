import Dexie, { type EntityTable } from "dexie";
import type { ChecklistState, Goal, Problem, ReviewResult } from "@dsa-atlas/shared";
import { applyReview, newReview } from "@dsa-atlas/review";
import { seedProblems } from "./seed";
import { seedChecklist } from "./checklist";

export const db = new Dexie("dsa-atlas") as Dexie & {
  problems: EntityTable<Problem, "id">;
  checklist: EntityTable<ChecklistState, "id">;
  goals: EntityTable<Goal, "id">;
};

db.version(1).stores({
  // Indexed fields only; the rest of the problem is stored as-is.
  problems: "id, title, difficulty, *topics, *patterns, review.nextDue, updatedAt",
});

// v2: Master Checklist progress (seeded from the Notion snapshot) and company goals.
db.version(2)
  .stores({ checklist: "id, done", goals: "id, targetDate" })
  .upgrade((tx) => tx.table("checklist").bulkPut(seedChecklist()));

db.on("populate", (tx) => {
  tx.table("problems").bulkAdd(seedProblems());
  tx.table("checklist").bulkAdd(seedChecklist());
});

export const uid = () => crypto.randomUUID().slice(0, 8);

export async function saveProblem(p: Problem) {
  await db.problems.put({ ...p, updatedAt: Date.now() });
}

export async function reviewProblem(id: string, result: ReviewResult) {
  const p = await db.problems.get(id);
  if (!p) return;
  await db.problems.put({ ...p, review: applyReview(p.review, result) });
}

export function blankProblem(title: string, id: string): Problem {
  const now = Date.now();
  return {
    id,
    title,
    url: "",
    platform: "LeetCode",
    difficulty: "Medium",
    topics: [],
    patterns: [],
    structuraTopics: [],
    approaches: [
      {
        id: uid(),
        kind: "brute",
        idea: "",
        time: "O(n^2)",
        space: "O(1)",
        solutions: [{ language: "cpp", code: "", languageNotes: "" }],
      },
    ],
    notes: "",
    review: newReview(now),
    createdAt: now,
    updatedAt: now,
  };
}

/** Backup as JSON (no server: this is how notes move between devices for now). */
export async function exportAll(): Promise<string> {
  return JSON.stringify({ version: 2, problems: await db.problems.toArray(), checklist: await db.checklist.toArray(), goals: await db.goals.toArray() }, null, 2);
}

export async function importAll(json: string): Promise<number> {
  const data = JSON.parse(json) as { problems?: Problem[]; checklist?: ChecklistState[]; goals?: Goal[] };
  if (!Array.isArray(data.problems)) throw new Error("Not a DSA Atlas export");
  await db.problems.bulkPut(data.problems);
  if (Array.isArray(data.checklist)) await db.checklist.bulkPut(data.checklist);
  if (Array.isArray(data.goals)) await db.goals.bulkPut(data.goals);
  return data.problems.length;
}
