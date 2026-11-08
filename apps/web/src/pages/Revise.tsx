import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Eye, PartyPopper } from "lucide-react";
import { isDue } from "@dsa-atlas/review";
import type { Problem, ReviewResult } from "@dsa-atlas/shared";
import { db, reviewProblem } from "../db/db";
import { Link } from "../components/Link";
import { DifficultyBadge } from "../components/Badges";
import { ApproachLadder, SolutionViewer } from "../components/SolutionViewer";
import { REVIEW_KEYS, ReviewBar } from "../components/ReviewBar";

/** Reveal steps for one card: recall first, then hint, idea, code. */
const STEPS = ["recall", "hint", "idea", "code"] as const;
type Step = (typeof STEPS)[number];

/**
 * Revise due problems one at a time, flashcard style.
 * The queue is fixed when the session starts, so rating a card doesn't reshuffle it.
 */
export function Revise() {
  const all = useLiveQuery(() => db.problems.toArray(), []);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<Step>("recall");
  const [results, setResults] = useState<ReviewResult[]>([]);

  useEffect(() => {
    if (all && queue === null) setQueue(all.filter((p) => isDue(p.review)).sort((a, b) => a.review.nextDue - b.review.nextDue).map((p) => p.id));
  }, [all, queue]);

  const byId = useMemo(() => new Map((all ?? []).map((p) => [p.id, p])), [all]);
  const current: Problem | undefined = queue ? byId.get(queue[index]) : undefined;
  const done = queue !== null && index >= queue.length;

  const rate = async (r: ReviewResult) => {
    if (!current) return;
    await reviewProblem(current.id, r);
    setResults((x) => [...x, r]);
    setIndex((i) => i + 1);
    setStep("recall");
  };
  const reveal = () => setStep((s) => STEPS[Math.min(STEPS.indexOf(s) + 1, STEPS.length - 1)]);

  // Keyboard: space/enter reveals the next step; 1/2/3 rate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if ((e.key === " " || e.key === "Enter") && step !== "code") {
        e.preventDefault();
        reveal();
      } else if (REVIEW_KEYS[e.key]) rate(REVIEW_KEYS[e.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!queue) return null;

  if (queue.length === 0)
    return (
      <section className="card center">
        <PartyPopper size={32} aria-hidden />
        <h2>Nothing due right now</h2>
        <p className="muted">You're up to date. Add a new problem or browse your notes.</p>
        <Link to={{ name: "problems" }} className="btn primary">
          Browse problems
        </Link>
      </section>
    );

  if (done) {
    const count = (r: ReviewResult) => results.filter((x) => x === r).length;
    return (
      <section className="card center">
        <PartyPopper size={32} aria-hidden />
        <h2>Session done: {results.length} revised</h2>
        <p className="muted">
          {count("easy")} easy · {count("ok")} got it · {count("forgot")} forgot
        </p>
        <Link to={{ name: "home" }} className="btn primary">
          Back to today
        </Link>
      </section>
    );
  }

  if (!current) return null;
  const shown = STEPS.indexOf(step);
  const best = current.approaches[current.approaches.length - 1];

  return (
    <div className="stack">
      <div className="revise-progress">
        <span className="small muted">
          {index + 1} of {queue.length}
        </span>
        <div className="bar">
          <motion.div className="bar-fill" initial={false} animate={{ scaleX: index / queue.length }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          className="stack"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18 }}
        >
          <section className="card">
            <div className="view-title">
              <h1>{current.title}</h1>
              {current.url && (
                <a className="btn" href={current.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} aria-hidden /> Solve on {current.platform}
                </a>
              )}
            </div>
            <div className="chips">
              <DifficultyBadge d={current.difficulty} />
              {current.topics.map((t) => (
                <span key={t} className="chip quiet">
                  {t}
                </span>
              ))}
            </div>
            {shown === 0 && <p className="muted revise-prompt">Think it through first: what's the brute force, and how do you get to the optimal?</p>}
          </section>

          {shown >= 1 && (
            <motion.section className="card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2>Hint</h2>
              <p>{current.patterns.length ? `Pattern: ${current.patterns.join(", ")}` : "No pattern saved."}</p>
              {best && (
                <p className="muted small">
                  Best known: time <code className="bigo">{best.time}</code>, space <code className="bigo">{best.space}</code>
                </p>
              )}
            </motion.section>
          )}

          {shown >= 2 && (
            <motion.section className="card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2>Approaches</h2>
              <ApproachLadder approaches={current.approaches} selected={best?.id ?? ""} onSelect={() => setStep("code")} />
              {current.notes.trim() && <div className="notes-text small">{current.notes}</div>}
            </motion.section>
          )}

          {shown >= 3 && best && (
            <motion.section className="card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2>Solution</h2>
              <SolutionViewer key={best.id} approach={best} />
            </motion.section>
          )}

          <section className="card sticky-actions">
            {step !== "code" && (
              <button className="btn wide" onClick={reveal}>
                <Eye size={16} aria-hidden /> Show {STEPS[shown + 1] === "hint" ? "hint" : STEPS[shown + 1] === "idea" ? "approaches" : "solution"}
                <kbd>Space</kbd>
              </button>
            )}
            <ReviewBar onReview={rate} showKeys />
          </section>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
