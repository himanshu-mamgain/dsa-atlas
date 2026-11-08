import { lazy, Suspense, useState } from "react";
import { APPROACH_LABELS, LANGUAGE_LABELS, type Approach, type Language } from "@dsa-atlas/shared";
import { BigO } from "./Badges";

const CodeView = lazy(() => import("../editor/CodeView"));

const LANG_KEY = "dsa-atlas:language";

/** Your last-picked language, so lookups open in the language you use. */
export function preferredLanguage(): Language | null {
  try {
    return localStorage.getItem(LANG_KEY) as Language | null;
  } catch {
    return null;
  }
}

function rememberLanguage(l: Language) {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* ignore */
  }
}

export function pickLanguage(a: Approach, wanted: Language | null): Language | undefined {
  return (a.solutions.find((s) => s.language === wanted) ?? a.solutions.find((s) => s.code.trim()) ?? a.solutions[0])?.language;
}

/** Brute → better → optimal as a row of cards; picking one selects it. */
export function ApproachLadder({ approaches, selected, onSelect }: { approaches: Approach[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <ol className="ladder">
      {approaches.map((a, i) => (
        <li key={a.id}>
          <button className={`ladder-card kind-${a.kind}`} aria-pressed={a.id === selected} onClick={() => onSelect(a.id)}>
            <span className="ladder-head">
              <span className="ladder-step">{i + 1}</span>
              <span className={`ladder-kind kind-${a.kind}`}>{APPROACH_LABELS[a.kind]}</span>
            </span>
            <span className="ladder-o">
              <span>
                Time <BigO value={a.time} />
              </span>
              <span>
                Space <BigO value={a.space} />
              </span>
            </span>
            {a.idea && <span className="ladder-idea">{a.idea}</span>}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Language tabs + highlighted code + the language's notes, for one approach. */
export function SolutionViewer({ approach }: { approach: Approach }) {
  const [lang, setLang] = useState<Language | undefined>(() => pickLanguage(approach, preferredLanguage()));
  const solution = approach.solutions.find((s) => s.language === lang) ?? approach.solutions[0];
  if (!solution) return <p className="muted small">No code saved for this approach yet.</p>;

  return (
    <div className="stack-sm">
      <div className="lang-tabs" role="tablist" aria-label="Languages">
        {approach.solutions.map((s) => (
          <button
            key={s.language}
            role="tab"
            aria-selected={s.language === solution.language}
            className="lang-tab"
            onClick={() => {
              setLang(s.language);
              rememberLanguage(s.language);
            }}
          >
            {LANGUAGE_LABELS[s.language]}
          </button>
        ))}
      </div>
      <Suspense fallback={<pre className="code-view">{solution.code}</pre>}>
        <CodeView code={solution.code} language={solution.language} />
      </Suspense>
      {solution.languageNotes && (
        <p className="lang-note small">
          <strong>{LANGUAGE_LABELS[solution.language]}:</strong> {solution.languageNotes}
        </p>
      )}
    </div>
  );
}

export const approachTitle = (a: Approach) => `${APPROACH_LABELS[a.kind]} · ${a.time}`;
