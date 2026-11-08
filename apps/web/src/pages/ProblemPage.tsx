import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ExternalLink, GitCompare, Plus, Trash2, Network } from "lucide-react";
import {
  APPROACH_KINDS,
  APPROACH_LABELS,
  LANGUAGES,
  LANGUAGE_LABELS,
  structuraTopicUrl,
  type Approach,
  type Difficulty,
  type Language,
  type Platform,
  type Problem,
  type ReviewResult,
} from "@dsa-atlas/shared";
import { dueLabel } from "@dsa-atlas/review";
import { db, reviewProblem, saveProblem, uid } from "../db/db";
import { navigate } from "../router";
import { BigO, KindBadge } from "../components/Badges";

// Heavy pieces load only when a problem is opened.
const CodeEditor = lazy(() => import("../editor/CodeEditor"));
const CompareEditor = lazy(() => import("../editor/CodeEditor").then((m) => ({ default: m.CompareEditor })));
const ComplexityGraph = lazy(() => import("../graph/ComplexityGraph"));

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function ProblemPage({ id }: { id: string }) {
  const [p, setP] = useState<Problem | null | undefined>(undefined);
  const [approachId, setApproachId] = useState<string>("");
  const [lang, setLang] = useState<Language>("cpp");
  const [compare, setCompare] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  // Load once; after that this page owns the draft and saves it (debounced).
  useEffect(() => {
    db.problems.get(id).then((found) => {
      setP(found ?? null);
      if (found?.approaches.length) {
        const last = found.approaches[found.approaches.length - 1];
        setApproachId(last.id);
        setLang(last.solutions[0]?.language ?? "cpp");
      }
    });
  }, [id]);

  // Save any pending edit when leaving the page.
  const pending = useRef<Problem | null>(null);
  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      if (pending.current) saveProblem(pending.current);
    },
    [],
  );

  const update = (fn: (p: Problem) => Problem) =>
    setP((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      pending.current = next;
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        pending.current = null;
        saveProblem(next);
      }, 300);
      return next;
    });

  if (p === undefined) return null;
  if (p === null)
    return (
      <div className="card">
        <p>Problem not found.</p>
      </div>
    );

  const approach = p.approaches.find((a) => a.id === approachId) ?? p.approaches[0];
  const solution = approach?.solutions.find((s) => s.language === lang) ?? approach?.solutions[0];

  const updateApproach = (fn: (a: Approach) => Approach) =>
    update((prev) => ({ ...prev, approaches: prev.approaches.map((a) => (a.id === approach.id ? fn(a) : a)) }));

  const addApproach = () => {
    const used = new Set(p.approaches.map((a) => a.kind));
    const kind = APPROACH_KINDS.find((k) => !used.has(k)) ?? "optimal";
    const a: Approach = { id: uid(), kind, idea: "", time: "O(n)", space: "O(1)", solutions: [{ language: lang, code: "", languageNotes: "" }] };
    update((prev) => ({ ...prev, approaches: [...prev.approaches, a] }));
    setApproachId(a.id);
  };

  const addLanguage = (l: Language) => {
    updateApproach((a) => ({ ...a, solutions: [...a.solutions, { language: l, code: "", languageNotes: "" }] }));
    setLang(l);
  };

  const review = async (r: ReviewResult) => {
    window.clearTimeout(saveTimer.current);
    await saveProblem(p);
    await reviewProblem(p.id, r);
    const fresh = await db.problems.get(p.id);
    if (fresh) setP(fresh);
  };

  return (
    <div className="stack">
      {/* Header */}
      <section className="card">
        <input className="title-input" value={p.title} onChange={(e) => update((x) => ({ ...x, title: e.target.value }))} aria-label="Title" />
        <div className="meta-grid">
          <label>
            Difficulty
            <select value={p.difficulty} onChange={(e) => update((x) => ({ ...x, difficulty: e.target.value as Difficulty }))}>
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </label>
          <label>
            Platform
            <select value={p.platform} onChange={(e) => update((x) => ({ ...x, platform: e.target.value as Platform }))}>
              <option>LeetCode</option>
              <option>GFG</option>
              <option>Codeforces</option>
              <option>Other</option>
            </select>
          </label>
          <label className="wide">
            Link
            <span className="with-action">
              <input value={p.url} placeholder="https://leetcode.com/problems/…" onChange={(e) => update((x) => ({ ...x, url: e.target.value }))} />
              {p.url && (
                <a className="btn icon" href={p.url} target="_blank" rel="noreferrer" aria-label="Open problem">
                  <ExternalLink size={16} />
                </a>
              )}
            </span>
          </label>
          <ListField label="Topics" value={p.topics} placeholder="Array, Hashing" onChange={(v) => update((x) => ({ ...x, topics: v }))} />
          <ListField label="Patterns" value={p.patterns} placeholder="Sliding window, Two pointers" onChange={(v) => update((x) => ({ ...x, patterns: v }))} />
          <ListField
            label="Structura topics"
            value={p.structuraTopics}
            placeholder="consistent-hashing, rate-limiter"
            onChange={(v) => update((x) => ({ ...x, structuraTopics: v }))}
          />
        </div>
        {p.structuraTopics.length > 0 && (
          <div className="chips">
            {p.structuraTopics.map((t) => (
              <a key={t} className="chip" href={structuraTopicUrl(t)} target="_blank" rel="noreferrer">
                <Network size={14} aria-hidden /> Structura: {t}
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Approaches */}
      <section className="card">
        <div className="tabs" role="tablist" aria-label="Approaches">
          {p.approaches.map((a) => (
            <button
              key={a.id}
              role="tab"
              aria-selected={a.id === approach?.id}
              className={`tab kind-${a.kind}`}
              onClick={() => {
                setApproachId(a.id);
                if (!a.solutions.some((s) => s.language === lang)) setLang(a.solutions[0]?.language ?? lang);
              }}
            >
              {APPROACH_LABELS[a.kind]}
              <BigO value={a.time} />
              {a.id === approach?.id && <motion.span layoutId="approach-underline" className={`underline kind-${a.kind}`} />}
            </button>
          ))}
          <button className="tab add" onClick={addApproach} aria-label="Add approach">
            <Plus size={16} />
          </button>
        </div>

        {approach && (
          <AnimatePresence mode="wait">
            <motion.div
              key={approach.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="stack-sm"
            >
              <div className="meta-grid">
                <label>
                  Kind
                  <select value={approach.kind} onChange={(e) => updateApproach((a) => ({ ...a, kind: e.target.value as Approach["kind"] }))}>
                    {APPROACH_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {APPROACH_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Time
                  <input className="mono" value={approach.time} onChange={(e) => updateApproach((a) => ({ ...a, time: e.target.value }))} />
                </label>
                <label>
                  Space
                  <input className="mono" value={approach.space} onChange={(e) => updateApproach((a) => ({ ...a, space: e.target.value }))} />
                </label>
                <label className="wide">
                  Key idea
                  <textarea
                    rows={2}
                    value={approach.idea}
                    placeholder="The insight that makes this approach work"
                    onChange={(e) => updateApproach((a) => ({ ...a, idea: e.target.value }))}
                  />
                </label>
              </div>

              <div className="lang-bar">
                <div className="lang-tabs" role="tablist" aria-label="Languages">
                  {approach.solutions.map((s) => (
                    <button
                      key={s.language}
                      role="tab"
                      aria-selected={!compare && s.language === solution?.language}
                      className="lang-tab"
                      onClick={() => {
                        setCompare(false);
                        setLang(s.language);
                      }}
                    >
                      {LANGUAGE_LABELS[s.language]}
                    </button>
                  ))}
                  <select
                    className="lang-add"
                    value=""
                    onChange={(e) => e.target.value && addLanguage(e.target.value as Language)}
                    aria-label="Add language"
                  >
                    <option value="">+ Language</option>
                    {LANGUAGES.filter((l) => !approach.solutions.some((s) => s.language === l)).map((l) => (
                      <option key={l} value={l}>
                        {LANGUAGE_LABELS[l]}
                      </option>
                    ))}
                  </select>
                </div>
                <button className={`btn ${compare ? "primary" : ""}`} onClick={() => setCompare((c) => !c)}>
                  <GitCompare size={16} aria-hidden /> Compare
                </button>
              </div>

              <Suspense fallback={<div className="editor-loading">Loading editor…</div>}>
                {compare ? (
                  <Compare problem={p} />
                ) : (
                  solution && (
                    <>
                      <CodeEditor
                        key={`${approach.id}-${solution.language}`}
                        language={solution.language}
                        value={solution.code}
                        onChange={(code) =>
                          updateApproach((a) => ({
                            ...a,
                            solutions: a.solutions.map((s) => (s.language === solution.language ? { ...s, code } : s)),
                          }))
                        }
                      />
                      <label>
                        {LANGUAGE_LABELS[solution.language]} notes
                        <textarea
                          rows={2}
                          value={solution.languageNotes}
                          placeholder="What's different in this language: library costs, overflow, recursion limits…"
                          onChange={(e) =>
                            updateApproach((a) => ({
                              ...a,
                              solutions: a.solutions.map((s) => (s.language === solution.language ? { ...s, languageNotes: e.target.value } : s)),
                            }))
                          }
                        />
                      </label>
                    </>
                  )
                )}
              </Suspense>

              {p.approaches.length > 1 && (
                <button
                  className="btn danger ghost"
                  onClick={() => {
                    if (!confirm(`Delete the ${APPROACH_LABELS[approach.kind]} approach?`)) return;
                    update((x) => ({ ...x, approaches: x.approaches.filter((a) => a.id !== approach.id) }));
                    setApproachId("");
                  }}
                >
                  <Trash2 size={14} aria-hidden /> Delete approach
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </section>

      {/* Complexity */}
      <section className="card">
        <h2>Time complexity</h2>
        <div className="complexity-table">
          {p.approaches.map((a) => (
            <div key={a.id} className="complexity-row">
              <KindBadge kind={a.kind} />
              <span>
                Time <BigO value={a.time} />
              </span>
              <span>
                Space <BigO value={a.space} />
              </span>
            </div>
          ))}
        </div>
        <Suspense fallback={<div className="editor-loading">Loading graph…</div>}>
          <ComplexityGraph approaches={p.approaches} />
        </Suspense>
      </section>

      {/* Notes */}
      <section className="card">
        <h2>Notes</h2>
        <textarea
          rows={6}
          value={p.notes}
          placeholder="Edge cases, mistakes you made, the trick to remember…"
          onChange={(e) => update((x) => ({ ...x, notes: e.target.value }))}
        />
      </section>

      {/* Revision */}
      <section className="card review">
        <div>
          <h2>Revision</h2>
          <p className="muted small">
            {dueLabel(p.review)} · revised {p.review.history.length} time{p.review.history.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="review-actions">
          <ReviewButton label="Forgot" tone="red" onClick={() => review("forgot")} />
          <ReviewButton label="Got it" tone="yellow" onClick={() => review("ok")} />
          <ReviewButton label="Easy" tone="green" onClick={() => review("easy")} />
        </div>
      </section>

      <button
        className="btn danger ghost"
        onClick={async () => {
          if (!confirm(`Delete "${p.title}"? This can't be undone.`)) return;
          window.clearTimeout(saveTimer.current);
          await db.problems.delete(p.id);
          navigate("/?page=problems");
        }}
      >
        <Trash2 size={14} aria-hidden /> Delete problem
      </button>
    </div>
  );
}

function ListField({ label, value, placeholder, onChange }: { label: string; value: string[]; placeholder: string; onChange: (v: string[]) => void }) {
  // Keep the raw text while typing so commas and spaces aren't eaten.
  const [text, setText] = useState(value.join(", "));
  return (
    <label className="wide">
      {label}
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          onChange(list(e.target.value));
        }}
      />
    </label>
  );
}

function ReviewButton({ label, tone, onClick }: { label: string; tone: string; onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.92 }} className={`btn review-btn tone-${tone}`} onClick={onClick}>
      {label}
    </motion.button>
  );
}

/** Pick any two solutions (approach × language) and diff them. */
function Compare({ problem }: { problem: Problem }) {
  const options = problem.approaches.flatMap((a) =>
    a.solutions.map((s) => ({ key: `${a.id}:${s.language}`, label: `${APPROACH_LABELS[a.kind]} · ${LANGUAGE_LABELS[s.language]}`, s })),
  );
  const [left, setLeft] = useState(options[0]?.key ?? "");
  const [right, setRight] = useState(options[options.length - 1]?.key ?? "");
  const l = options.find((o) => o.key === left)?.s;
  const r = options.find((o) => o.key === right)?.s;

  if (options.length < 2) return <p className="muted">Add a second language or approach to compare.</p>;

  return (
    <div className="stack-sm">
      <div className="compare-pickers">
        <select value={left} onChange={(e) => setLeft(e.target.value)} aria-label="Left side">
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="muted">vs</span>
        <select value={right} onChange={(e) => setRight(e.target.value)} aria-label="Right side">
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {l && r && <CompareEditor left={{ language: l.language, code: l.code }} right={{ language: r.language, code: r.code }} />}
      {l && r && (l.languageNotes || r.languageNotes) && (
        <div className="compare-notes">
          <p className="small">
            <strong>{LANGUAGE_LABELS[l.language]}:</strong> {l.languageNotes || "—"}
          </p>
          <p className="small">
            <strong>{LANGUAGE_LABELS[r.language]}:</strong> {r.languageNotes || "—"}
          </p>
        </div>
      )}
    </div>
  );
}
