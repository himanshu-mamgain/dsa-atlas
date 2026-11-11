// Times one solution at one input size, off the main thread so a slow O(2ⁿ)
// run never freezes the page (and can simply be stopped). The code is the
// learner's own, from his editor or his Notion notes; network and storage are
// shadowed anyway, and console.log is muted so it doesn't skew the timing.
import { argsFor, declares, fingerprint, makeInputs, show, toPlain, type ArgShape, type ArgSpec, type Builders, type Entry } from "@dsa-atlas/complexity";
import { chargeBuiltins, instrument, sizeOf } from "@dsa-atlas/complexity/instrument";

export interface Job {
  id: number;
  code: string;
  entry: Entry;
  specs: ArgSpec[];
  n: number;
  variant: number;
  seed: number;
  /** Timed milliseconds to aim for per round. */
  targetMs: number;
}

export type Reply =
  | { id: number; ok: true; ms: number; calls: number; mutates: boolean; steps?: number }
  | { id: number; ok: false; error: string; stack: boolean; compile: boolean };

class ListNode {
  constructor(
    public val = 0,
    public next: ListNode | null = null,
  ) {}
}

class TreeNode {
  constructor(
    public val = 0,
    public left: TreeNode | null = null,
    public right: TreeNode | null = null,
  ) {}
}

