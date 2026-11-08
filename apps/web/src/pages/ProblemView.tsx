import { lazy, Suspense, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { ExternalLink, Network, Pencil, LineChart } from "lucide-react";
import { structuraTopicUrl } from "@dsa-atlas/shared";
import { dueLabel } from "@dsa-atlas/review";
import { db, reviewProblem } from "../db/db";
import { Link } from "../components/Link";
import { DifficultyBadge } from "../components/Badges";
import { ApproachLadder, SolutionViewer } from "../components/SolutionViewer";
import { ReviewBar } from "../components/ReviewBar";

const ComplexityGraph = lazy(() => import("../graph/ComplexityGraph"));

/** The default way to open a problem: a clean summary to look things up and revise. */
export function ProblemView({ id }: { id: string }) {
  const p = useLiveQuery(() => db.problems.get(id), [id], null);
  const [selected, setSelected] = useState<string>("");
  const [reviewed, setReviewed] = useState(false);

  if (p === null) return null;
  if (!p)
    return (
      <div className="card">
        <p>Problem not found.</p>
        <Link to={{ name: "problems" }} className="btn">
          All problems
        </Link>
      </div>
    );

  const approach = p.approaches.find((a) => a.id === selected) ?? p.approaches[p.approaches.length - 1];

  return (
    <div className="stack">
      <section className="card view-head">
        <div className="view-title">
          <h1>{p.title}</h1>
          <div className="view-actions">
            {p.url && (
              <a className="btn" href={p.url} target="_blank" rel="noreferrer">
                <ExternalLink size={16} aria-hidden /> {p.platform}
              </a>
            )}
            <Link to={{ name: "problem", id: p.id, edit: true }} className="btn">
              <Pencil size={16} aria-hidden /> Edit
            </Link>
          </div>
        </div>
        <div className="chips">
          <DifficultyBadge d={p.difficulty} />
          {p.topics.map((t) => (
            <span key={t} className="chip quiet">
              {t}
            </span>
          ))}
          {p.patterns.map((t) => (
            <span key={t} className="chip quiet pattern">
              {t}
            </span>
          ))}
          <span className="muted small">{dueLabel(p.review)}</span>
        </div>
      </section>

      {p.approaches.length > 0 && (
        <section className="card">
          <h2>Approaches</h2>
          <ApproachLadder approaches={p.approaches} selected={approach?.id ?? ""} onSelect={setSelected} />
        </section>
      )}

      {approach && (
        <section className="card">
          <h2>
            Solution <span className={`badge kind-${approach.kind}`}>{approach.kind}</span>
          </h2>
          <SolutionViewer key={approach.id} approach={approach} />
        </section>
      )}

      {p.notes.trim() && (
        <section className="card">
          <h2>Notes</h2>
          <div className="notes-text">{p.notes}</div>
        </section>
      )}

      <details className="card collapsible">
        <summary>
          <LineChart size={18} aria-hidden /> Complexity graph
        </summary>
        <Suspense fallback={<div className="editor-loading">Loading graph…</div>}>
          <ComplexityGraph approaches={p.approaches} />
        </Suspense>
      </details>

      {p.structuraTopics.length > 0 && (
        <section className="card">
          <h2>Related system design</h2>
          <div className="chips">
            {p.structuraTopics.map((t) => (
              <a key={t} className="chip" href={structuraTopicUrl(t)} target="_blank" rel="noreferrer">
                <Network size={14} aria-hidden /> Structura: {t}
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="card review">
        <div>
          <h2>How well do you know it?</h2>
          <p className="muted small">
            {reviewed ? "Saved. " : ""}
            {dueLabel(p.review)} · revised {p.review.history.length} time{p.review.history.length === 1 ? "" : "s"}
          </p>
        </div>
        <motion.div key={p.review.history.length} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}>
          <ReviewBar
            onReview={async (r) => {
              await reviewProblem(p.id, r);
              setReviewed(true);
            }}
          />
        </motion.div>
      </section>
    </div>
  );
}
