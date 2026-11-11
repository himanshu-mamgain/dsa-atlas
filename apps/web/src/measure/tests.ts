// The Run button: calls your function on the problem's examples in the measuring
// worker (off the main thread, network and storage shadowed) and judges each
// answer against the expected output.
import { judge, parseArgs, pickEntry, planInputs, shapesOf, show, type Example, type Verdict } from "@dsa-atlas/complexity";
import type { CaseOutcome, CheckJob, CheckReply } from "./worker";

export interface TestCase {
  input: string;
  expected?: string;
  got?: string;
  error?: string;
  verdict?: Verdict;
  ms?: number;
  logs: string[];
}

export type TestRun = { ok: true; cases: TestCase[]; passed: number; total: number; entry: string } | { ok: false; error: string };

const TIMEOUT_MS = 4000;

/** Runs the code on every example (all with the same number of inputs as the first). */
export async function runTests(code: string, examples: Example[], prefer?: string): Promise<TestRun> {
  if (!code.trim()) return { ok: false, error: "Write a solution first." };
  const usable = examples.filter((e) => e.input.trim());
  if (!usable.length) return { ok: false, error: "This problem has no examples to run yet. Add an example input below the editor to measure instead." };
  const argCount = parseArgs(usable[0].input).length;
  const entry = pickEntry(code, argCount, prefer);
  if (!entry) return { ok: false, error: `Couldn't find a function taking ${argCount} input${argCount === 1 ? "" : "s"}. Name the function you want run, with ${argCount} parameter${argCount === 1 ? "" : "s"}.` };

  const cases = usable.map((e) => {
    const args = parseArgs(e.input);
    const plan = planInputs(entry.params, args, code);
    return { values: args.map((a) => a.value), shapes: shapesOf(plan?.specs, args.length) };
  });

  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const reply = await new Promise<CheckReply | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), TIMEOUT_MS);
    worker.onmessage = (e: MessageEvent<CheckReply>) => {
      clearTimeout(timer);
      resolve(e.data);
    };
    worker.postMessage({ id: 1, kind: "check", code, entry, cases } satisfies CheckJob);
  });
  worker.terminate();

  if (!reply) return { ok: false, error: `Stopped after ${TIMEOUT_MS / 1000}s: an infinite loop or recursion that never ends?` };
  if (!reply.ok) return { ok: false, error: reply.error };

  const results = reply.cases.map((c: CaseOutcome, i): TestCase => {
    const e = usable[i];
    const base = { input: e.input, expected: e.output, ms: c.ms, logs: c.logs };
    if (c.error) return { ...base, error: c.error, verdict: { pass: false } };
    const got = show(c.value);
    return { ...base, got, verdict: e.output ? judge(c.value, e.output) : undefined };
  });
  return { ok: true, cases: results, passed: results.filter((r) => r.verdict?.pass).length, total: results.filter((r) => r.verdict).length, entry: entry.name };
}
