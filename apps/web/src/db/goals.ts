import type { ChecklistState, Goal, Problem } from "@dsa-atlas/shared";
import { CHECKLIST_ITEMS, checklistItem } from "./checklist";
import { db, uid } from "./db";

/** Companies you're targeting (Gurugram product companies). Names only: which problems to practise comes from you. */
export const SUGGESTED_COMPANIES = ["GoKwik", "Ram Fincorp", "ixigo", "Cars24", "CarDekho"];

export type Starter = "tier1-todo" | "tier1" | "tier1-2-todo" | "empty";

export const STARTERS: { value: Starter; label: string }[] = [
  { value: "tier1-todo", label: "Tier 1 problems I haven't solved" },
  { value: "tier1", label: "All of Tier 1" },
  { value: "tier1-2-todo", label: "Tier 1 + 2 problems I haven't solved" },
  { value: "empty", label: "Start empty and pick problems" },
];

export function starterItems(starter: Starter, states: ChecklistState[]): string[] {
  const done = new Set(states.filter((s) => s.done).map((s) => s.id));
  const pick = (tiers: number[], todoOnly: boolean) =>
    CHECKLIST_ITEMS.filter((i) => tiers.includes(i.tier) && (!todoOnly || !done.has(i.id))).map((i) => `c:${i.id}`);
  if (starter === "tier1-todo") return pick([1], true);
  if (starter === "tier1") return pick([1], false);
  if (starter === "tier1-2-todo") return pick([1, 2], true);
  return [];
}

export async function createGoal(company: string, targetDate: string, items: string[], note = ""): Promise<string> {
  const id = `${company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${uid().slice(0, 4)}`;
  await db.goals.add({ id, company: company.trim(), targetDate, items, note, createdAt: Date.now() });
  return id;
}

export interface GoalItemView {
  ref: string;
  title: string;
  done: boolean;
  /** Pattern for checklist items, topics for your own problems. */
  group: string;
  checklistId?: string;
  problemId?: string;
  notion?: string;
}

/** Resolves a goal's refs against the checklist and your problems. */
export function goalItems(goal: Goal, states: Map<string, ChecklistState>, problems: Map<string, Problem>): GoalItemView[] {
  return goal.items.flatMap((ref): GoalItemView[] => {
    const [kind, id] = [ref.slice(0, 2), ref.slice(2)];
    if (kind === "c:") {
      const item = checklistItem(id);
      if (!item) return [];
      const s = states.get(id);
      return [{ ref, title: item.title, done: s?.done ?? false, group: item.pattern, checklistId: id, problemId: s?.problemId, notion: item.notion }];
    }
    const p = problems.get(id);
    if (!p) return [];
    return [{ ref, title: p.title, done: p.review.lastSeen !== null, group: p.topics[0] ?? "Your problems", problemId: p.id }];
  });
}

const DAY = 86_400_000;

/** Calendar days from today to the target date (0 = today, negative = past). */
export function daysLeft(targetDate: string, now = Date.now()): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${targetDate}T00:00`).getTime() - today.getTime()) / DAY);
}

/** Problems a day needed to finish on time. */
export function pace(remaining: number, days: number): number {
  if (remaining <= 0) return 0;
  return days <= 0 ? remaining : Math.ceil(remaining / days);
}
