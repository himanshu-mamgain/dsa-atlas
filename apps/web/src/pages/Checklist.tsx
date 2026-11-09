import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { BookOpenText, Check, ChevronRight, ExternalLink, FileText, Gauge, Lightbulb, ListChecks, NotebookPen } from "lucide-react";
import { db } from "../db/db";
import { CHECKLIST, setDone, type ChecklistEntry } from "../db/checklist";
import { Link } from "../components/Link";

/** An id for a pattern's section, for links from Today's pattern rings. */
export const patternAnchor = (tier: number, pattern: string) => `t${tier}-${pattern.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

type Filter = "all" | "todo" | "done";

/**
 * The Master Checklist from Notion: tiers → patterns → problems, ticked on this
 * device. Each problem opens its solve page. `pattern` opens the checklist at one.
 */
export function Checklist({ pattern }: { pattern?: string }) {
  const states = useLiveQuery(() => db.checklist.toArray(), []);
  const opened = pattern ? CHECKLIST.tiers.find((t) => t.sections.some((s) => s.pattern === pattern)) : undefined;
  const [tier, setTier] = useState(opened?.tier ?? 1);
  const [filter, setFilter] = useState<Filter>(pattern ? "all" : "todo");
  const runs = useLiveQuery(async () => new Set((await db.attempts.toArray()).filter((a) => a.runs?.mine).map((a) => a.id)), []);

  const loaded = states !== undefined;
  useEffect(() => {
    if (pattern && loaded && opened) document.getElementById(patternAnchor(opened.tier, pattern))?.scrollIntoView({ block: "start" });
  }, [pattern, opened, loaded]);

  const done = useMemo(() => new Map((states ?? []).map((s) => [s.id, s])), [states]);
  if (!states) return null;

  const isDone = (id: string) => done.get(id)?.done ?? false;
  const tierStats = CHECKLIST.tiers.map((t) => {
    const items = t.sections.flatMap((s) => s.items);
    return { tier: t.tier, total: items.length, done: items.filter((i) => isDone(i.id)).length };
  });
  const all = tierStats.reduce((a, t) => ({ total: a.total + t.total, done: a.done + t.done }), { total: 0, done: 0 });
  const current = CHECKLIST.tiers.find((t) => t.tier === tier)!;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <ListChecks size={14} aria-hidden /> Master Checklist
          </p>
          <h1>Must-solve problems by pattern</h1>
          <p className="muted">
            {all.done} of {all.total} solved. Aim for Tier 1 first: 2–3 problems a day, for the pattern, not the answer.
          </p>
        </div>
        <a className="btn" href={CHECKLIST.source} target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden /> Open in Notion
        </a>
      </header>

      <div className="tier-tabs" role="tablist" aria-label="Tiers">
        {CHECKLIST.tiers.map((t, i) => {
          const s = tierStats[i];
          return (
            <button key={t.tier} role="tab" aria-selected={t.tier === tier} className="tier-tab" onClick={() => setTier(t.tier)}>
              <span className="tier-name">Tier {t.tier}</span>
              <span className="tier-title">{t.title}</span>
              <span className="tier-progress">
                <span className="bar">
                  <motion.span className="bar-fill" initial={false} animate={{ scaleX: s.total ? s.done / s.total : 0 }} />
                </span>
                <span className="small muted">
                  {s.done}/{s.total}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="checklist-layout">
        <div className="stack">
          <div className="segmented" role="radiogroup" aria-label="Show">
            {(["todo", "all", "done"] as Filter[]).map((f) => (
              <button key={f} role="radio" aria-checked={filter === f} className="segment" onClick={() => setFilter(f)}>
                {f === "todo" ? "To do" : f === "all" ? "All" : "Solved"}
              </button>
            ))}
          </div>

          {current.sections.map((s) => {
            const shown = s.items.filter((i) => filter === "all" || (filter === "done") === isDone(i.id));
            const solved = s.items.filter((i) => isDone(i.id)).length;
            if (shown.length === 0) return null;
            return (
              <section key={s.pattern} id={patternAnchor(current.tier, s.pattern)} className={`card check-section${s.pattern === pattern ? " is-target" : ""}`}>
                <div className="card-head">
                  <h2>{s.pattern}</h2>
                  <span className="small muted">
                    {solved}/{s.items.length}
                  </span>
                </div>
                <ul className="check-list">
                  {shown.map((i) => (
                    <CheckRow key={i.id} item={{ ...i, tier: current.tier, pattern: s.pattern }} done={isDone(i.id)} problemId={done.get(i.id)?.problemId} measured={runs?.has(i.id) ?? false} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <aside className="stack checklist-aside">
          <section className="card">
            <h2>
              <BookOpenText size={18} aria-hidden /> How to practice
            </h2>
            <ol className="practice-steps">
              {CHECKLIST.practice.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </section>
          <section className="card">
            <h2>
              <Lightbulb size={18} aria-hidden /> If the problem mentions…
            </h2>
            <dl className="signals">
              {CHECKLIST.signals.map((s) => (
                <div key={s.when}>
                  <dt>{s.when}</dt>
                  <dd>{s.think}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function CheckRow({ item, done, problemId, measured }: { item: ChecklistEntry; done: boolean; problemId?: string; measured: boolean }) {
  return (
    <li className={`check-row${done ? " is-done" : ""}`}>
      <button className="check-box" role="checkbox" aria-checked={done} aria-label={`${item.title}: ${done ? "solved" : "not solved"}`} onClick={() => setDone(item.id, !done)}>
        {done && <Check size={14} strokeWidth={3} />}
      </button>
      <Link to={{ name: "solve", id: item.id }} className="check-title">
        {item.title}
      </Link>
      <span className="check-actions">
        {measured && (
          <span className="check-flag" title="You measured your solution's complexity">
            <Gauge size={14} aria-label="Measured" />
          </span>
        )}
        {item.notion && (
          <a className="btn icon ghost" href={item.notion} target="_blank" rel="noreferrer" title="Notion page" aria-label={`${item.title} in Notion`}>
            <FileText size={16} />
          </a>
        )}
        {problemId && (
          <Link to={{ name: "problem", id: problemId }} className="btn icon ghost" title="Your DSA Atlas notes" aria-label={`Your notes on ${item.title}`}>
            <NotebookPen size={16} />
          </Link>
        )}
        <Link to={{ name: "solve", id: item.id }} className="btn small-btn solve-btn">
          {done ? "Review" : "Solve"} <ChevronRight size={14} aria-hidden />
        </Link>
      </span>
    </li>
  );
}
