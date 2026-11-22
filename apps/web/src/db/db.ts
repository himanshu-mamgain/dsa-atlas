import Dexie, { type EntityTable } from "dexie";
import type { Attempt, ChecklistState, Goal, Problem, ReviewResult } from "@dsa-atlas/shared";
import { applyReview, newReview } from "@dsa-atlas/review";
import { seedProblems } from "./seed";
import { seedChecklist } from "./checklist";

export const db = new Dexie("dsa-atlas") as Dexie & {
  problems: EntityTable<Problem, "id">;
  checklist: EntityTable<ChecklistState, "id">;
  goals: EntityTable<Goal, "id">;
  attempts: EntityTable<Attempt, "id">;
  deleted: EntityTable<Deleted, "key">;
};

/** Something you deleted, so your Studia account doesn't bring it back from another device. */
export interface Deleted {
  /** "problem:<id>", "goal:<id>" or "saved:<attempt id>/<solution id>". */
  key: string;
  at: number;
}

db.version(1).stores({
  // Indexed fields only; the rest of the problem is stored as-is.
  problems: "id, title, difficulty, *topics, *patterns, review.nextDue, updatedAt",
});

// v2: Master Checklist progress (seeded from the Notion snapshot) and company goals.
db.version(2)
  .stores({ checklist: "id, done", goals: "id, targetDate" })
  .upgrade((tx) => tx.table("checklist").bulkPut(seedChecklist()));

// v3: your code and measured complexities from each checklist problem's solve page.
db.version(3).stores({ attempts: "id, updatedAt" });

// v4: what you deleted, for syncing with your Studia account.
db.version(4).stores({ deleted: "key" });

db.on("populate", (tx) => {
  tx.table("problems").bulkAdd(seedProblems());
  tx.table("checklist").bulkAdd(seedChecklist());
});

export const uid = () => crypto.randomUUID().slice(0, 8);

/** Remember a deletion, so syncing with your Studia account deletes it on your other devices too. */
export async function markDeleted(key: string) {
  await db.deleted.put({ key, at: Date.now() });
}

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

/** Backup as JSON: your own copy, with or without a Studia account. */
export async function exportAll(): Promise<string> {
  return JSON.stringify(
    { version: 3, problems: await db.problems.toArray(), checklist: await db.checklist.toArray(), goals: await db.goals.toArray(), attempts: await db.attempts.toArray() },
    null,
    2,
  );
}

export async function importAll(json: string): Promise<number> {
  const data = JSON.parse(json) as { problems?: Problem[]; checklist?: ChecklistState[]; goals?: Goal[]; attempts?: Attempt[] };
  if (!Array.isArray(data.problems)) throw new Error("Not a DSA Atlas export");
  await db.problems.bulkPut(data.problems);
  if (Array.isArray(data.checklist)) await db.checklist.bulkPut(data.checklist);
  if (Array.isArray(data.goals)) await db.goals.bulkPut(data.goals);
  if (Array.isArray(data.attempts)) await db.attempts.bulkPut(data.attempts);
  return data.problems.length;
}
