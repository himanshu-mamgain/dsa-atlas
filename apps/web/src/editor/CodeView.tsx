import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Language } from "@dsa-atlas/shared";
import { monaco } from "./monaco";
import { useTheme } from "../theme";

/**
 * Read-only, syntax-highlighted code for the read view and revise mode.
 * Uses Monaco's colorizer (no editor instance), so it is light and scrolls naturally.
 */
export default function CodeView({ code, language }: { code: string; language: Language }) {
  const theme = useTheme();
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    monaco.editor.setTheme(theme === "light" ? "atlas-light" : "atlas-dark");
    monaco.editor.colorize(code, language, { tabSize: 4 }).then((h) => live && setHtml(h));
    return () => {
      live = false;
    };
  }, [code, language, theme]);

  if (!code.trim()) return <p className="muted small">No code yet for this language.</p>;

  return (
    <div className="code-view">
      <button
        className="btn icon copy"
        aria-label="Copy code"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      {html === null ? <pre>{code}</pre> : <pre dangerouslySetInnerHTML={{ __html: html }} />}
    </div>
  );
}
