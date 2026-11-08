import { type FormEvent, Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, ChevronRight, FileText, KeyRound, Link2, Lock, NotebookPen, Search, Send } from "lucide-react";
import type { Block, NoteFile, NoteMeta, NotesIndex, Problem, Rich } from "@dsa-atlas/shared";
import { canSave, imageSrc, isSealed, loadNote, lockNotes, noteIdIn, notesForProblem, saveNote, searchNotes, unlock, useNotes } from "./notes";
import { hrefFor, navigate } from "../router";

// Your Notion DSA notes in the app: the Notes section (a tree), a reader
// (?note=<id>), the matching notes on each problem, and saving back to Notion.

const openNote = (id: string) => navigate(hrefFor({ name: "note", id }));

const ago = (iso: string) => {
  const days = Math.round((Date.now() - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

function NoteIcon({ note, size = 20 }: { note: NoteMeta; size?: number }) {
  if (!note.icon) return <FileText size={size} aria-hidden />;
  if (/^https?:/.test(note.icon)) return <img src={note.icon} alt="" width={size} height={size} />;
  return <span style={{ fontSize: size, lineHeight: 1 }}>{note.icon}</span>;
}

export function UnlockForm() {
  const notes = useNotes();
  const [pass, setPass] = useState("");
  const [wrong, setWrong] = useState(false);
  const checking = notes.status === "locked" && notes.checking;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pass) return;
    const ok = await unlock(pass);
    setWrong(!ok);
    if (ok) setPass("");
  }

  return (
    <form className="card notes-lock" onSubmit={(e) => void submit(e)}>
      <span className="notes-lock-icon" aria-hidden>
        <Lock size={20} />
      </span>
      <div className="stack-sm">
        <div>
          <strong>Your Notion notes are locked</strong>
          <p className="muted small">Enter the passphrase set in Netlify (NOTION_PASSPHRASE). This browser remembers it.</p>
        </div>
        <div className="inline-form">
          <input
            type="password"
            value={pass}
            onChange={(e) => (setPass(e.target.value), setWrong(false))}
            placeholder="Passphrase"
            aria-label="Passphrase"
            autoComplete="current-password"
          />
          <button type="submit" className="btn primary" disabled={!pass || checking}>
            <KeyRound size={16} aria-hidden /> {checking ? "Checking…" : "Unlock"}
          </button>
        </div>
        {wrong && (
          <span className="small tone-red" role="status">
            That passphrase didn't open them.
          </span>
        )}
      </div>
    </form>
  );
}

/** The Notes section: your Notion DSA page as a tree, with search. */
export function NotesPage() {
  const notes = useNotes();
  const [q, setQ] = useState("");

  if (notes.status === "loading") return <p className="muted">Loading your notes…</p>;
  if (notes.status === "locked") return <UnlockForm />;
  if (notes.status === "none")
    return (
      <section className="card stack-sm">
        <h2>Notion notes aren't set up on this site</h2>
        <p className="muted small">
          Add NOTION_TOKEN, NOTION_ROOT_PAGE_ID and NOTION_PASSPHRASE in Netlify and redeploy. The build then copies your Notion DSA page into the app (see the
          README).
        </p>
      </section>
    );

  const { index } = notes;
  const results = q.trim() ? searchNotes(index, q, 30) : null;
  const top = index.notes.filter((n) => n.parent === null);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <NotebookPen size={14} aria-hidden /> From Notion
          </p>
          <h1>{index.title}</h1>
          <p className="muted">
            {index.notes.length} notes · copied {ago(index.built)}
            {isSealed() && (
              <>
                {" · "}
                <button className="link-btn" onClick={lockNotes}>
                  Lock
                </button>
              </>
            )}
          </p>
        </div>
        <a className="btn" href={index.url} target="_blank" rel="noreferrer">
          <ArrowUpRight size={16} aria-hidden /> Open in Notion
        </a>
      </header>

      <label className="search">
        <Search size={16} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your notes" />
      </label>

      {results ? (
        <ul className="note-list card">
          {results.map((n) => (
            <NoteRow key={n.id} note={n} />
          ))}
          {results.length === 0 && <li className="muted small">No notes match.</li>}
        </ul>
      ) : (
        <div className="notes-grid">
          {top.map((n) => (
            <section key={n.id} className="card">
              <button className="note-section-head" onClick={() => openNote(n.id)}>
                <NoteIcon note={n} size={22} />
                <strong>{n.title}</strong>
                <ChevronRight size={16} aria-hidden />
              </button>
              <ul className="note-list">
                {index.notes
                  .filter((c) => c.parent === n.id)
                  .map((c) => (
                    <NoteRow key={c.id} note={c} childCount={index.notes.filter((g) => g.parent === c.id).length} />
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteRow({ note, childCount = 0 }: { note: NoteMeta; childCount?: number }) {
  return (
    <li>
      <button className="note-row" onClick={() => openNote(note.id)}>
        <span className="note-row-icon">
          <NoteIcon note={note} size={18} />
        </span>
        <span className="note-row-text">
          <strong>{note.title}</strong>
          {note.summary && <span className="muted small">{note.summary}</span>}
        </span>
        {childCount > 0 && <span className="small muted">{childCount}</span>}
        <ChevronRight size={16} aria-hidden />
      </button>
    </li>
  );
}

// ─── On a problem ────────────────────────────────────────────────────────────

/** "From your Notion" on a problem page, plus saving a note back. */
export function ProblemNotes({ problem, linked }: { problem: Problem; linked: string[] }) {
  const notes = useNotes();
  const matches = useMemo(() => (notes.status === "ready" ? notesForProblem(problem, notes.index, linked) : []), [notes, problem, linked]);
  if (notes.status === "none" || notes.status === "loading") return null;

  return (
    <section className="card stack-sm">
      <h2>
        <NotebookPen size={18} aria-hidden /> Your Notion notes
      </h2>
      {notes.status === "locked" ? (
        <UnlockForm />
      ) : (
        <>
          {matches.length === 0 ? (
            <p className="muted small">No Notion page with this title yet.</p>
          ) : (
            <ul className="note-list">
              {matches.map((n) => (
                <NoteRow key={n.id} note={n} />
              ))}
            </ul>
          )}
          {canSave() && <SaveToNotion problem={problem} />}
        </>
      )}
    </section>
  );
}

const draftKey = (p: Problem) => `dsa-atlas:note-draft:${p.id}`;

/** A summary of the problem's approaches, to start a note with. */
function approachesText(p: Problem) {
  return p.approaches
    .map((a) => `- ${a.kind[0].toUpperCase()}${a.kind.slice(1)}: time ${a.time}, space ${a.space}${a.idea ? `. ${a.idea}` : ""}`)
    .join("\n");
}

function SaveToNotion({ problem }: { problem: Problem }) {
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(draftKey(problem)) ?? "";
    } catch {
      return "";
    }
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; url?: string } | null>(null);

  const keep = (v: string) => {
    setText(v);
    try {
      if (v) localStorage.setItem(draftKey(problem), v);
      else localStorage.removeItem(draftKey(problem));
    } catch {
      // Draft not kept.
    }
  };

  return (
    <div className="stack-sm save-notion">
      <label>
        Save a note to Notion
        <textarea rows={4} value={text} onChange={(e) => keep(e.target.value)} placeholder="What clicked, the mistake you made, the invariant…" />
      </label>
      <div className="row-actions">
        <button className="btn" type="button" onClick={() => keep(`${text ? `${text}\n\n` : ""}${approachesText(problem)}`)}>
          Add my approaches
        </button>
        <button
          className="btn primary"
          disabled={!text.trim() || busy}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              const url = await saveNote(problem, text);
              keep("");
              setMsg({ ok: true, text: "Saved to Notion.", url });
            } catch (e) {
              setMsg({ ok: false, text: (e as Error).message });
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send size={16} aria-hidden /> {busy ? "Saving…" : "Save to Notion"}
        </button>
      </div>
      {msg && (
        <p className={`small ${msg.ok ? "tone-green" : "tone-red"}`} role="status">
          {msg.ok && <Check size={14} aria-hidden />} {msg.text}{" "}
          {msg.url && (
            <a href={msg.url} target="_blank" rel="noreferrer">
              Open the page
            </a>
          )}
          {msg.ok && <span className="muted"> It shows up here after the next deploy.</span>}
        </p>
      )}
    </div>
  );
}

// ─── The reader ──────────────────────────────────────────────────────────────

export function NoteView({ id }: { id: string }) {
  const notes = useNotes();
  const [file, setFile] = useState<NoteFile | null>(null);
  const [failed, setFailed] = useState(false);
  const index = notes.status === "ready" ? notes.index : null;
  const note = index?.notes.find((n) => n.id === id);

  useEffect(() => {
    if (!note) return;
    let live = true;
    setFile(null);
    setFailed(false);
    loadNote(note.id).then(
      (f) => live && setFile(f),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [note]);

  if (notes.status === "loading") return <p className="muted">Loading your notes…</p>;
  if (notes.status === "locked") return <UnlockForm />;
  if (!index || !note) return <p className="muted">This note isn't here. It may have been removed or left out in Notion.</p>;

  const parent = note.parent ? index.notes.find((n) => n.id === note.parent) : null;
  const children = index.notes.filter((n) => n.parent === note.id);

  return (
    <article className="note">
      {parent && (
        <button className="note-crumb" onClick={() => openNote(parent.id)}>
          <NoteIcon note={parent} size={14} /> {parent.title}
        </button>
      )}
      <header className="note-head">
        <span className="note-head-icon">
          <NoteIcon note={note} size={34} />
        </span>
        <h1>{note.title}</h1>
        <p className="muted small">
          Edited {ago(note.edited)} · {note.words.toLocaleString()} words ·{" "}
          <a href={note.url} target="_blank" rel="noreferrer">
            Open in Notion <ArrowUpRight size={13} aria-hidden />
          </a>
        </p>
      </header>

      {children.length > 0 && (
        <ul className="note-list card">
          {children.map((n) => (
            <NoteRow key={n.id} note={n} />
          ))}
        </ul>
      )}

      {failed ? (
        <p className="muted">Couldn't load this note. Check your connection and try again.</p>
      ) : !file ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="note-body">
          <Blocks blocks={file.blocks} index={index} />
        </div>
      )}
    </article>
  );
}

function Text({ r, index }: { r: Rich[]; index: NotesIndex }) {
  return (
    <>
      {r.map(([text, marks = "", href], i) => {
        let el: ReactNode = text;
        if (marks.includes("c")) el = <code>{el}</code>;
        if (marks.includes("b")) el = <strong>{el}</strong>;
        if (marks.includes("i")) el = <em>{el}</em>;
        if (marks.includes("s")) el = <s>{el}</s>;
        if (marks.includes("u")) el = <u>{el}</u>;
        if (href) {
          const target = noteIdIn(href, index);
          el = target ? (
            <a
              href={hrefFor({ name: "note", id: target })}
              onClick={(e) => {
                e.preventDefault();
                openNote(target);
              }}
            >
              {el}
            </a>
          ) : (
            <a href={href} target="_blank" rel="noreferrer">
              {el}
            </a>
          );
        }
        return <Fragment key={i}>{el}</Fragment>;
      })}
    </>
  );
}

function NoteImage({ src, caption, index }: { src: string; caption?: Rich[]; index: NotesIndex }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    imageSrc(src).then(
      (u) => live && setUrl(u),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [src]);
  return (
    <figure className="note-figure">
      {url ? <img src={url} alt={caption ? caption.map(([t]) => t).join("") : ""} loading="lazy" /> : <span className="note-figure-wait" />}
      {caption && caption.length > 0 && (
        <figcaption>
          <Text r={caption} index={index} />
        </figcaption>
      )}
    </figure>
  );
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function Blocks({ blocks, index }: { blocks: Block[]; index: NotesIndex }) {
  const sub = (c?: Block[]) => (c?.length ? <Blocks blocks={c} index={index} /> : null);
  const text = (r: Rich[]) => <Text r={r} index={index} />;
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "p":
            return (
              <Fragment key={i}>
                <p>{text(b.r)}</p>
                {b.c && <div className="note-indent">{sub(b.c)}</div>}
              </Fragment>
            );
          case "h1":
          case "h2":
          case "h3": {
            // The page title is the h1, so Notion's headings step down one level.
            const H = b.t === "h1" ? "h2" : b.t === "h2" ? "h3" : "h4";
            return b.c ? (
              <details key={i} className="note-toggle is-heading">
                <summary>
                  <H>{text(b.r)}</H>
                </summary>
                {sub(b.c)}
              </details>
            ) : (
              <H key={i}>{text(b.r)}</H>
            );
          }
          case "quote":
            return (
              <blockquote key={i}>
                {text(b.r)}
                {sub(b.c)}
              </blockquote>
            );
          case "toggle":
            return (
              <details key={i} className="note-toggle">
                <summary>{text(b.r)}</summary>
                {sub(b.c)}
              </details>
            );
          case "ul":
          case "ol": {
            const L = b.t;
            return (
              <L key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    {text(item.r)}
                    {sub(item.c)}
                  </li>
                ))}
              </L>
            );
          }
          case "todo":
            return (
              <ul key={i} className="note-todo">
                {b.items.map((item, j) => (
                  <li key={j} className={item.done ? "is-done" : ""}>
                    <input type="checkbox" checked={Boolean(item.done)} readOnly tabIndex={-1} aria-label={item.done ? "Done" : "Not done"} />
                    <span>
                      {text(item.r)}
                      {sub(item.c)}
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "callout":
            return (
              <div key={i} className="note-callout">
                {b.icon && <span aria-hidden>{b.icon}</span>}
                <div>
                  {text(b.r)}
                  {sub(b.c)}
                </div>
              </div>
            );
          case "code":
            return (
              <figure key={i} className="note-code">
                <pre data-lang={b.lang}>
                  <code>{b.text}</code>
                </pre>
                {b.caption && <figcaption>{b.caption}</figcaption>}
              </figure>
            );
          case "hr":
            return <hr key={i} />;
          case "eq":
            return (
              <p key={i} className="note-eq">
                <code>{b.text}</code>
              </p>
            );
          case "table":
            return (
              <div key={i} className="note-table">
                <table>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => {
                          const Cell = b.head && r === 0 ? "th" : "td";
                          return <Cell key={c}>{text(cell)}</Cell>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "img":
            return <NoteImage key={i} src={b.src} caption={b.caption} index={index} />;
          case "link":
            return (
              <a key={i} className="note-link" href={b.url} target="_blank" rel="noreferrer">
                <Link2 size={16} aria-hidden />
                <span>
                  <strong>{b.title === b.url ? host(b.url) : b.title}</strong>
                  <small>{host(b.url)}</small>
                </span>
              </a>
            );
          case "page": {
            const target = index.notes.find((n) => n.id === b.id);
            return target ? (
              <button key={i} type="button" className="note-page-link" onClick={() => openNote(target.id)}>
                <NoteIcon note={target} size={16} /> {target.title}
              </button>
            ) : null;
          }
        }
      })}
    </>
  );
}
