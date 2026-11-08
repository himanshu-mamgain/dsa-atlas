import { useState } from "react";
import { Network, X } from "lucide-react";
import { STRUCTURA_TOPICS, structuraTitle } from "../structura";

/** Pick related Structura topics by name instead of typing ids. */
export function StructuraPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const query = q.trim().toLowerCase();
  const options = STRUCTURA_TOPICS.filter(
    (t) => !value.includes(t.id) && (!query || t.title.toLowerCase().includes(query) || t.blurb.toLowerCase().includes(query)),
  ).slice(0, 8);

  return (
    <div className="wide picker">
      <span className="picker-label">Related Structura topics</span>
      {value.length > 0 && (
        <div className="chips">
          {value.map((id) => (
            <span key={id} className="chip">
              <Network size={14} aria-hidden /> {structuraTitle(id)}
              <button className="chip-x" aria-label={`Remove ${structuraTitle(id)}`} onClick={() => onChange(value.filter((v) => v !== id))}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="picker-box">
        <input
          value={q}
          placeholder="Search Structura topics, e.g. cache, rate limiter…"
          aria-label="Search Structura topics"
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && options[0]) {
              e.preventDefault();
              onChange([...value, options[0].id]);
              setQ("");
            }
          }}
        />
        {open && options.length > 0 && (
          <ul className="picker-menu" role="listbox">
            {options.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="picker-option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange([...value, t.id]);
                    setQ("");
                  }}
                >
                  <strong>{t.title}</strong>
                  <span className="muted small">{t.blurb}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
