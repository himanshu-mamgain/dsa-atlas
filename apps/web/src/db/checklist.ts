import type { ChecklistState, Difficulty, Problem } from "@dsa-atlas/shared";
import { newReview } from "@dsa-atlas/review";
import data from "../data/checklist.json";
import { db, uid } from "./db";

export interface ChecklistItem {
  id: string;
  title: string;
  notion?: string;
  /** Ticked in the Notion snapshot. */
  done: boolean;
}

export interface ChecklistSection {
  pattern: string;
  items: ChecklistItem[];
}

export interface ChecklistTier {
  tier: number;
  title: string;
  sections: ChecklistSection[];
}

/** The Master Checklist from Notion (src/data/notion/master-checklist.md → checklist.json). */
export const CHECKLIST = data as { source: string; tiers: ChecklistTier[]; practice: string[]; signals: { when: string; think: string }[] };

export interface ChecklistEntry extends ChecklistItem {
  tier: number;
  pattern: string;
}

export const CHECKLIST_ITEMS: ChecklistEntry[] = CHECKLIST.tiers.flatMap((t) =>
  t.sections.flatMap((s) => s.items.map((i) => ({ ...i, tier: t.tier, pattern: s.pattern }))),
);

const byId = new Map(CHECKLIST_ITEMS.map((i) => [i.id, i]));
export const checklistItem = (id: string) => byId.get(id);

/** Starting progress: whatever was ticked in Notion. */
export function seedChecklist(): ChecklistState[] {
  const now = Date.now();
  return CHECKLIST_ITEMS.map((i) => ({ id: i.id, done: i.done, doneAt: i.done ? now : null }));
}

export async function setDone(id: string, done: boolean) {
  const prev = await db.checklist.get(id);
  await db.checklist.put({ ...(prev ?? { id }), id, done, doneAt: done ? Date.now() : null });
}

const TIER_DIFFICULTY: Record<number, Difficulty> = { 1: "Medium", 2: "Medium", 3: "Hard" };

/**
 * Opens (or creates) the DSA Atlas problem for a checklist item, pre-filled with
 * its pattern, tier and Notion link, so notes can be added.
 */
export async function problemFor(item: ChecklistEntry): Promise<string> {
  const state = await db.checklist.get(item.id);
  if (state?.problemId && (await db.problems.get(state.problemId))) return state.problemId;

  let id = item.id;
  if (await db.problems.get(id)) id = `${id}-${uid().slice(0, 4)}`;
  const now = Date.now();
  const p: Problem = {
    id,
    title: item.title,
    url: "",
    platform: "LeetCode",
    difficulty: TIER_DIFFICULTY[item.tier] ?? "Medium",
    topics: [item.pattern],
    patterns: [],
    structuraTopics: [],
    approaches: [{ id: uid(), kind: "brute", idea: "", time: "O(n^2)", space: "O(1)", solutions: [{ language: "cpp", code: "", languageNotes: "" }] }],
    notes: item.notion ? `Notion notes: ${item.notion}` : "",
    review: newReview(now),
    createdAt: now,
    updatedAt: now,
  };
  await db.problems.add(p);
  await db.checklist.put({ ...(state ?? { id: item.id, done: false, doneAt: null }), problemId: id });
  return id;
}
