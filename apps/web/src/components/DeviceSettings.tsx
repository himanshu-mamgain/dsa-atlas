import { useEffect, useState } from "react";
import { HardDrive, Monitor, Moon, Sun } from "lucide-react";
import { formatBytes, requestPersistentStorage, storageStatus, type StorageStatus } from "../storage";
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "../theme";

const THEMES: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function Appearance() {
  const choice = useThemeChoice();
  return (
    <section className="card">
      <h2>Appearance</h2>
      <div className="segmented" role="radiogroup" aria-label="Theme">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button key={value} role="radio" aria-checked={choice === value} className="segment" onClick={() => setThemeChoice(value)}>
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function StorageCard() {
  const [s, setS] = useState<StorageStatus | null>(null);
  const refresh = () => storageStatus().then(setS);
  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="card">
      <h2>
        <HardDrive size={18} aria-hidden /> Storage
      </h2>
      {s && (
        <>
          <p className="small">
            {s.persisted === true && "✅ Protected: the browser won't clear your notes to free up space."}
            {s.persisted === false && "⚠️ Not protected yet: the browser may clear your notes if the device runs low on space."}
            {s.persisted === null && "This browser can't report whether storage is protected."}
          </p>
          {s.usedBytes !== null && (
            <p className="muted small">
              Using {formatBytes(s.usedBytes)}
              {s.quotaBytes ? ` of ${formatBytes(s.quotaBytes)} available` : ""} (includes the offline app files).
            </p>
          )}
          {s.persisted === false && (
            <>
              <button className="btn" onClick={() => requestPersistentStorage().then(refresh)}>
                Protect my notes
              </button>
              <p className="muted small">Browsers decide this themselves. Installing the app usually gets it approved. Export a backup either way.</p>
            </>
          )}
        </>
      )}
    </section>
  );
}
