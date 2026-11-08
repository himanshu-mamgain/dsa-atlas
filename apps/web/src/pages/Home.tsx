import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { ArrowRight, Brain, CalendarCheck, Flame, ListChecks, Plus, Target } from "lucide-react";
import { dueLabel, isDue, streak } from "@dsa-atlas/review";
import { db } from "../db/db";
import { CHECKLIST } from "../db/checklist";
import { daysLeft, goalItems, pace } from "../db/goals";
import { Link } from "../components/Link";
import { NewProblem } from "../components/NewProblem";
import { DifficultyBadge } from "../components/Badges";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** The dashboard: what to revise, how your goals are going, and checklist progress. */
export function Home() {
  const problems = useLiveQuery(() => db.problems.toArray(), []);
  const states = useLiveQuery(() => db.checklist.toArray(), []);
  const goals = useLiveQuery(() => db.goals.orderBy("targetDate").toArray(), []);
  const maps = useMemo(
    () => ({ states: new Map((states ?? []).map((s) => [s.id, s])), problems: new Map((problems ?? []).map((p) => [p.id, p])) }),
    [states, problems],
  );
  if (!problems || !states || !goals) return null;

  const due = problems.filter((p) => isDue(p.review)).sort((a, b) => a.review.nextDue - b.review.nextDue);
  const days = streak(problems.flatMap((p) => p.review.history.map((h) => h.at)));
  const solved = states.filter((s) => s.done).length;
  const goalViews = goals.map((g) => {
    const items = goalItems(g, maps.states, maps.problems);
    const done = items.filter((i) => i.done).length;
    const left = daysLeft(g.targetDate);
    return { g, items, done, left, perDay: pace(items.length - done, left) };
  });
  const todayTarget = goalViews.reduce((n, v) => n + (v.done < v.items.length ? v.perDay : 0), 0);
  const nextUp = goalViews.flatMap((v) => v.items.filter((i) => !i.done).slice(0, 2).map((i) => ({ ...i, company: v.g.company }))).slice(0, 5);
  const doneSet = new Set(states.filter((s) => s.done).map((s) => s.id));

  return (
    <div className="page">
      <header className="hero">
        <div>
          <h1>{greeting()} 👋</h1>
          <p className="muted">
            {due.length > 0 ? `${due.length} problem${due.length === 1 ? "" : "s"} to revise` : "Nothing to revise"}
            {todayTarget > 0 ? ` · ${todayTarget} new to solve for your goals` : ""}
          </p>
        </div>
        <div className="row-actions">
          {due.length > 0 && (
            <Link to={{ name: "revise" }} className="btn primary big-btn">
              <Brain size={18} aria-hidden /> Start revision
            </Link>
          )}
          <Link to={{ name: "checklist" }} className="btn big-btn">
            <ListChecks size={18} aria-hidden /> Checklist
          </Link>
        </div>
      </header>

      <section className="stat-row">
        <Stat icon={<Flame size={20} />} label="Day streak" value={days} tone="orange" />
        <Stat icon={<CalendarCheck size={20} />} label="Due today" value={due.length} tone="green" />
        <Stat icon={<ListChecks size={20} />} label="Checklist solved" value={`${solved}/${states.length}`} tone="blue" />
        <Stat icon={<Target size={20} />} label="Goals" value={goals.length} tone="violet" />
      </section>

      <div className="dash-grid">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Revise today</h2>
              {due.length > 0 && (
                <Link to={{ name: "revise" }} className="text-link">
                  Start <ArrowRight size={14} aria-hidden />
                </Link>
              )}
            </div>
            {due.length === 0 ? (
              <p className="muted">Nothing due. Solve something new from your checklist.</p>
            ) : (
              <ul className="list">
                {due.slice(0, 8).map((p, i) => (
                  <motion.li key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <Link to={{ name: "problem", id: p.id }} className="row">
                      <span className="row-title">{p.title}</span>
                      <DifficultyBadge d={p.difficulty} />
                      <span className="muted small">{dueLabel(p.review)}</span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </section>

          {nextUp.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>Next up for your goals</h2>
              </div>
              <ul className="list">
                {nextUp.map((i) => (
                  <li key={`${i.company}-${i.ref}`} className="row next-row">
                    <span className="row-title">{i.title}</span>
                    <span className="chip quiet">{i.company}</span>
                    <span className="muted small">{i.group}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <h2>
              <Plus size={18} aria-hidden /> Add a problem
            </h2>
            <NewProblem />
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Goals</h2>
              <Link to={{ name: "goals" }} className="text-link">
                {goals.length ? "All goals" : "Set a goal"} <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
            {goalViews.length === 0 ? (
              <p className="muted small">Target a company (GoKwik, ixigo, Cars24…) with a date, and see the pace you need.</p>
            ) : (
              <ul className="goal-mini">
                {goalViews.map((v) => (
                  <li key={v.g.id}>
                    <Link to={{ name: "goal", id: v.g.id }} className="goal-mini-row">
                      <span className="goal-mark sm" aria-hidden>
                        {v.g.company[0]?.toUpperCase()}
                      </span>
                      <span className="goal-mini-body">
                        <span className="row">
                          <strong className="row-title">{v.g.company}</strong>
                          <span className="small muted">{v.left > 0 ? `${v.left}d` : "due"}</span>
                        </span>
                        <span className="bar">
                          <motion.span className="bar-fill" initial={false} animate={{ scaleX: v.items.length ? v.done / v.items.length : 0 }} />
                        </span>
                        <span className="small muted">
                          {v.done}/{v.items.length} · {v.perDay}/day
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Master Checklist</h2>
              <Link to={{ name: "checklist" }} className="text-link">
                Open <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
            <ul className="topics">
              {CHECKLIST.tiers.map((t) => {
                const items = t.sections.flatMap((s) => s.items);
                const d = items.filter((i) => doneSet.has(i.id)).length;
                return (
                  <li key={t.tier}>
                    <div className="topic-head">
                      <span>
                        Tier {t.tier} <span className="muted small">· {t.title}</span>
                      </span>
                      <span className="muted small">
                        {d}/{items.length}
                      </span>
                    </div>
                    <div className="bar">
                      <motion.div className="bar-fill" initial={{ scaleX: 0 }} animate={{ scaleX: items.length ? d / items.length : 0 }} transition={{ duration: 0.6 }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone: string }) {
  return (
    <div className={`stat tone-${tone}`}>
      <span className="stat-icon">{icon}</span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="muted small">{label}</div>
      </div>
    </div>
  );
}
