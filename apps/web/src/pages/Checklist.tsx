import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { BookOpenText, Check, ExternalLink, FilePlus2, FileText, Lightbulb, ListChecks } from "lucide-react";
import { db } from "../db/db";
import { CHECKLIST, problemFor, setDone, type ChecklistEntry } from "../db/checklist";
import { hrefFor, navigate } from "../router";

type Filter = "all" | "todo" | "done";

/** The Master Checklist from Notion: tiers → patterns → problems, ticked on this device. */
export function Checklist() {
  const states = useLiveQuery(() => db.checklist.toArray(), []);
  const [tier, setTier] = useState(1);
  const [filter, setFilter] = useState<Filter>("todo");

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
              <section key={s.pattern} className="card">
                <div className="card-head">
                  <h2>{s.pattern}</h2>
                  <span className="small muted">
                    {solved}/{s.items.length}
                  </span>
                </div>
                <ul className="check-list">
                  {shown.map((i) => (
                    <CheckRow key={i.id} item={{ ...i, tier: current.tier, pattern: s.pattern }} done={isDone(i.id)} problemId={done.get(i.id)?.problemId} />
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

function CheckRow({ item, done, problemId }: { item: ChecklistEntry; done: boolean; problemId?: string }) {
  return (
    <li className={`check-row${done ? " is-done" : ""}`}>
      <button className="check-box" role="checkbox" aria-checked={done} aria-label={`${item.title}: ${done ? "solved" : "not solved"}`} onClick={() => setDone(item.id, !done)}>
        {done && <Check size={14} strokeWidth={3} />}
      </button>
      <span className="check-title">{item.title}</span>
      <span className="check-actions">
        {item.notion && (
          <a className="btn icon ghost" href={item.notion} target="_blank" rel="noreferrer" title="Notion notes" aria-label={`${item.title} in Notion`}>
            <FileText size={16} />
          </a>
        )}
        <button
          className="btn small-btn"
          onClick={async () => {
            const id = await problemFor(item);
            navigate(hrefFor({ name: "problem", id, edit: !problemId }));
          }}
          title={problemId ? "Open your DSA Atlas notes" : "Start DSA Atlas notes for this problem"}
        >
          {problemId ? "Notes" : (
            <>
              <FilePlus2 size={14} aria-hidden /> Add notes
            </>
          )}
        </button>
      </span>
    </li>
  );
}
