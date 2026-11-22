import type { Attempt, ChecklistState, Goal, Problem, Review, SavedSolution } from "@dsa-atlas/shared";

/**
 * Everything of yours that DSA Atlas keeps, as saved to your Studia account: your problems
 * (notes, code, revision history), Master Checklist ticks, company goals and solve-page
 * attempts. `deleted` remembers what you deleted and when, so another device's copy doesn't
 * bring it back.
 */
export interface AtlasData {
  version: 1;
  problems: Problem[];
  checklist: ChecklistState[];
  goals: Goal[];
  attempts: Attempt[];
  /** "problem:<id>", "goal:<id>" or "saved:<attempt id>/<solution id>" → when it was deleted. */
  deleted: Record<string, number>;
}

/** Tombstones older than this are forgotten: every device has synced long before. */
const KEEP_DELETED_MS = 180 * 24 * 60 * 60 * 1000;

function byId<T extends { id: string }>(a: T[], b: T[], pick: (x: T, y: T) => T): T[] {
  const out = new Map(a.map((x) => [x.id, x]));
  for (const y of b) {
    const x = out.get(y.id);
    out.set(y.id, x ? pick(x, y) : y);
  }
  return [...out.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

/** Revision: keep every review from both devices; the schedule comes from the most recent one. */
export function mergeReview(a: Review, b: Review): Review {
  const latest = (b.lastSeen ?? 0) > (a.lastSeen ?? 0) || ((b.lastSeen ?? 0) === (a.lastSeen ?? 0) && b.history.length > a.history.length) ? b : a;
  const seen = new Map<string, Review["history"][number]>();
  for (const h of [...a.history, ...b.history]) seen.set(`${h.at}:${h.result}`, h);
  return { ...latest, history: [...seen.values()].sort((x, y) => x.at - y.at) };
}

function mergeProblem(a: Problem, b: Problem): Problem {
  // The note itself (title, approaches, code, notes) comes from the copy edited last.
  const content = b.updatedAt > a.updatedAt ? b : a;
  return { ...content, createdAt: Math.min(a.createdAt, b.createdAt), review: mergeReview(a.review, b.review) };
}

/** A tick you set in the app beats Notion's; between two of yours, the later one wins. */
function mergeChecklist(a: ChecklistState, b: ChecklistState): ChecklistState {
  let win = a;
  if (Boolean(b.touched) !== Boolean(a.touched)) win = b.touched ? b : a;
  else if ((b.updatedAt ?? 0) > (a.updatedAt ?? 0)) win = b;
  const lose = win === a ? b : a;
  return { ...win, problemId: win.problemId ?? lose.problemId };
}

const goalTime = (g: Goal) => g.updatedAt ?? g.createdAt;

function mergeSaved(attemptId: string, a: SavedSolution[] = [], b: SavedSolution[] = [], deleted: Record<string, number>): SavedSolution[] {
  return byId(a, b, (x, y) => (y.updatedAt > x.updatedAt ? y : x))
    .filter((s) => !((deleted[`saved:${attemptId}/${s.id}`] ?? -1) >= s.updatedAt))
    .sort((x, y) => x.createdAt - y.createdAt);
}

function mergeAttempt(a: Attempt, b: Attempt, deleted: Record<string, number>): Attempt {
  // Your code in the editor comes from the copy changed last; saved solutions and
  // measurements from both.
  const win = b.updatedAt > a.updatedAt ? b : a;
  const runs = { ...a.runs };
  for (const [key, run] of Object.entries(b.runs ?? {})) if (!runs[key] || run.at > runs[key].at) runs[key] = run;
  const saved = mergeSaved(a.id, a.saved, b.saved, deleted);
  const out: Attempt = { ...win };
  if (Object.keys(runs).length) out.runs = runs;
  else delete out.runs;
  if (saved.length || a.saved || b.saved) out.saved = saved;
  if (out.current && !saved.some((s) => s.id === out.current)) delete out.current;
  return out;
}

/** Combines this device's data with the account's, so neither loses work. */
export function mergeAtlas(local: AtlasData, remote: AtlasData, now = Date.now()): AtlasData {
  const deleted: Record<string, number> = {};
  for (const [key, at] of [...Object.entries(local.deleted ?? {}), ...Object.entries(remote.deleted ?? {})]) {
    if (now - at < KEEP_DELETED_MS) deleted[key] = Math.max(deleted[key] ?? 0, at);
  }
  // Deleted on one device: gone everywhere, unless it was changed again after that.
  const alive = (key: string, changedAt: number) => !((deleted[key] ?? -1) >= changedAt);
  const problems = byId(local.problems, remote.problems, mergeProblem).filter((p) =>
    alive(`problem:${p.id}`, Math.max(p.updatedAt, p.review.lastSeen ?? 0)),
  );
  const goals = byId(local.goals, remote.goals, (a, b) => (goalTime(b) > goalTime(a) ? b : a)).filter((g) => alive(`goal:${g.id}`, goalTime(g)));
  return {
    version: 1,
    problems,
    checklist: byId(local.checklist, remote.checklist, mergeChecklist),
    goals,
    attempts: byId(local.attempts, remote.attempts, (a, b) => mergeAttempt(a, b, deleted)).map((a) =>
      // A solution deleted here may still sit in this device's only copy of the attempt.
      a.saved ? { ...a, saved: a.saved.filter((s) => alive(`saved:${a.id}/${s.id}`, s.updatedAt)) } : a,
    ),
    deleted,
  };
}

/** JSON with sorted keys, so two copies with the same content compare equal. */
export function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
  );
}
