import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LayoutGrid } from "lucide-react";
import { ECOSYSTEM, type EcoAppId } from "@dsa-atlas/shared";

const THIS_APP: EcoAppId = "dsa-atlas";

/** Switch between the apps in the ecosystem. Same list as Structura's switcher. */
export function AppSwitcher() {
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
    <div className="switcher" ref={ref}>
      <button className="btn icon ghost" aria-label="Your apps" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <LayoutGrid size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="switcher-menu"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
          >
            <p className="switcher-title">Your apps</p>
            {ECOSYSTEM.map((app) => {
              const here = app.id === THIS_APP;
              return (
                <a key={app.id} role="menuitem" className="switcher-app" href={here ? "/" : app.url} aria-current={here ? "page" : undefined}>
                  <span className="switcher-dot" style={{ background: app.color }} aria-hidden>
                    {app.name[0]}
                  </span>
                  <span>
                    <strong>{app.name}</strong>
                    <span className="muted small">{here ? "You're here" : app.tagline}</span>
                  </span>
                </a>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
