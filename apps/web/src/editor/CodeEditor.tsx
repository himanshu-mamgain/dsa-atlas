import { useRef } from "react";
import Editor, { DiffEditor, type OnMount } from "@monaco-editor/react";
import type { Language } from "@dsa-atlas/shared";
import "./monaco";

type Ed = Parameters<OnMount>[0];

const isNarrow = () => window.matchMedia("(max-width: 640px)").matches;

const baseOptions = () => ({
  fontSize: isNarrow() ? 14 : 14,
  fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
  fontLigatures: true,
  minimap: { enabled: !isNarrow() },
  wordWrap: isNarrow() ? ("on" as const) : ("off" as const),
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  padding: { top: 12, bottom: 12 },
  renderLineHighlight: "line" as const,
  bracketPairColorization: { enabled: true },
  smoothScrolling: true,
});

/** Keys phone keyboards hide, shown above the editor on small screens. */
const SYMBOLS = ["Tab", "{", "}", "(", ")", "[", "]", ";", "<", ">", "=", "+", "-", "*", "/", "&", "|", "!", '"', "'", ":", ","];

export default function CodeEditor({
  language,
  value,
  onChange,
  height = 360,
}: {
  language: Language;
  value: string;
  onChange: (v: string) => void;
  height?: number;
}) {
  const ref = useRef<Ed | null>(null);

  const insert = (s: string) => {
    const ed = ref.current;
    if (!ed) return;
    ed.focus();
    if (s === "Tab") ed.trigger("symbols", "tab", null);
    else ed.trigger("symbols", "type", { text: s });
  };

  return (
    <div className="editor">
      <div className="symbols" role="toolbar" aria-label="Insert symbol">
        {SYMBOLS.map((s) => (
          <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(s)}>
            {s}
          </button>
        ))}
      </div>
      <Editor
        height={height}
        theme="atlas-dark"
        language={language}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={(ed) => (ref.current = ed)}
        options={baseOptions()}
        loading={<div className="editor-loading">Loading editor…</div>}
      />
    </div>
  );
}

export function CompareEditor({
  left,
  right,
  height = 400,
}: {
  left: { language: Language; code: string };
  right: { language: Language; code: string };
  height?: number;
}) {
  return (
    <div className="editor">
      <DiffEditor
        height={height}
        theme="atlas-dark"
        original={left.code}
        modified={right.code}
        originalLanguage={left.language}
        modifiedLanguage={right.language}
        options={{ ...baseOptions(), readOnly: true, renderSideBySide: !isNarrow(), originalEditable: false }}
        loading={<div className="editor-loading">Loading editor…</div>}
      />
    </div>
  );
}
