import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { Building2, CalendarClock, Check, FilePlus2, FileText, Plus, Target, Trash2, X } from "lucide-react";
import type { Goal } from "@dsa-atlas/shared";
import { db } from "../db/db";
import { CHECKLIST_ITEMS, problemFor, setDone } from "../db/checklist";
import { SUGGESTED_COMPANIES, STARTERS, createGoal, daysLeft, goalItems, pace, starterItems, type GoalItemView, type Starter } from "../db/goals";
import { hrefFor, navigate } from "../router";
import { Link } from "../components/Link";

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function useGoalData() {
  const goals = useLiveQuery(() => db.goals.orderBy("targetDate").toArray(), []);
  const states = useLiveQuery(() => db.checklist.toArray(), []);
  const problems = useLiveQuery(() => db.problems.toArray(), []);
  const maps = useMemo(
    () => ({ states: new Map((states ?? []).map((s) => [s.id, s])), problems: new Map((problems ?? []).map((p) => [p.id, p])) }),
    [states, problems],
  );
  return { goals, ...maps, ready: !!goals && !!states && !!problems };
}

/** Company targets: a set of problems to finish by a date, with the pace needed. */
export function Goals() {
  const d = useGoalData();
  const [creating, setCreating] = useState(false);
  if (!d.ready) return null;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Target size={14} aria-hidden /> Target companies
          </p>
          <h1>Goals</h1>
          <p className="muted">Pick a company and a date. DSA Atlas shows how many problems a day you need and what to solve next.</p>
        </div>
        {!creating && (
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden /> New goal
          </button>
        )}
      </header>

      {(creating || d.goals!.length === 0) && <NewGoal onDone={() => setCreating(false)} existing={d.goals!.map((g) => g.company)} />}

      <div className="goal-grid">
        {d.goals!.map((g) => (
          <GoalCard key={g.id} goal={g} items={goalItems(g, d.states, d.problems)} />
        ))}
      </div>
    </div>
  );
}