const MUTED = ["console", "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "indexedDB", "caches", "importScripts", "postMessage", "close", "navigator"];
const quiet = new Proxy({}, { get: () => () => undefined });

type Compiled = { fn: (...args: unknown[]) => unknown; builders: Builders };
const cache = new Map<string, Compiled>();
/** The counter the instrumented code adds to. */
const steps = { n: 0 };
const spread = (x: unknown) => {
  steps.n += sizeOf(x);
  return x;
};

function compile(code: string, entry: Entry, counted: boolean): Compiled {
  const key = `${counted ? "#" : ""}${entry.className ?? ""}.${entry.name}\n${code}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // The code's own ListNode/TreeNode win; otherwise LeetCode's usual ones are in scope.
  const own = { ListNode: declares(code, "ListNode"), TreeNode: declares(code, "TreeNode") };
  const names = [...(own.ListNode ? [] : ["ListNode"]), ...(own.TreeNode ? [] : ["TreeNode"]), "__steps", "__spread", ...MUTED];
  const values = [...(own.ListNode ? [] : [ListNode]), ...(own.TreeNode ? [] : [TreeNode]), steps, spread, quiet, ...MUTED.slice(1).map(() => undefined)];
  const call = entry.className ? `(...a) => new ${entry.className}().${entry.name}(...a)` : entry.name;
  const source = counted ? instrument(code) : code;
  const body = `${source}\n;return { fn: ${call}, ListNode, TreeNode };`;
  const made = new Function(...names, body)(...values) as { fn: Compiled["fn"]; ListNode: Builders["ListNode"]; TreeNode: Builders["TreeNode"] };
  if (typeof made.fn !== "function") throw new Error(`${entry.name} isn't a function`);
  const compiled = { fn: made.fn, builders: { ListNode: made.ListNode, TreeNode: made.TreeNode } };
  if (cache.size > 8) cache.clear();
  cache.set(key, compiled);
  return compiled;
}

/** Steps for one call at size n, or undefined if the code can't be counted. */
function count(job: Job): number | undefined {
  let counted: Compiled;
  try {
    counted = compile(job.code, job.entry, true);
  } catch {
    return undefined; // not plain JavaScript (TypeScript, say): time only
  }
  const args = makeInputs({ specs: job.specs }, job.n, job.variant, job.seed, counted.builders);
  steps.n = 0;
  const undo = chargeBuiltins(steps);
  try {
    keep(counted.fn(...args));
  } finally {
    undo();
  }
  return steps.n;
}

// Results are folded into this so no engine can skip a call whose answer is unused.
let sink = 0;
const keep = (r: unknown) => {
  sink = (sink + (typeof r === "number" ? r : r ? 1 : 0)) | 0;
};

function time(job: Job): Reply {
  let stage = "compile";
  try {
    const { fn, builders } = compile(job.code, job.entry, false);
    stage = "run";
    const make = (n: number, seed: number) => makeInputs({ specs: job.specs }, n, job.variant, seed, builders);

    // Warm up on small inputs so the JIT has compiled the code before timing.
    const small = Math.min(job.n, 32);
    const warm = performance.now();
    for (let i = 0; i < 200 && performance.now() - warm < 15; i++) keep(fn(...make(small, job.seed + 1000 + i)));

    const first = make(job.n, job.seed);
    const before = fingerprint(first);
    const t0 = performance.now();
    keep(fn(...first));
    const once = performance.now() - t0;
    const mutates = fingerprint(first) !== before;
    if (once >= job.targetMs * 3) return { id: job.id, ok: true, ms: once, calls: 1, mutates, steps: count(job) };

    // Batches of calls, sized so each takes about a millisecond. A solution that
    // changes its input (sorting in place, reversing a list) gets a fresh copy
    // for every call, made outside the timed part; copies are capped at about
    // 200,000 elements a round, since time is only the second opinion here.
    const per = Math.max(once, 0.0002);
    const rounds: number[] = [];
    let calls = 0;
    for (let round = 0; round < (mutates ? 3 : 5); round++) {
      let timed = 0;
      let done = 0;
      if (mutates) {
        const k = Math.max(1, Math.min(Math.ceil(job.targetMs / per), Math.floor(200_000 / Math.max(job.n, 1))));
        const inputs = Array.from({ length: k }, (_, i) => make(job.n, job.seed + 1 + round * k + i));
        const s = performance.now();
        for (const args of inputs) keep(fn(...args));
        timed = performance.now() - s;
        done = k;
      } else {
        const chunk = Math.max(1, Math.min(Math.ceil(1 / per), 100_000));
        while (timed < job.targetMs && done < 2_000_000) {
          const s = performance.now();
          for (let i = 0; i < chunk; i++) keep(fn(...first));
          timed += performance.now() - s;
          done += chunk;
        }
      }
      rounds.push(timed / done);
      calls += done;
    }
    // The fastest round: garbage collection and other tabs only ever add time.
    return { id: job.id, ok: true, ms: Math.min(...rounds), calls, mutates, steps: count(job) };
  } catch (e) {
    const error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return { id: job.id, ok: false, error, stack: e instanceof RangeError && /call stack|recursion/i.test(error), compile: stage === "compile" };
  }
}

// ─── Running the examples (the Run button) ───────────────────────────────────

export interface CheckJob {
  id: number;
  kind: "check";
  code: string;
  entry: Entry;
  cases: { values: unknown[]; shapes: ArgShape[] }[];
}

export interface CaseOutcome {
  /** The result as a plain value (lists and trees as arrays). */
  value?: unknown;
  error?: string;
  ms: number;
  /** What console.log printed, so the learner can debug. */
  logs: string[];
}

export type CheckReply = { id: number; ok: true; cases: CaseOutcome[] } | { id: number; ok: false; error: string };

const logs: string[] = [];
const record = (...a: unknown[]) => void (logs.length < 50 && logs.push(a.map((x) => (typeof x === "string" ? x : show(toPlain(x)))).join(" ")));
/** console.log/info/warn/error are captured for the results; anything else does nothing. */
const capture = new Proxy({}, { get: (_, k) => (k === "log" || k === "info" || k === "warn" || k === "error" || k === "debug" ? record : () => undefined) });
const describe = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

function check(job: CheckJob): CheckReply {
  let made: { fn: (...a: unknown[]) => unknown; builders: Builders };
  try {
    const own = { ListNode: declares(job.code, "ListNode"), TreeNode: declares(job.code, "TreeNode") };
    const names = [...(own.ListNode ? [] : ["ListNode"]), ...(own.TreeNode ? [] : ["TreeNode"]), "console", ...MUTED.slice(1)];
    const values = [...(own.ListNode ? [] : [ListNode]), ...(own.TreeNode ? [] : [TreeNode]), capture, ...MUTED.slice(1).map(() => undefined)];
    const call = job.entry.className ? `(...a) => new ${job.entry.className}().${job.entry.name}(...a)` : job.entry.name;
    const out = new Function(...names, `${job.code}\n;return { fn: ${call}, ListNode, TreeNode };`)(...values) as {
      fn: (...a: unknown[]) => unknown;
      ListNode: Builders["ListNode"];
      TreeNode: Builders["TreeNode"];
    };
    if (typeof out.fn !== "function") throw new Error(`${job.entry.name} isn't a function`);
    made = { fn: out.fn, builders: { ListNode: out.ListNode, TreeNode: out.TreeNode } };
  } catch (e) {
    return { id: job.id, ok: false, error: describe(e) };
  }
  const cases = job.cases.map((c): CaseOutcome => {
    logs.length = 0;
    const t0 = performance.now();
    try {
      const value = toPlain(made.fn(...argsFor(c.values, c.shapes, made.builders)));
      return { value, ms: performance.now() - t0, logs: [...logs] };
    } catch (e) {
      return { error: describe(e), ms: performance.now() - t0, logs: [...logs] };
    }
  });
  return { id: job.id, ok: true, cases };
}

const scope = self as unknown as { onmessage: ((e: MessageEvent<Job | CheckJob>) => void) | null; postMessage(m: unknown): void };
scope.onmessage = (e) => scope.postMessage("kind" in e.data && e.data.kind === "check" ? check(e.data) : time(e.data as Job));
