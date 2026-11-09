// Measures a solution's time complexity by running it at n = 2, 4, 8, … (and in
// single steps where the work explodes), on the worst of a few input variants.
// Each run is timed and also counted (loop passes, calls and built-in work, see
// packages/complexity/src/instrument.ts); the Big-O is fitted to the counts,
// which don't wobble the way milliseconds do.
import { fitComplexity, type Entry, type Fit, type InputPlan } from "@dsa-atlas/complexity";
import type { Job, Reply } from "./worker";

export interface Point {
  n: number;
  /** Milliseconds for one call. */
  ms: number;
  /** Steps counted in one call. */
  steps?: number;
}

export interface Measurement {
  points: Point[];
  /** The Big-O, fitted to the steps (or to the times, when the code couldn't be counted). */
  fit: Fit | null;
  basis: "steps" | "time";
  /** The same fit on milliseconds, for comparison. */
  timeFit: Fit | null;
  /** The input variant that was slowest, so the one measured ("all equal"). */
  variant: string;
  /** What n means ("length of nums"). */
  n: string;
  /** Why it stopped growing n. */
  stopped: "size" | "slow" | "timeout" | "stack" | "budget" | "error" | "cancelled";
  error?: string;
  /** Biggest n reached. */
  maxN: number;
  at: number;
}

export interface Target {
  code: string;
  entry: Entry;
  plan: InputPlan;
}

const ROUND_MS = 5;
/** Stop growing n once one call takes this long. */
const SLOW_MS = 120;
/** A single job that takes longer than this is stopped (an O(2ⁿ) run at n = 64, say). */
const TIMEOUT_MS = 3000;
/** The most one measurement may take. */
const BUDGET_MS = 15_000;

type Outcome = Reply | { ok: false; timeout: true };

class Runner {
  private worker: Worker | null = null;
  private seq = 0;

  run(job: Omit<Job, "id">, timeout = TIMEOUT_MS, signal?: AbortSignal): Promise<Outcome> {
    this.worker ??= new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    const worker = this.worker;
    const id = ++this.seq;
    return new Promise((resolve) => {
      const done = (o: Outcome) => {
        clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        signal?.removeEventListener("abort", onAbort);
        resolve(o);
      };
      const onMessage = (e: MessageEvent<Reply>) => e.data.id === id && done(e.data);
      // A run that won't finish can't be interrupted inside the worker: end the worker.
      const kill = () => {
        worker.terminate();
        if (this.worker === worker) this.worker = null;
      };
      const onAbort = () => {
        kill();
        done({ ok: false, timeout: true });
      };
      const timer = setTimeout(() => {
        kill();
        done({ ok: false, timeout: true });
      }, timeout);
      worker.addEventListener("message", onMessage);
      signal?.addEventListener("abort", onAbort);
      worker.postMessage({ ...job, id } satisfies Job);
    });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }
}

const isTimeout = (o: Outcome): o is { ok: false; timeout: true } => !o.ok && "timeout" in o;

