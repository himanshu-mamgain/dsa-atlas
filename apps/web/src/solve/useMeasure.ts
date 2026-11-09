import { useCallback, useEffect, useRef, useState } from "react";
import { measure, type Point } from "../measure/run";
import { planFor, runKey, saveRun, toRun } from "./solve";

export interface MeasureJob {
  /** "mine" or "ref:<title>". */
  key: string;
  code: string;
  example: string;
  /** The function name to prefer, when the code has several. */
  prefer?: string;
}

export type LiveState = { state: "queued" } | { state: "running"; points: Point[] } | { state: "failed"; reason: string };

/** Runs measurements one after another and saves each result with the attempt. */
export function useMeasure(itemId: string) {
  const [live, setLive] = useState<Record<string, LiveState>>({});
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const run = useCallback(
    async (jobs: MeasureJob[]) => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setLive((l) => ({ ...l, ...Object.fromEntries(jobs.map((j) => [j.key, { state: "queued" } as LiveState])) }));
      for (const job of jobs) {
        if (ctrl.signal.aborted) break;
        const plan = planFor(job.code, job.example, job.prefer);
        if (!plan.ok) {
          setLive((l) => ({ ...l, [job.key]: { state: "failed", reason: plan.reason } }));
          continue;
        }
        setLive((l) => ({ ...l, [job.key]: { state: "running", points: [] } }));
        const m = await measure(
          { code: job.code, entry: plan.entry, plan: plan.plan },
          { signal: ctrl.signal, onPoint: (points) => setLive((l) => ({ ...l, [job.key]: { state: "running", points } })) },
        );
        if (m.stopped === "cancelled") break;
        const saved = toRun(m, runKey(job.code, job.example));
        if (saved) {
          await saveRun(itemId, job.key, saved);
          setLive((l) => {
            const { [job.key]: _done, ...rest } = l;
            return rest;
          });
        } else setLive((l) => ({ ...l, [job.key]: { state: "failed", reason: m.error ?? "It didn't run on enough sizes to tell." } }));
      }
      if (ctrl.signal.aborted)
        setLive((l) => Object.fromEntries(Object.entries(l).filter(([, s]) => s.state === "failed")));
      if (abort.current === ctrl) abort.current = null;
    },
    [itemId],
  );

  const cancel = useCallback(() => abort.current?.abort(), []);
  const busy = Object.values(live).some((s) => s.state === "running" || s.state === "queued");
  return { live, run, cancel, busy };
}
