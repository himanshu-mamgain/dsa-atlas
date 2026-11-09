import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { ArrowRight, Brain, CalendarCheck, ChevronRight, Flame, Gauge, ListChecks, Plus, Target } from "lucide-react";
import { dueLabel, isDue, streak } from "@dsa-atlas/review";
import { db } from "../db/db";
import { CHECKLIST, CHECKLIST_ITEMS, checklistItem } from "../db/checklist";
import { patternAnchor } from "./Checklist";
import { daysLeft, goalItems, pace } from "../db/goals";
import { Link } from "../components/Link";
import { NewProblem } from "../components/NewProblem";
import { DifficultyBadge } from "../components/Badges";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** A steady colour per pattern, for its ring and tiles. */
export function patternHue(pattern: string) {
  let h = 0;
  for (const c of pattern) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (h + 230) % 360;
}

/** "Arrays & Strings" → "AS", "Trees" → "Tr", "DP" → "DP". */
function initials(pattern: string) {
  const words = pattern.replace(/[^A-Za-z0-9 /&]/g, "").split(/[\s/&]+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  const w = words[0] ?? "?";
  return w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + (w[1] ?? "");
}

/** Today: pattern rings like stories, problems to solve next as tiles, then revision, goals and progress. */
export function Home() {
  const problems = useLiveQuery(() => db.problems.toArray(), []);
  const states = useLiveQuery(() => db.checklist.toArray(), []);
  const goals = useLiveQuery(() => db.goals.orderBy("targetDate").toArray(), []);
  const measured = useLiveQuery(async () => new Map((await db.attempts.toArray()).filter((a) => a.runs?.mine).map((a) => [a.id, a.runs!.mine!.bigO])), []);
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
  // Next to solve: what your goals need first, then the checklist in tier order.
  const fromGoals = nextUp.map((i) => (i.ref.startsWith("c:") ? checklistItem(i.ref.slice(2)) : undefined)).filter((i) => i && !doneSet.has(i.id));
  const upNext = [...new Map([...fromGoals, ...CHECKLIST_ITEMS.filter((i) => !doneSet.has(i.id))].map((i) => [i!.id, i!])).values()].slice(0, 10);
  const rings = CHECKLIST.tiers.flatMap((t) =>
    t.sections.map((s) => ({ tier: t.tier, pattern: s.pattern, total: s.items.length, done: s.items.filter((i) => doneSet.has(i.id)).length })),
  );

  return (
    <div className="page today">
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
          {upNext[0] && (
            <Link to={{ name: "solve", id: upNext[0].id }} className={`btn big-btn${due.length ? "" : " primary"}`}>
              <ListChecks size={18} aria-hidden /> Solve next
            </Link>
          )}
        </div>
      </header>

      <nav className="rings" aria-label="Patterns">
        {rings.map((r) => {
          const pct = r.total ? r.done / r.total : 0;
          return (
            <Link
              key={`${r.tier}-${r.pattern}`}
              to={{ name: "checklist", pattern: r.pattern }}
              className={`ring-link${pct === 1 ? " is-full" : ""}`}
              style={{ ["--p" as string]: `${Math.round(pct * 360)}deg`, ["--hue" as string]: patternHue(r.pattern) }}
              aria-label={`${r.pattern}, tier ${r.tier}: ${r.done} of ${r.total} solved`}
              id={`ring-${patternAnchor(r.tier, r.pattern)}`}
            >
              <span className="ring">
                <span className="ring-face">{initials(r.pattern)}</span>
              </span>
              <span className="ring-label">{r.pattern}</span>
              <span className="ring-count">
                T{r.tier} · {r.done}/{r.total}
              </span>
            </Link>
          );
        })}
      </nav>

      {upNext.length > 0 && (
        <section className="tiles-section" aria-labelledby="up-next">
          <div className="section-head">
            <h2 id="up-next">Up next</h2>
            <Link to={{ name: "checklist" }} className="text-link">
              Checklist <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          <div className="tiles">
            {upNext.map((i, k) => (
              <motion.div key={i.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.03 }}>
                <Link to={{ name: "solve", id: i.id }} className="tile" style={{ ["--hue" as string]: patternHue(i.title) }}>
                  <span className="tile-top">
                    Tier {i.tier} · {i.pattern}
                  </span>
                  <strong className="tile-title">{i.title}</strong>
                  <span className="tile-foot">
                    {measured?.has(i.id) ? (
                      <span className="tile-bigo">
                        <Gauge size={14} aria-hidden /> {measured.get(i.id)}
                      </span>
                    ) : (
                      <span>{i.notion ? "Notes in Notion" : "No notes yet"}</span>
                    )}
                    <span className="tile-go">
                      Solve <ChevronRight size={14} aria-hidden />
                    </span>
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

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
                  <li key={`${i.company}-${i.ref}`}>
                    <Link to={i.checklistId ? { name: "solve", id: i.checklistId } : { name: "problem", id: i.problemId! }} className="row next-row">
                      <span className="row-title">{i.title}</span>
                      <span className="chip quiet">{i.company}</span>
                      <span className="muted small">{i.group}</span>
                    </Link>
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
