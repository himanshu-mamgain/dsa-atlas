import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { ArrowLeft, ArrowUpRight, Check, CheckCircle2, ChevronDown, Code2, FileText, Gauge, Lightbulb, ListChecks, Loader2, Play, RotateCcw, Square, TriangleAlert, WandSparkles, XCircle } from "lucide-react";
import { APPROACH_LABELS, LANGUAGE_LABELS, LANGUAGES, type Language, type MeasuredRun, type NoteFile, type NotesIndex } from "@dsa-atlas/shared";
import { db } from "../db/db";
import { checklistItem, setDone, type ChecklistEntry } from "../db/checklist";
import { loadNote, noteIdIn, notesForProblem, useNotes } from "../notes/notes";
import { Blocks, UnlockForm } from "../notes/NotesUI";
import { Link } from "../components/Link";
import { parseProblem, type ParsedProblem, type RefSolution } from "./parse";
import { agrees, fmtMs, leetcodeSlug, markSolved, referenceEntry, refKey, runKey, runnableLang, saveAttempt, starterCode } from "./solve";
import { useMeasure, type LiveState } from "./useMeasure";
import { runTests, type TestRun } from "../measure/tests";
import { canFormat, formatCode } from "../editor/format";
import type { Series } from "./MeasuredGraph";
import "./solve.css";

const CodeEditor = lazy(() => import("../editor/CodeEditor"));
const CodeView = lazy(() => import("../editor/CodeView"));
const MeasuredGraph = lazy(() => import("./MeasuredGraph"));

type Pane = "problem" | "code" | "solutions" | "complexity";

const PANES: [Pane, string, typeof FileText][] = [
  ["problem", "Problem", FileText],
  ["code", "Your code", Code2],
  ["solutions", "Solutions", Lightbulb],
  ["complexity", "Complexity", Gauge],
];

const KIND_COLORS = { brute: ["#f87171", "#fb7185"], better: ["#fbbf24", "#fb923c"], optimal: ["#34d399", "#22d3ee"] } as const;
const MINE_COLOR = "#8b8af9";

