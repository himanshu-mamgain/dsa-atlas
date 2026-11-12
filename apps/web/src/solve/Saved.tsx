import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FileCode2, Loader2, Pencil, Save, Trash2, X } from "lucide-react";
import { LANGUAGE_LABELS, type Language, type SavedSolution } from "@dsa-atlas/shared";
import { deleteSolution, freshName, renameSolution } from "./solve";

const CodeView = lazy(() => import("../editor/CodeView"));

const when = (t: number) => {
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/** Under the toolbar: what you're editing, autosave, and your saved solutions to switch to. */
export function EditorStatus({
  saved,
  current,
  dirty,
  saving,
  onOpen,
}: {
  saved: SavedSolution[];
  current?: SavedSolution;
  dirty: boolean;
  saving: boolean;
  onOpen: (s: SavedSolution) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="editor-status">
      <span className="editor-status-name">
        <FileCode2 size={14} aria-hidden />
        {current ? <strong>{current.name}</strong> : <span className="muted">Draft</span>}
        {current && dirty && <span className="muted small"> · unsaved changes</span>}
      </span>
      <span className="muted small autosave" aria-live="polite">
        {saving ? (
          <>
            <Loader2 size={12} className="spin" aria-hidden /> Saving…
          </>
        ) : (
          <>
            <Check size={12} aria-hidden /> Autosaved on this device
          </>
        )}
      </span>
      {saved.length > 0 && (
        <div className="saved-menu" ref={ref}>
          <button className="btn ghost small-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            My solutions ({saved.length}) <ChevronDown size={14} aria-hidden />
          </button>
          {open && (
            <ul className="saved-menu-list" role="menu">
              {saved.map((s) => (
                <li key={s.id}>
                  <button
                    role="menuitem"
                    className={`saved-menu-item${s.id === current?.id ? " is-on" : ""}`}
                    onClick={() => {
                      setOpen(false);
                      onOpen(s);
                    }}
                  >
                    <strong>{s.name}</strong>
                    <span className="muted small">
                      {LANGUAGE_LABELS[s.language]} · {when(s.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Save the editor's code under a name (or update the one it was opened from). */
export function SavePanel({
  saved,
  current,
  onSave,
  onClose,
}: {
  saved: SavedSolution[];
  current?: SavedSolution;
  onSave: (name: string, asNew: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(() => current?.name ?? freshName(saved));
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const clash = saved.some((s) => s.name.toLowerCase() === name.trim().toLowerCase() && s.id !== current?.id);
  const submit = async (asNew: boolean) => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onSave(asNew && clash ? freshName(saved, name.trim()) : name.trim(), asNew);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="card save-panel"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(!current);
      }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <label className="save-name">
        <span className="muted small">Name this solution</span>
        <input ref={input} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Brute force, Two pointers, Optimal…" />
      </label>
      <div className="row-actions">
        {current ? (
          <>
            <button type="submit" className="btn primary small-btn" disabled={!name.trim() || busy}>
              <Save size={14} aria-hidden /> Update "{current.name}"
            </button>
            <button type="button" className="btn small-btn" disabled={!name.trim() || busy} onClick={() => void submit(true)}>
              Save as new
            </button>
          </>
        ) : (
          <button type="submit" className="btn primary small-btn" disabled={!name.trim() || busy}>
            <Save size={14} aria-hidden /> Save
          </button>
        )}
        <button type="button" className="btn ghost icon" aria-label="Cancel" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {clash && !current && <p className="muted small">A solution with this name exists; it will be saved as "{freshName(saved, name.trim())}".</p>}
    </form>
  );
}

/** The Solutions tab: your saved solutions, above the ones from your notes. */
export function SavedList({ problemId, saved, currentId, onOpen }: { problemId: string; saved: SavedSolution[]; currentId?: string; onOpen: (s: SavedSolution) => void }) {
  if (!saved.length)
    return (
      <section className="card saved-empty">
        <h2>
          <Save size={18} aria-hidden /> Your solutions
        </h2>
        <p className="muted small">Write a solution in Your code and press Save (or Ctrl+S) to keep it here under a name, like "Brute force" or "Optimal".</p>
      </section>
    );
  return (
    <section className="card">
      <h2>
        <Save size={18} aria-hidden /> Your solutions
      </h2>
      <ul className="saved-list">
        {saved.map((s) => (
          <SavedItem key={s.id} problemId={problemId} s={s} isCurrent={s.id === currentId} onOpen={() => onOpen(s)} />
        ))}
      </ul>
    </section>
  );
}

function SavedItem({ problemId, s, isCurrent, onOpen }: { problemId: string; s: SavedSolution; isCurrent: boolean; onOpen: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(s.name);
  return (
    <li className="saved-item">
      <div className="saved-item-head">
        {renaming ? (
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              await renameSolution(problemId, s.id, name);
              setRenaming(false);
            }}
          >
            <input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="New name" />
            <button className="btn small-btn" type="submit">
              Rename
            </button>
          </form>
        ) : (
          <div>
            <strong>{s.name}</strong>
            {isCurrent && <span className="chip quiet">in the editor</span>}
            <p className="muted small">
              {LANGUAGE_LABELS[s.language as Language]} · saved {when(s.updatedAt)} · {s.code.split("\n").length} lines
            </p>
          </div>
        )}
        <div className="row-actions">
          <button className="btn primary small-btn" onClick={onOpen}>
            Open in editor
          </button>
          <button className="btn icon ghost" aria-label={`Rename ${s.name}`} onClick={() => setRenaming((r) => !r)}>
            <Pencil size={15} />
          </button>
          <button
            className="btn icon ghost"
            aria-label={`Delete ${s.name}`}
            onClick={() => confirm(`Delete "${s.name}"? This can't be undone.`) && void deleteSolution(problemId, s.id)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <details className="saved-code">
        <summary className="small">Show code</summary>
        <Suspense fallback={<pre className="code-view">{s.code}</pre>}>
          <CodeView code={s.code} language={s.language} />
        </Suspense>
      </details>
    </li>
  );
}