function NewGoal({ onDone, existing }: { onDone: () => void; existing: string[] }) {
  const states = useLiveQuery(() => db.checklist.toArray(), []);
  const [company, setCompany] = useState("");
  const [date, setDate] = useState(inDays(30));
  const [starter, setStarter] = useState<Starter>("tier1-todo");
  const count = states ? starterItems(starter, states).length : 0;

  return (
    <section className="card new-goal">
      <h2>
        <Building2 size={18} aria-hidden /> New company goal
      </h2>
      <div className="company-chips">
        {SUGGESTED_COMPANIES.filter((c) => !existing.includes(c)).map((c) => (
          <button key={c} className={`chip-btn${company === c ? " is-on" : ""}`} onClick={() => setCompany(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="meta-grid">
        <label>
          Company
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Any company" />
        </label>
        <label>
          Target date
          <input type="date" value={date} min={inDays(1)} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Start with
          <select value={starter} onChange={(e) => setStarter(e.target.value as Starter)}>
            {STARTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">
        {count} problems from your Master Checklist. Add or remove problems later as you learn what {company || "the company"} asks.
      </p>
      <div className="row-actions">
        <button
          className="btn primary"
          disabled={!company.trim() || !date || !states}
          onClick={async () => {
            await createGoal(company, date, starterItems(starter, states!));
            onDone();
          }}
        >
          <Target size={16} aria-hidden /> Create goal
        </button>
        <button className="btn ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function GoalCard({ goal, items }: { goal: Goal; items: GoalItemView[] }) {
  const done = items.filter((i) => i.done).length;
  const days = daysLeft(goal.targetDate);
  const perDay = pace(items.length - done, days);
  const next = items.filter((i) => !i.done).slice(0, 3);

  return (
    <Link to={{ name: "goal", id: goal.id }} className="card goal-card">
      <div className="goal-top">
        <span className="goal-mark" aria-hidden>
          {goal.company[0]?.toUpperCase()}
        </span>
        <div>
          <h2>{goal.company}</h2>
          <p className="small muted">
            <CalendarClock size={13} aria-hidden /> {new Date(`${goal.targetDate}T00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })} ·{" "}
            {days > 0 ? `${days} days left` : days === 0 ? "today" : `${-days} days over`}
          </p>
        </div>
      </div>
      <div className="goal-progress">
        <div className="bar">
          <motion.div className="bar-fill" initial={false} animate={{ scaleX: items.length ? done / items.length : 0 }} />
        </div>
        <span className="small">
          {done}/{items.length}
        </span>
      </div>
      <p className="goal-pace">{done === items.length ? "All done 🎉" : <><strong>{perDay}</strong> a day to finish on time</>}</p>
      {next.length > 0 && (
        <ul className="goal-next small">
          {next.map((i) => (
            <li key={i.ref}>{i.title}</li>
          ))}
        </ul>
      )}
    </Link>
  );
}

/** One goal: its problems grouped by pattern, tick them off, add more. */
export function GoalPage({ id }: { id: string }) {
  const d = useGoalData();
  const goal = d.goals?.find((g) => g.id === id);
  const [adding, setAdding] = useState(false);
  if (!d.ready) return null;
  if (!goal)
    return (
      <div className="card">
        <p>Goal not found.</p>
        <Link to={{ name: "goals" }} className="btn">
          All goals
        </Link>
      </div>
    );

  const items = goalItems(goal, d.states, d.problems);
  const done = items.filter((i) => i.done).length;
  const days = daysLeft(goal.targetDate);
  const groups = [...new Set(items.map((i) => i.group))];
  const update = (patch: Partial<Goal>) => db.goals.update(goal.id, patch);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Target size={14} aria-hidden /> Goal
          </p>
          <h1>{goal.company}</h1>
          <p className="muted">
            {done} of {items.length} done · {days > 0 ? `${days} days left` : days === 0 ? "due today" : `${-days} days past the date`} ·{" "}
            <strong>{pace(items.length - done, days)}</strong> a day to finish
          </p>
        </div>
        <div className="row-actions">
          <input type="date" aria-label="Target date" value={goal.targetDate} onChange={(e) => e.target.value && update({ targetDate: e.target.value })} />
          <button className="btn" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} aria-hidden /> Add problems
          </button>
        </div>
      </header>

      <div className="bar big">
        <motion.div className="bar-fill" initial={false} animate={{ scaleX: items.length ? done / items.length : 0 }} />
      </div>

      {adding && <AddProblems goal={goal} onClose={() => setAdding(false)} />}

      <section className="card">
        <label>
          Notes about {goal.company}'s interviews
          <textarea rows={2} defaultValue={goal.note} placeholder="Rounds, topics you've heard they ask, people to ask…" onBlur={(e) => update({ note: e.target.value })} />
        </label>
      </section>

      <div className="goal-groups">
        {groups.map((g) => (
          <section key={g} className="card">
            <h2>{g}</h2>
            <ul className="check-list">
              {items
                .filter((i) => i.group === g)
                .map((i) => (
                  <li key={i.ref} className={`check-row${i.done ? " is-done" : ""}`}>
                    {i.checklistId ? (
                      <button className="check-box" role="checkbox" aria-checked={i.done} aria-label={`${i.title}: ${i.done ? "solved" : "not solved"}`} onClick={() => setDone(i.checklistId!, !i.done)}>
                        {i.done && <Check size={14} strokeWidth={3} />}
                      </button>
                    ) : (
                      <span className={`check-box${i.done ? " passive" : ""}`} aria-hidden>
                        {i.done && <Check size={14} strokeWidth={3} />}
                      </span>
                    )}
                    <span className="check-title">{i.title}</span>
                    <span className="check-actions">
                      {i.notion && (
                        <a className="btn icon ghost" href={i.notion} target="_blank" rel="noreferrer" aria-label={`${i.title} in Notion`}>
                          <FileText size={16} />
                        </a>
                      )}
                      <button
                        className="btn small-btn"
                        onClick={async () => {
                          const item = i.checklistId ? CHECKLIST_ITEMS.find((c) => c.id === i.checklistId) : undefined;
                          const pid = i.problemId ?? (item ? await problemFor(item) : undefined);
                          if (pid) navigate(hrefFor({ name: "problem", id: pid, edit: !i.problemId }));
                        }}
                      >
                        {i.problemId ? "Notes" : (
                          <>
                            <FilePlus2 size={14} aria-hidden /> Add notes
                          </>
                        )}
                      </button>
                      <button className="btn icon ghost" aria-label={`Remove ${i.title} from this goal`} onClick={() => update({ items: goal.items.filter((r) => r !== i.ref) })}>
                        <X size={16} />
                      </button>
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
        {items.length === 0 && <p className="muted">No problems yet. Use "Add problems".</p>}
      </div>

      <button
        className="btn danger ghost"
        onClick={async () => {
          if (!confirm(`Delete the ${goal.company} goal? Your checklist ticks and notes stay.`)) return;
          await db.goals.delete(goal.id);
          navigate(hrefFor({ name: "goals" }));
        }}
      >
        <Trash2 size={14} aria-hidden /> Delete goal
      </button>
    </div>
  );
}

function AddProblems({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const problems = useLiveQuery(() => db.problems.toArray(), []);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const have = new Set(goal.items);
  const options = [
    ...CHECKLIST_ITEMS.map((i) => ({ ref: `c:${i.id}`, title: i.title, hint: `Tier ${i.tier} · ${i.pattern}` })),
    ...(problems ?? []).map((p) => ({ ref: `p:${p.id}`, title: p.title, hint: `Your notes · ${p.topics.join(", ") || p.difficulty}` })),
  ]
    .filter((o) => !have.has(o.ref) && (!query || `${o.title} ${o.hint}`.toLowerCase().includes(query)))
    .slice(0, 30);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Add problems to {goal.company}</h2>
        <button className="btn icon ghost" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your checklist and notes: e.g. graph, LRU, DP" autoFocus />
      <ul className="add-list">
        {options.map((o) => (
          <li key={o.ref}>
            <button className="add-option" onClick={() => db.goals.update(goal.id, { items: [...goal.items, o.ref] })}>
              <Plus size={14} aria-hidden />
              <span>
                <strong>{o.title}</strong>
                <span className="muted small">{o.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