export async function measure(target: Target, { onPoint, signal }: { onPoint?: (p: Point[]) => void; signal?: AbortSignal } = {}): Promise<Measurement> {
  const runner = new Runner();
  const started = performance.now();
  const points: Point[] = [];
  const { plan } = target;
  let variant = 0;
  const result = (stopped: Measurement["stopped"], error?: string): Measurement => {
    runner.dispose();
    const counted = points.length > 0 && points.every((p) => p.steps !== undefined);
    const timeFit = fitComplexity(points);
    return {
      points,
      fit: counted ? fitComplexity(points.map((p) => ({ n: p.n, ms: Math.max(p.steps!, 1) }))) : timeFit,
      basis: counted ? "steps" : "time",
      timeFit,
      variant: plan.variants[variant] ?? "",
      n: plan.n,
      stopped,
      error,
      maxN: points.at(-1)?.n ?? 0,
      at: Date.now(),
    };
  };
  const job = (n: number, v = variant, targetMs = ROUND_MS) => ({ code: target.code, entry: target.entry, specs: plan.specs, n, variant: v, seed: 1, targetMs });
  const failed = (o: Outcome) => (isTimeout(o) ? "timeout" : !o.ok ? (o.stack ? "stack" : "error") : null);

  // 1. Does it run at all?
  const check = await runner.run(job(4), TIMEOUT_MS, signal);
  if (signal?.aborted) return result("cancelled");
  if (!check.ok) return result("error", isTimeout(check) ? "It didn't finish on a tiny input. Is there an endless loop?" : check.error);

  // 2. Find the slowest variant at a size where the work shows.
  if (plan.variants.length > 1) {
    let probe = 4;
    for (let n = 8; n <= Math.min(1024, plan.maxN); n *= 2) {
      const o = await runner.run(job(n, 0, 2), 2000, signal);
      if (!o.ok) break;
      probe = n;
      if (o.ms > 0.05) break;
    }
    let slowest = -1;
    for (let v = 0; v < plan.variants.length; v++) {
      if (signal?.aborted) return result("cancelled");
      const o = await runner.run(job(probe, v, 4), 2000, signal);
      if (isTimeout(o)) {
        // Too slow to even finish: this is the worst case.
        variant = v;
        slowest = Infinity;
        break;
      }
      // Counted steps say which input is worst more reliably than time.
      const cost = o.ok ? (o.steps ?? o.ms) : -1;
      if (o.ok && cost > slowest) {
        slowest = cost;
        variant = v;
      }
    }
  }

  // 3. Double n until a call gets slow.
  // Set inside step(); the cast stops TypeScript narrowing it to "size" here.
  let stopped = "size" as Measurement["stopped"];
  let error: string | undefined;
  let badN: number | null = null;
  const add = (n: number, ms: number, steps?: number) => {
    points.push({ n, ms, steps });
    points.sort((a, b) => a.n - b.n);
    onPoint?.([...points]);
  };
  const step = async (n: number): Promise<boolean> => {
    if (signal?.aborted) {
      stopped = "cancelled";
      return false;
    }
    if (performance.now() - started > BUDGET_MS) {
      stopped = "budget";
      return false;
    }
    const o = await runner.run(job(n), TIMEOUT_MS, signal);
    const why = failed(o);
    if (why || !o.ok) {
      stopped = signal?.aborted ? "cancelled" : (why as Measurement["stopped"]);
      if (!o.ok && !isTimeout(o)) error = o.error;
      badN = n;
      return false;
    }
    add(n, o.ms, o.steps);
    if (o.ms > SLOW_MS) {
      stopped = "slow";
      return false;
    }
    return true;
  };

  for (let n = 2; n <= plan.maxN; n *= 2) if (!(await step(n))) break;
  if (signal?.aborted) return result("cancelled");

  // 4. Where time exploded between two sizes (O(2ⁿ), O(n!)), fill in single steps.
  const cost = (p: Point) => p.steps ?? p.ms;
  const big = (p: Point) => (p.steps !== undefined ? p.steps >= 20 : p.ms > 0.001);
  const explosive = points.findIndex((p, i) => i > 0 && cost(p) / cost(points[i - 1]) > 40 && big(points[i - 1]));
  const fill = async (lo: number, hi: number, limit = 8) => {
    const gap = Math.max(1, Math.round((hi - lo) / 8));
    for (let n = lo + gap, k = 0; n < hi && k < limit; n += gap, k++) if (!points.some((p) => p.n === n) && !(await step(n))) return false;
    return true;
  };
  if (explosive > 0) {
    const lo = points[explosive - 1].n;
    const hi = points[explosive].n;
    const gap = Math.max(1, Math.round((hi - lo) / 8));
    // …and keep going past the last size in the same steps while it's quick.
    if (await fill(lo, hi)) for (let n = points.at(-1)!.n + gap, k = 0; k < 6; n += gap, k++) if (!(await step(n))) break;
  } else if (badN !== null && points.length > 0 && (stopped === "timeout" || stopped === "slow") && points.length < 6) {
    await fill(points.at(-1)!.n, badN);
  }
  if (signal?.aborted) return result("cancelled");
  if (points.length < 3) return result(stopped === "size" ? "error" : stopped, error ?? "Too few sizes ran to fit a curve.");
  return result(stopped, error);
}
