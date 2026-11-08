import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "motion/react";
import { ExternalLink, Network, Search, X } from "lucide-react";
import { ecoLinks } from "@dsa-atlas/shared";
import { dueLabel, isDue } from "@dsa-atlas/review";
import { structuraTitle } from "../structura";
import { db } from "../db/db";
import { Link } from "../components/Link";
import { BigO, DifficultyBadge } from "../components/Badges";
import { NewProblem } from "../components/NewProblem";

export function ProblemList({ structura }: { structura?: string }) {
  const problems = useLiveQuery(() => db.problems.orderBy("updatedAt").reverse().toArray(), []);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [dueOnly, setDueOnly] = useState(false);

  const topics = useMemo(() => [...new Set((problems ?? []).flatMap((p) => p.topics))].sort(), [problems]);

  const shown = (problems ?? []).filter((p) => {
    const q = query.toLowerCase();
    const text = [p.title, ...p.topics, ...p.patterns].join(" ").toLowerCase();
    return (
      (!structura || p.structuraTopics.includes(structura)) &&
      (!q || text.includes(q)) &&
      (!topic || p.topics.includes(topic)) &&
      (!dueOnly || isDue(p.review))
    );
  });

  return (
    <div className="stack">
      {structura && (
        <section className="card eco-banner">
          <Network size={20} aria-hidden />
          <div>
            <p className="small muted">From Structura</p>
            <h2>Problems related to {structuraTitle(structura)}</h2>
            {problems && shown.length === 0 && (
              <p className="small muted">None yet. Open a problem, choose Edit, and add "{structuraTitle(structura)}" under Related Structura topics.</p>
            )}
          </div>
          <div className="eco-banner-actions">
            <a className="btn" href={ecoLinks.structuraTopic(structura)} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden /> Back to topic
            </a>
            <Link to={{ name: "problems" }} className="btn ghost">
              <X size={16} aria-hidden /> Show all
            </Link>
          </div>
        </section>
      )}
      <div className="filters">
        <label className="search">
          <Search size={16} aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, topic, pattern" />
        </label>
        <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic">
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} /> Due
        </label>
      </div>

      <ul className="list cards">
        <AnimatePresence initial={false}>
          {shown.map((p) => {
            const best = [...p.approaches].reverse()[0];
            return (
              <motion.li key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Link to={{ name: "problem", id: p.id }} className="problem-card">
                  <div className="row">
                    <span className="row-title">{p.title}</span>
                    <DifficultyBadge d={p.difficulty} />
                  </div>
                  <div className="row small">
                    <span className="muted">{p.topics.join(" · ") || "No topics yet"}</span>
                    {best && (
                      <span className="spacer">
                        <BigO value={best.time} />
                      </span>
                    )}
                    <span className="muted">{dueLabel(p.review)}</span>
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {problems && shown.length === 0 && <p className="muted">No problems match.</p>}

      <section className="card">
        <h2>Add a problem</h2>
        <NewProblem />
      </section>
    </div>
  );
}
