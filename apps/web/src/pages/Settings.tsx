import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { exportAll, importAll } from "../db/db";
import { INTERVAL_DAYS } from "@dsa-atlas/review";
import { Reminders } from "../push/Reminders";

export function Settings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  return (
    <div className="stack">
      <section className="card">
        <h2>Backup</h2>
        <p className="muted small">Your notes live on this device. Export them to keep a copy or move them to another device.</p>
        <div className="row-actions">
          <button
            className="btn"
            onClick={async () => {
              const blob = new Blob([await exportAll()], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `dsa-atlas-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            <Download size={16} aria-hidden /> Export
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={16} aria-hidden /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setMsg(`Imported ${await importAll(await f.text())} problems.`);
              } catch (err) {
                setMsg(`Import failed: ${(err as Error).message}`);
              }
              e.target.value = "";
            }}
          />
        </div>
        {msg && <p className="small">{msg}</p>}
      </section>

      <section className="card">
        <h2>Revision schedule</h2>
        <p className="muted small">
          After each revision a problem comes back in {INTERVAL_DAYS.join(" → ")} days. "Easy" skips a step; "Forgot" starts again at day 1.
        </p>
      </section>

      <Reminders />
    </div>
  );
}