function useWide() {
  const query = "(min-width: 1100px)";
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

/** The note for a checklist item: the page it links to, or one with the same title. */
function noteFor(item: ChecklistEntry, index: NotesIndex): string | null {
  return (item.notion ? noteIdIn(item.notion, index) : null) ?? notesForProblem({ title: item.title, notes: "" }, index)[0]?.id ?? null;
}

/** A checklist problem to solve: the statement from Notion, your editor, the reference solutions and their measured complexity. */
export function SolvePage({ id }: { id: string }) {
  const item = checklistItem(id);
  if (!item) {
    return (
      <div className="page">
        <p className="muted">That problem isn't in your checklist.</p>
        <Link to={{ name: "checklist" }} className="btn">
          <ListChecks size={16} aria-hidden /> Back to the checklist
        </Link>
      </div>
    );
  }
  return <Solve item={item} />;
}

function Solve({ item }: { item: ChecklistEntry }) {
  const notes = useNotes();
  const wide = useWide();
  const state = useLiveQuery(() => db.checklist.get(item.id), [item.id]);
  const attempt = useLiveQuery(() => db.attempts.get(item.id), [item.id], null);
  const index = notes.status === "ready" ? notes.index : null;
  const noteId = index ? noteFor(item, index) : null;
  const [file, setFile] = useState<NoteFile | null>(null);
  const [fileError, setFileError] = useState(false);

  useEffect(() => {
    setFile(null);
    setFileError(false);
    if (!noteId) return;
    let live = true;
    loadNote(noteId).then(
      (f) => live && setFile(f),
      () => live && setFileError(true),
    );
    return () => {
      live = false;
    };
  }, [noteId]);

  const problem = useMemo(() => (file ? parseProblem(file.blocks) : null), [file]);
  const noteMeta = index && noteId ? index.notes.find((n) => n.id === noteId) : undefined;
  const [pane, setPane] = useState<Pane>(() => (window.matchMedia("(min-width: 1100px)").matches ? "code" : "problem"));
  const shown: Pane = wide && pane === "problem" ? "code" : pane;

  // Your code: what you typed, else what's saved, else a starter named after the notes' function.
  const [draft, setDraft] = useState<string | null>(null);
  const [exampleDraft, setExampleDraft] = useState<string | null>(null);
  const starter = useMemo(() => starterCode(problem, item.title), [problem, item.title]);
  const code = draft ?? (attempt?.code || starter);
  const example = exampleDraft ?? (attempt?.example || problem?.examples[0]?.input || "");
  const language: Language = attempt?.language ?? "javascript";
  const saveTimer = useRef<number | undefined>(undefined);
  const save = (patch: Parameters<typeof saveAttempt>[1]) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveAttempt(item.id, patch), 400);
  };

  const measurer = useMeasure(item.id);

  // After Run or Measure, bring its result into view (below the editor).
  const resultsRef = useRef<HTMLDivElement>(null);
  const measureCardRef = useRef<HTMLElement>(null);
  const reveal = (el: HTMLElement | null) =>
    requestAnimationFrame(() =>
      el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" }),
    );

  // Run: your function on the problem's examples (or the example you typed, if it has none).
  const [tests, setTests] = useState<TestRun | null>(null);
  const [testing, setTesting] = useState(false);
  const runExamples = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const examples = problem?.examples.length ? problem.examples : example.trim() ? [{ input: example, args: [] }] : [];
      setTests(await runTests(code, examples, referenceEntry(problem)?.name));
    } finally {
      setTesting(false);
      reveal(resultsRef.current);
    }
  };
  // Format: Prettier for JavaScript/TypeScript. A syntax error is shown in the results panel.
  const formatNow = async () => {
    if (!canFormat(language) || !code.trim()) return;
    try {
      const formatted = await formatCode(code, language);
      if (formatted !== code) {
        setDraft(formatted);
        save({ code: formatted, language });
      }
    } catch (e) {
      setTests({ ok: false, error: `Couldn't format: ${(e as Error).message.split("\n")[0]}` });
      reveal(resultsRef.current);
    }
  };

  // Ctrl/⌘+Enter runs the examples, as on LeetCode; Shift+Alt+F formats, as in VS Code.
  const runRef = useRef(runExamples);
  runRef.current = runExamples;
  const formatRef = useRef(formatNow);
  formatRef.current = formatNow;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && e.code === "KeyF") {
        e.preventDefault();
        void formatRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && language === "javascript") {
        e.preventDefault();
        void runRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [language]);
  const prefer = referenceEntry(problem)?.name;
  const runnableRefs = (problem?.solutions ?? []).filter((s) => runnableLang(s.lang));
  const refExample = problem?.examples[0]?.input ?? example;
  const measureMine = () => {
    // Show the card as it starts, so the points can be watched coming in.
    reveal(measureCardRef.current);
    // …and again when it's done, since the card grows with the result.
    return measurer.run([{ key: "mine", code, example, prefer }]).finally(() => reveal(measureCardRef.current));
  };
  const measureRef = (s: RefSolution) => measurer.run([{ key: refKey(s), code: s.code, example: refExample }]);
  const measureAll = () =>
    measurer.run([...(language === "javascript" && code.trim() && code !== starter ? [{ key: "mine", code, example, prefer }] : []), ...runnableRefs.map((s) => ({ key: refKey(s), code: s.code, example: refExample }))]);

  const done = state?.done ?? false;
  const difficulty = problem?.meta.difficulty;
  const leetcode = problem?.meta.leetcode ? `https://leetcode.com/problems/${leetcodeSlug(item.title)}/` : null;
  const notionUrl = item.notion ?? noteMeta?.url;

  return (
    <div className="page solve">
      <header className="solve-head">
        <Link to={{ name: "checklist", pattern: item.pattern }} className="back-link">
          <ArrowLeft size={16} aria-hidden /> {item.pattern}
        </Link>
        <div className="solve-title">
          <div>
            <p className="eyebrow">
              Tier {item.tier} · {problem?.meta.pattern ?? item.pattern}
            </p>
            <h1>{item.title}</h1>
            <div className="chip-row">
              {difficulty && <span className={`badge diff-${difficulty.toLowerCase()}`}>{difficulty}</span>}
              {problem?.meta.blind75 && <span className="chip quiet">Blind 75</span>}
              {leetcode ? (
                <a className="chip link" href={leetcode} target="_blank" rel="noreferrer">
                  {problem?.meta.source} <ArrowUpRight size={12} aria-hidden />
                </a>
              ) : (
                problem?.meta.source && <span className="chip quiet">{problem.meta.source}</span>
              )}
              {notionUrl && (
                <a className="chip link" href={notionUrl} target="_blank" rel="noreferrer">
                  Notion <ArrowUpRight size={12} aria-hidden />
                </a>
              )}
            </div>
          </div>
          <button
            className={`btn big-btn solved-btn${done ? " is-done" : " primary"}`}
            onClick={() => (done ? setDone(item.id, false) : markSolved(item, attempt ?? undefined, problem))}
            aria-pressed={done}
          >
            <Check size={18} aria-hidden /> {done ? "Solved" : "Mark solved"}
          </button>
        </div>
      </header>

      {!wide && <PaneTabs panes={PANES} shown={shown} onPane={setPane} />}

      <div className="solve-grid">
        <section className={`solve-pane solve-problem${shown === "problem" ? " is-on" : ""}`} aria-label="Problem">
          <ProblemPane notes={notes.status} index={index} noteId={noteId} problem={problem} failed={fileError} title={item.title} />
        </section>

        <section className={`solve-pane solve-work${shown !== "problem" ? " is-on" : ""}`}>
          {/* Tabs on the left; language, Run and Measure on the right, above the editor. Sticks while you scroll. */}
          <div className={`work-head${wide ? " is-wide" : ""}`}>
            {wide && <PaneTabs panes={PANES.slice(1)} shown={shown} onPane={setPane} />}
            {shown === "code" && (
              <div className="code-actions" role="toolbar" aria-label="Code">
                <select
                  className="lang-select"
                  aria-label="Language"
                  value={language}
                  onChange={(e) => void saveAttempt(item.id, { language: e.target.value as Language, code })}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {LANGUAGE_LABELS[l]}
                    </option>
                  ))}
                </select>
                <button
                  className="btn icon ghost reset-btn"
                  title={canFormat(language) ? "Format code (Shift+Alt+F)" : `Formatting works for JavaScript and TypeScript, not ${LANGUAGE_LABELS[language]}`}
                  aria-label="Format code"
                  disabled={!canFormat(language) || !code.trim()}
                  onClick={() => void formatNow()}
                >
                  <WandSparkles size={16} aria-hidden />
                </button>
                {/* Always shown (disabled until there's something to reset) so the bar never changes width while you type. */}
                <button
                  className="btn icon ghost reset-btn"
                  title="Reset to the starter code"
                  aria-label="Reset to the starter code"
                  disabled={code === starter}
                  onClick={() => {
                    if (!confirm("Reset to the starter code? Your code on this problem will be replaced.")) return;
                    setDraft(starter);
                    void saveAttempt(item.id, { code: "" });
                  }}
                >
                  <RotateCcw size={16} aria-hidden />
                </button>
                <span className="code-actions-gap" />
                <button
                  className="btn primary small-btn"
                  onClick={runExamples}
                  disabled={language !== "javascript" || testing}
                  title={language !== "javascript" ? "Running works for JavaScript" : "Run the examples (Ctrl+Enter)"}
                >
                  <Play size={14} aria-hidden /> {testing ? "Running…" : "Run"}
                </button>
                {measurer.live.mine?.state === "running" ? (
                  <button className="btn small-btn" onClick={measurer.cancel}>
                    <Square size={14} aria-hidden /> Stop
                  </button>
                ) : (
                  <button
                    className="btn small-btn"
                    onClick={measureMine}
                    disabled={language !== "javascript" || measurer.busy}
                    title="Measure your time complexity on bigger and bigger inputs"
                  >
                    <Gauge size={14} aria-hidden /> Measure
                  </button>
                )}
              </div>
            )}
          </div>
          {shown === "code" && (
            <div className="stack">
              <Suspense fallback={<div className="editor-loading">Loading editor…</div>}>
                <CodeEditor
                  language={language}
                  value={code}
                  height={wide ? 420 : 320}
                  onChange={(v) => {
                    setDraft(v);
                    save({ code: v, language });
                  }}
                />
              </Suspense>
              <div ref={resultsRef} className="scroll-target">
                {(tests || testing) && <TestResults run={tests} running={testing} />}
              </div>
              <section ref={measureCardRef} className="card measure-card scroll-target">
                <div className="card-head">
                  <h2>
                    <Gauge size={18} aria-hidden /> Your complexity
                  </h2>
                </div>
                <label className="example-field">
                  <span className="muted small">Example input to grow from</span>
                  <input
                    value={example}
                    spellCheck={false}
                    placeholder="nums = [2,7,11,15], target = 9"
                    onChange={(e) => {
                      setExampleDraft(e.target.value);
                      save({ example: e.target.value });
                    }}
                  />
                </label>
                {language !== "javascript" ? (
                  <p className="muted small">Measuring runs JavaScript in this browser. Switch the language to JavaScript to measure your code; the solutions from your notes can still be measured.</p>
                ) : (
                  <RunResult run={attempt?.runs?.mine} live={measurer.live.mine} stale={!!attempt?.runs?.mine && attempt.runs.mine.key !== runKey(code, example)} written={problem?.solutions.at(-1)?.time} compareLabel="the optimal solution" idle="Runs your function on bigger and bigger inputs like the example, counts the work it does, and fits the curve." />
                )}
              </section>
            </div>
          )}

          {shown === "solutions" && (
            <SolutionsPane problem={problem} index={index} runs={attempt?.runs} live={measurer.live} busy={measurer.busy} onMeasure={measureRef} example={refExample} noNotes={!noteId} />
          )}

          {shown === "complexity" && (
            <ComplexityPane
              problem={problem}
              runs={attempt?.runs}
              live={measurer.live}
              busy={measurer.busy}
              onMeasureAll={measureAll}
              onCancel={measurer.cancel}
              mineKey={runKey(code, example)}
              refExample={refExample}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function PaneTabs({ panes, shown, onPane }: { panes: typeof PANES; shown: Pane; onPane: (p: Pane) => void }) {
  return (
    <div className="seg solve-tabs" role="tablist" aria-label="Solve">
      {panes.map(([p, label, Icon]) => (
        <button key={p} role="tab" aria-selected={shown === p} onClick={() => onPane(p)}>
          <Icon size={16} aria-hidden /> <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/** "O(n^2)" → "O(n²)". */
const pretty = (bigO?: string) => bigO?.replace(/\^2\b/g, "²").replace(/\^3\b/g, "³").replace(/2\^n\b/g, "2ⁿ").replace(/\s*\*\s*/g, "·");

function ProblemPane({ notes, index, noteId, problem, failed, title }: { notes: string; index: NotesIndex | null; noteId: string | null; problem: ParsedProblem | null; failed: boolean; title: string }) {
  if (notes === "loading") return <p className="muted">Loading your notes…</p>;
  if (notes === "locked") return <UnlockForm />;
  const search = (
    <a className="btn" href={`https://leetcode.com/problems/${leetcodeSlug(title)}/`} target="_blank" rel="noreferrer">
      Find it on LeetCode <ArrowUpRight size={14} aria-hidden />
    </a>
  );
  if (notes === "none" || !index)
    return (
      <div className="card empty-note">
        <p>Your Notion notes aren't built into this site, so there's no statement here.</p>
        {search}
      </div>
    );
  if (!noteId)
    return (
      <div className="card empty-note">
        <p>
          No Notion page for <strong>{title}</strong> yet. Write it under your DSA page and link it in the Master Checklist; it shows up here after the next deploy.
        </p>
        {search}
      </div>
    );
  if (failed) return <p className="muted">Couldn't load the note. Check your connection and open the page again.</p>;
  if (!problem) return <p className="muted">Loading the problem…</p>;
  return (
    <div className="stack">
      <article className="card note-body solve-statement">
        {problem.statement.length ? <Blocks blocks={problem.statement} index={index} /> : <p className="muted">This page has no "Problem" section.</p>}
      </article>
      {problem.sections.length > 0 && (
        <div className="hints">
          <p className="eyebrow">
            <Lightbulb size={14} aria-hidden /> When you're stuck
          </p>
          {problem.sections.map((s) => (
            <details key={s.title} className="card hint">
              <summary>
                <span>{s.title}</span>
                <ChevronDown size={16} aria-hidden />
              </summary>
              <div className="note-body">
                <Blocks blocks={s.blocks} index={index} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

const STOPS: Record<string, string> = {
  stack: "it stopped there because the recursion got deeper than the browser's stack allows",
  slow: "it stopped there because one call took over a tenth of a second",
  timeout: "it stopped there because one call ran for over 3 seconds",
  budget: "it stopped there to keep the run under 15 seconds",
};

function RunResult({ run, live, stale, written, compareLabel, idle }: { run?: MeasuredRun; live?: LiveState; stale: boolean; written?: string; compareLabel: string; idle?: string }) {
  if (live?.state === "queued") return <p className="muted small">Waiting…</p>;
  if (live?.state === "running") {
    const last = live.points.at(-1);
    return (
      <p className="run-progress" role="status">
        <Loader2 size={16} className="spin" aria-hidden /> Measuring{last ? ` · n = ${last.n.toLocaleString()}` : "…"}
      </p>
    );
  }
  if (live?.state === "failed")
    return (
      <p className="run-failed" role="status">
        <TriangleAlert size={16} aria-hidden /> {live.reason}
      </p>
    );
  if (!run) return idle ? <p className="muted small">{idle}</p> : null;
  const match = agrees(run.bigO, written);
  const last = run.points.at(-1);
  return (
    <div className={`run-result${stale ? " is-stale" : ""}`}>
      <div className="run-head">
        <code className="bigo big">{run.bigO}</code>
        {match === true && <span className="chip ok">Same as {compareLabel}</span>}
        {match === false && written && (
          <span className="chip warn">
            {compareLabel[0].toUpperCase() + compareLabel.slice(1)}: {pretty(written)}
          </span>
        )}
        {stale && <span className="chip quiet">Code changed since</span>}
      </div>
      <p className="muted small">
        n = {run.n}, up to {last?.n.toLocaleString()}
        {run.variant && run.variant !== "as is" ? `; slowest input: ${run.variant}` : ""}
        {last ? `; ${fmtMs(last.ms)} a call at the largest n` : ""}
        {STOPS[run.stopped] ? `; ${STOPS[run.stopped]}` : ""}.
      </p>
    </div>
  );
}

function SolutionsPane({
  problem,
  index,
  runs,
  live,
  busy,
  onMeasure,
  example,
  noNotes,
}: {
  problem: ParsedProblem | null;
  index: NotesIndex | null;
  runs?: Record<string, MeasuredRun>;
  live: Record<string, LiveState>;
  busy: boolean;
  onMeasure: (s: RefSolution) => void;
  example: string;
  noNotes: boolean;
}) {
  if (!problem || !index)
    return <p className="muted">{noNotes ? "There are no reference solutions without a Notion page for this problem." : "Loading the solutions…"}</p>;
  if (!problem.solutions.length) return <p className="muted">This page has no "Solution" section with code.</p>;
  return (
    <div className="stack">
      {problem.solutions.map((s, i) => (
        <RefCard key={s.title + i} s={s} index={index} run={runs?.[refKey(s)]} live={live[refKey(s)]} busy={busy} onMeasure={() => onMeasure(s)} example={example} />
      ))}
    </div>
  );
}

function RefCard({ s, index, run, live, busy, onMeasure, example }: { s: RefSolution; index: NotesIndex; run?: MeasuredRun; live?: LiveState; busy: boolean; onMeasure: () => void; example: string }) {
  const [open, setOpen] = useState(false);
  const lang = (LANGUAGES as readonly string[]).includes(s.lang) ? (s.lang as Language) : "javascript";
  const runnable = runnableLang(s.lang);
  return (
    <article className={`card ref-card kind-${s.kind}`}>
      <div className="ref-head">
        <span className={`badge kind-${s.kind}`}>{APPROACH_LABELS[s.kind]}</span>
        <h2>{s.title}</h2>
      </div>
      <div className="ref-complexity">
        <span>
          <span className="muted small">Notes say</span> <code className="bigo">{pretty(s.time) ?? "?"}</code>
          {s.space && (
            <>
              {" "}
              <span className="muted small">time,</span> <code className="bigo">{pretty(s.space)}</code> <span className="muted small">space</span>
            </>
          )}
        </span>
        {runnable && (
          <button className="btn small-btn" onClick={onMeasure} disabled={busy}>
            <Play size={14} aria-hidden /> Measure
          </button>
        )}
      </div>
      {runnable ? (
        <RunResult run={run} live={live} stale={!!run && run.key !== runKey(s.code, example)} written={s.time} compareLabel="the notes" />
      ) : (
        <p className="muted small">Written in {s.lang || "another language"}: only JavaScript runs in the browser, so this one keeps the Big-O from your notes.</p>
      )}
      <button className="reveal" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ChevronDown size={16} aria-hidden /> {open ? "Hide the code" : "Show the code"}
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="stack">
          <Suspense fallback={<pre className="code-fallback">{s.code}</pre>}>
            <CodeView code={s.code} language={lang} />
          </Suspense>
          {s.notes.length > 0 && (
            <div className="note-body">
              <Blocks blocks={s.notes} index={index} />
            </div>
          )}
        </motion.div>
      )}
    </article>
  );
}

function ComplexityPane({
  problem,
  runs,
  live,
  busy,
  onMeasureAll,
  onCancel,
  mineKey,
  refExample,
}: {
  problem: ParsedProblem | null;
  runs?: Record<string, MeasuredRun>;
  live: Record<string, LiveState>;
  busy: boolean;
  onMeasureAll: () => void;
  onCancel: () => void;
  mineKey: string;
  refExample: string;
}) {
  const [metric, setMetric] = useState<"steps" | "ms">("steps");
  const used = { brute: 0, better: 0, optimal: 0 };
  type Row = { key: string; label: string; color: string; written?: string; run?: MeasuredRun; live?: LiveState; stale: boolean; dashed?: boolean };
  const rows: Row[] = [];
  if (runs?.mine || live.mine) rows.push({ key: "mine", label: "Your code", color: MINE_COLOR, run: runs?.mine, live: live.mine, stale: !!runs?.mine && runs.mine.key !== mineKey });
  for (const s of problem?.solutions ?? []) {
    if (!runnableLang(s.lang)) continue;
    const k = refKey(s);
    const color = KIND_COLORS[s.kind][used[s.kind]++ % 2];
    rows.push({ key: k, label: s.title, color, written: s.time, run: runs?.[k], live: live[k], stale: !!runs?.[k] && runs[k].key !== runKey(s.code, refExample), dashed: s.kind !== "optimal" });
  }
  const series: Series[] = rows
    .map((r) => ({ key: r.key, label: r.label, color: r.color, dashed: r.dashed, points: r.live?.state === "running" ? r.live.points : (r.run?.points ?? []) }))
    .filter((s) => s.points.length > 0);
  const nothing = rows.every((r) => !r.run);

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <h2>
            <Gauge size={18} aria-hidden /> Measured complexity
          </h2>
          {busy ? (
            <button className="btn small-btn" onClick={onCancel}>
              <Square size={14} aria-hidden /> Stop
            </button>
          ) : (
            <button className="btn primary small-btn" onClick={onMeasureAll} disabled={!rows.length && !problem}>
              <Play size={14} aria-hidden /> {nothing ? "Measure all" : "Measure again"}
            </button>
          )}
        </div>
        <p className="muted small">
          Each solution runs in the background on inputs like the example, from n = 2 up to a quarter of a million, on whichever input variant is slowest for it (all equal, sorted, a palindrome…). Big-O is
          fitted to the <strong>steps</strong> it takes: loop passes, function calls, and the work inside built-ins like sort and slice. Steps give the same answer every run; time also depends on caches and the
          JIT, so it's shown for comparison.
        </p>
        {series.length > 0 && (
          <>
            <div className="segmented small-seg" role="radiogroup" aria-label="Graph">
              {(["steps", "ms"] as const).map((m) => (
                <button key={m} role="radio" aria-checked={metric === m} className="segment" onClick={() => setMetric(m)}>
                  {m === "steps" ? "Steps" : "Time"}
                </button>
              ))}
            </div>
            <Suspense fallback={<div className="graph-wait" />}>
              <MeasuredGraph series={series} metric={metric} />
            </Suspense>
            <p className="muted small">Both axes are logarithmic: O(n) is a straight line, O(n²) climbs twice as steeply, and O(2ⁿ) curves up.</p>
          </>
        )}
      </section>

      {rows.length > 0 && (
        <section className="card">
          <table className="measure-table">
            <thead>
              <tr>
                <th>Solution</th>
                <th>Notes</th>
                <th>Measured</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const match = r.run ? agrees(r.run.bigO, r.written) : null;
                return (
                  <tr key={r.key}>
                    <td>
                      <span className="dot" style={{ background: r.color }} aria-hidden /> {r.label}
                    </td>
                    <td>{r.written ? <code className="bigo">{pretty(r.written)}</code> : <span className="muted">–</span>}</td>
                    <td>
                      <MeasuredCell r={r} match={match} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      {!problem && <p className="muted small">Open a problem with a Notion page to compare against its solutions.</p>}
    </div>
  );
}

function MeasuredCell({ r, match }: { r: { run?: MeasuredRun; live?: LiveState; stale: boolean }; match: boolean | null }): ReactNode {
  if (r.live?.state === "running") return <Loader2 size={16} className="spin" aria-label="Measuring" />;
  if (r.live?.state === "queued") return <span className="muted small">waiting</span>;
  if (r.live?.state === "failed") return <span className="small tone-red">{r.live.reason}</span>;
  if (!r.run) return <span className="muted">–</span>;
  return (
    <span className="measured-cell">
      <code className="bigo">{r.run.bigO}</code>
      {match === true && <Check size={14} className="tone-green" aria-label="matches the notes" />}
      {match === false && <TriangleAlert size={14} className="tone-orange" aria-label="differs from the notes" />}
      {r.stale && <span className="muted small">(old)</span>}
    </span>
  );
}

/** What Run found: each example's input, the expected output and yours. */
function TestResults({ run, running }: { run: TestRun | null; running: boolean }) {
  const [open, setOpen] = useState(0);
  if (running && !run)
    return (
      <section className="card test-results" aria-live="polite">
        <p className="muted small">
          <Loader2 size={14} className="spin" aria-hidden /> Running the examples…
        </p>
      </section>
    );
  if (!run) return null;
  if (!run.ok)
    return (
      <section className="card test-results is-error" aria-live="polite">
        <h2>
          <TriangleAlert size={18} aria-hidden /> Couldn't run
        </h2>
        <pre className="test-error">{run.error}</pre>
      </section>
    );

  const all = run.total > 0 && run.passed === run.total;
  const current = run.cases[Math.min(open, run.cases.length - 1)];
  return (
    <section className={`card test-results${run.total === 0 ? "" : all ? " is-pass" : " is-fail"}`} aria-live="polite">
      <div className="card-head">
        <h2>
          {run.total === 0 ? <Play size={18} aria-hidden /> : all ? <CheckCircle2 size={18} aria-hidden /> : <XCircle size={18} aria-hidden />}
          {run.total ? `${run.passed}/${run.total} passed` : "Ran (no expected output to compare)"}
        </h2>
        <span className="muted small">
          {run.entry}() · {fmtMs(run.cases.reduce((t, c) => t + (c.ms ?? 0), 0))}
        </span>
      </div>
      <div className="case-tabs" role="tablist" aria-label="Examples">
        {run.cases.map((c, i) => (
          <button key={i} role="tab" aria-selected={i === open} className={`case-tab ${c.verdict ? (c.verdict.pass ? "pass" : "fail") : ""}`} onClick={() => setOpen(i)}>
            {c.verdict ? c.verdict.pass ? <Check size={13} aria-hidden /> : <XCircle size={13} aria-hidden /> : null} Case {i + 1}
          </button>
        ))}
      </div>
      {current && (
        <dl className="case">
          <dt>Input</dt>
          <dd>
            <code>{current.input}</code>
          </dd>
          {current.expected !== undefined && (
            <>
              <dt>Expected</dt>
              <dd>
                <code>{current.expected}</code>
              </dd>
            </>
          )}
          <dt>{current.error ? "Error" : "Your output"}</dt>
          <dd>
            {current.error ? (
              <pre className="test-error">{current.error}</pre>
            ) : (
              <code className={current.verdict ? (current.verdict.pass ? "is-pass" : "is-fail") : ""}>{current.got}</code>
            )}
            {current.verdict?.pass && current.verdict.anyOrder && <span className="muted small"> (same answer, different order)</span>}
          </dd>
          {current.logs.length > 0 && (
            <>
              <dt>console.log</dt>
              <dd>
                <pre className="case-logs">{current.logs.join("\n")}</pre>
              </dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}
