import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { Brain, Flame, CalendarCheck, Layers, Plus } from "lucide-react";
import { dueLabel, isDue, streak } from "@dsa-atlas/review";
import { db } from "../db/db";
import { Link } from "../components/Link";
import { NewProblem } from "../components/NewProblem";
import { DifficultyBadge } from "../components/Badges";

export function Home() {
  const problems = useLiveQuery(() => db.problems.toArray(), []);
  if (!problems) return null;

  const due = problems.filter((p) => isDue(p.review)).sort((a, b) => a.review.nextDue - b.review.nextDue);
  const days = streak(problems.flatMap((p) => p.review.history.map((h) => h.at)));

  const byTopic = new Map<string, { total: number; reviewed: number }>();
  for (const p of problems)
    for (const t of p.topics) {
      const s = byTopic.get(t) ?? { total: 0, reviewed: 0 };
      s.total++;
      if (p.review.lastSeen) s.reviewed++;
      byTopic.set(t, s);
    }
  const topics = [...byTopic.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="stack">
      <section className="stats">
        <Stat icon={<Flame size={20} />} label="Day streak" value={days} tone="orange" />
        <Stat icon={<CalendarCheck size={20} />} label="Due today" value={due.length} tone="green" />
        <Stat icon={<Layers size={20} />} label="Problems" value={problems.length} tone="blue" />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Revise today</h2>
          {due.length > 0 && (
            <Link to={{ name: "revise" }} className="btn primary">
              <Brain size={16} aria-hidden /> Start revision ({due.length})
            </Link>
          )}
        </div>
        {due.length === 0 ? (
          <p className="muted">Nothing due. Add a problem or solve something new.</p>
        ) : (
          <ul className="list">
            {due.map((p, i) => (
              <motion.li key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
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

      {topics.length > 0 && (
        <section className="card">
          <h2>Topics</h2>
          <ul className="topics">
            {topics.map(([t, s]) => (
              <li key={t}>
                <div className="topic-head">
                  <span>{t}</span>
                  <span className="muted small">
                    {s.reviewed}/{s.total} revised
                  </span>
                </div>
                <div className="bar">
                  <motion.div
                    className="bar-fill"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: s.total ? s.reviewed / s.total : 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
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
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className={`stat tone-${tone}`}>
      {icon}
      <div>
        <div className="stat-value">{value}</div>
        <div className="muted small">{label}</div>
      </div>
    </div>
  );
}
