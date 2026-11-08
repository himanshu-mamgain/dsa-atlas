import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import MiniSearch from "minisearch";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, X } from "lucide-react";
import { APPROACH_LABELS, type Problem } from "@dsa-atlas/shared";
import { db } from "../db/db";
import { hrefFor, navigate } from "../router";
import { DifficultyBadge } from "./Badges";

interface Doc {
  id: string;
  title: string;
  tags: string;
  ideas: string;
  notes: string;
  code: string;
}

const toDoc = (p: Problem): Doc => ({
  id: p.id,
  title: p.title,
  tags: [...p.topics, ...p.patterns, p.difficulty, p.platform].join(" "),
  ideas: p.approaches.map((a) => `${APPROACH_LABELS[a.kind]} ${a.time} ${a.idea}`).join(" "),
  notes: [p.notes, ...p.approaches.flatMap((a) => a.solutions.map((s) => s.languageNotes))].join(" "),
  code: p.approaches.flatMap((a) => a.solutions.map((s) => s.code)).join(" "),
});

/** Ctrl/⌘+K: find any problem by title, topic, pattern, idea, note or code. */
export function QuickSearch() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "/" && !(e.target as HTMLElement)?.closest("input, textarea, select, .monaco-editor")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button className="search-trigger" onClick={() => setOpen(true)} aria-label="Search (Ctrl+K)">
        <Search size={16} aria-hidden />
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <AnimatePresence>{open && <Palette onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const problems = useLiveQuery(() => db.problems.toArray(), []);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const index = useMemo(() => {
    const ms = new MiniSearch<Doc>({
      fields: ["title", "tags", "ideas", "notes", "code"],
      storeFields: ["id"],
      searchOptions: { boost: { title: 4, tags: 2, ideas: 1.5 }, prefix: true, fuzzy: 0.2, combineWith: "AND" },
    });
    ms.addAll((problems ?? []).map(toDoc));
    return ms;
  }, [problems]);

  const byId = useMemo(() => new Map((problems ?? []).map((p) => [p.id, p])), [problems]);
  const results = q.trim()
    ? index
        .search(q)
        .slice(0, 20)
        .map((r) => ({ p: byId.get(r.id as string)!, fields: Object.values(r.match).flat() }))
    : (problems ?? [])
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 8)
        .map((p) => ({ p, fields: [] as string[] }));

  useEffect(() => input.current?.focus(), []);
  useEffect(() => setActive(0), [q]);

  const go = (id: string) => {
    onClose();
    navigate(hrefFor({ name: "problem", id }));
  };

  return (
    <motion.div className="palette-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="palette"
        role="dialog"
        aria-label="Search problems"
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -12, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="palette-input">
          <Search size={18} aria-hidden />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles, topics, patterns, ideas, notes, code…"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              }
              if (e.key === "Enter" && results[active]) go(results[active].p.id);
            }}
          />
          <button className="btn icon ghost" onClick={onClose} aria-label="Close search">
            <X size={18} />
          </button>
        </div>
        <ul className="palette-results" role="listbox">
          {!q.trim() && results.length > 0 && <li className="palette-label">Recent</li>}
          {results.map(({ p, fields }, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button className="palette-item" onMouseEnter={() => setActive(i)} onClick={() => go(p.id)}>
                <span className="row">
                  <span className="row-title">{p.title}</span>
                  <DifficultyBadge d={p.difficulty} />
                </span>
                <span className="muted small">
                  {p.topics.join(" · ")}
                  {fields.length > 0 && ` · matched in ${[...new Set(fields)].join(", ")}`}
                </span>
              </button>
            </li>
          ))}
          {q.trim() && results.length === 0 && <li className="palette-label">No matches for "{q}"</li>}
        </ul>
      </motion.div>
    </motion.div>
  );
}
