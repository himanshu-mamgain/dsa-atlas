// The glue between a checklist item, its Notion page, your code and the
// measurements: what to measure, how results are stored, and marking solved.
import { classOf, parseArgs, pickEntry, planInputs, type Entry, type InputPlan } from "@dsa-atlas/complexity";
import type { Attempt, Language, MeasuredRun } from "@dsa-atlas/shared";
import { db, saveProblem } from "../db/db";
import { problemFor, setDone, type ChecklistEntry } from "../db/checklist";
import type { Measurement } from "../measure/run";
import type { ParsedProblem, RefSolution } from "./parse";

/** FNV-1a, enough to tell whether code changed since it was measured. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export const runKey = (code: string, example: string) => hash(`${example}\n${code}`);
export const refKey = (s: RefSolution) => `ref:${s.title}`;

export const RUNNABLE: Language[] = ["javascript"];
export const runnableLang = (lang: string) => /^(javascript|js|jsx)$/i.test(lang);

export type Plan = { ok: true; entry: Entry; plan: InputPlan } | { ok: false; reason: string };

/** Works out what to call and how to make inputs, from the code and one example call. */
export function planFor(code: string, example: string, prefer?: string): Plan {
  if (!code.trim()) return { ok: false, reason: "Write a solution first." };
  if (!example.trim()) return { ok: false, reason: "Add an example input to measure with, like nums = [2,7,11,15], target = 9." };
  const args = parseArgs(example);
  const entry = pickEntry(code, args.length, prefer);
  if (!entry) {
    if (/\bclass\s+(?!Solution\b)\w+/.test(code) && !/\bfunction\b|=>/.test(code.replace(/class[\s\S]*/, "")))
      return { ok: false, reason: "Design problems (a class with methods) can't be measured yet." };
    return { ok: false, reason: `Couldn't find a function taking ${args.length} input${args.length === 1 ? "" : "s"} (${args.map((a, i) => a.name ?? `#${i + 1}`).join(", ")}).` };
  }
  const plan = planInputs(entry.params, args, code);
  if (!plan) return { ok: false, reason: "Can't make bigger inputs like this example yet (objects, or operations on a class)." };
  return { ok: true, entry, plan };
}

/** The entry function the notes' optimal solution uses, to name the starter code after it. */
export function referenceEntry(problem: ParsedProblem | null): Entry | null {
  if (!problem) return null;
  const args = problem.examples[0]?.args.length;
  for (const s of [...problem.solutions].reverse()) {
    if (!runnableLang(s.lang)) continue;
    const e = args ? pickEntry(s.code, args) : null;
    if (e) return e;
  }
  return null;
}

/** Starter code: the function to write, with what its inputs look like. */
export function starterCode(problem: ParsedProblem | null, title: string): string {
  const entry = referenceEntry(problem);
  const example = problem?.examples[0];
  const name = entry?.name ?? (title.replace(/\(.*?\)/g, "").trim().replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : "")).replace(/^./, (c) => c.toLowerCase()) || "solve");
  const params = entry?.params ?? example?.args.map((a, i) => a.name ?? `arg${i}`) ?? ["input"];
  const hint = example ? `// Example: ${example.input}${example.output ? `  →  ${example.output}` : ""}\n` : "";
  const nodes = /\b(head|list\d?|l\d)\b/.test(params.join(" ")) ? "// A list node is { val, next }.\n" : /\broot\b/.test(params.join(" ")) ? "// A tree node is { val, left, right }.\n" : "";
  return `${hint}${nodes}function ${name}(${params.join(", ")}) {\n  \n}\n`;
}

export function toRun(m: Measurement, key: string): MeasuredRun | null {
  if (!m.fit) return null;
  return {
    key,
    bigO: m.fit.label,
    basis: m.basis,
    timeBigO: m.timeFit?.label,
    n: m.n,
    variant: m.variant,
    points: m.points.map((p) => ({ n: p.n, ms: p.ms, ...(p.steps !== undefined ? { steps: p.steps } : {}) })),
    stopped: m.stopped,
    at: m.at,
  };
}

export async function saveAttempt(id: string, patch: Partial<Attempt>) {
  const prev = await db.attempts.get(id);
  await db.attempts.put({ id, language: "javascript", code: "", ...prev, ...patch, updatedAt: Date.now() });
}

export async function saveRun(id: string, key: string, run: MeasuredRun) {
  await db.attempts
    .where("id")
    .equals(id)
    .modify((a) => {
      a.runs = { ...a.runs, [key]: run };
    });
  if (!(await db.attempts.get(id))) await db.attempts.put({ id, language: "javascript", code: "", updatedAt: Date.now(), runs: { [key]: run } });
}

/** Does a measured Big-O agree with the one written in the notes? */
export function agrees(measured: string, written?: string): boolean | null {
  if (!written) return null;
  const a = classOf(measured);
  const b = classOf(written);
  return a && b ? a === b : null;
}

/**
 * Ticks the problem off and puts it into revision: makes (or reuses) its DSA
 * Atlas problem, and gives it your code and measured Big-O if it had none.
 */
export async function markSolved(item: ChecklistEntry, attempt: Attempt | undefined, problem: ParsedProblem | null) {
  await setDone(item.id, true);
  const id = await problemFor(item);
  const p = await db.problems.get(id);
  if (!p) return;
  const mine = attempt?.runs?.mine;
  const first = p.approaches[0];
  const empty = !first || first.solutions.every((s) => !s.code.trim());
  const changes = { ...p };
  if (problem?.meta.difficulty && /^(Easy|Medium|Hard)$/.test(problem.meta.difficulty)) changes.difficulty = problem.meta.difficulty as typeof p.difficulty;
  if (problem?.meta.leetcode && !p.url) changes.url = `https://leetcode.com/problems/${leetcodeSlug(item.title)}/`;
  if (empty && attempt?.code.trim()) {
    changes.approaches = [
      {
        id: first?.id ?? "mine",
        kind: "optimal",
        idea: first?.idea ?? "",
        time: mine?.bigO ?? first?.time ?? "",
        space: first?.space ?? "",
        solutions: [{ language: attempt.language, code: attempt.code, languageNotes: "" }],
        ...(mine ? { measured: mine.points.map((pt) => ({ n: pt.n, ms: pt.ms })) } : {}),
      },
      ...p.approaches.slice(1),
    ];
  }
  await saveProblem(changes);
}

/** "Two Sum (Hash Map)" → "two-sum", LeetCode's usual address for a problem. */
export const leetcodeSlug = (title: string) =>
  title
    .replace(/\(.*?\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** 0.0042 → "4.2 µs". */
export const fmtMs = (ms: number) =>
  ms >= 1 ? `${ms.toFixed(ms >= 100 ? 0 : 1)} ms` : ms >= 0.001 ? `${(ms * 1000).toFixed(ms >= 0.01 ? 0 : 1)} µs` : `${Math.max(1, Math.round(ms * 1e6))} ns`;
