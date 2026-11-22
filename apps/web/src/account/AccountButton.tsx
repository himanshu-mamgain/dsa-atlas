import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloudCheck, LogIn, LogOut, RefreshCw, UserRound } from "lucide-react";
import { signIn, signOut, syncNow, useAccount } from "./account";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(t: number): string {
  const s = Math.round((t - Date.now()) / 1000);
  if (s > -45) return "just now";
  if (s > -3600) return rtf.format(Math.round(s / 60), "minute");
  if (s > -86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/** Your Studia account in the app bar: sign in with GitHub, see that your notes are synced, sign out. */
export function AccountButton() {
  const account = useAccount();
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

  if (account.status === "off") return null;
  const user = account.status === "signed-in" ? account.user : undefined;

  return (
    <div className="switcher account" ref={ref}>
      <button
        className="btn icon ghost account-btn"
        aria-label={user ? `Your Studia account: ${user.name}` : "Sign in to Studia"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {user?.avatar ? <img className="account-avatar" src={user.avatar} alt="" width={28} height={28} referrerPolicy="no-referrer" /> : <UserRound size={19} />}
        {account.error && <span className="account-dot" aria-hidden />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="switcher-menu account-menu"
            role="dialog"
            aria-label="Studia account"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
          >
            {user ? (
              <>
                <div className="account-who">
                  {user.avatar ? <img className="account-avatar big" src={user.avatar} alt="" width={44} height={44} referrerPolicy="no-referrer" /> : <UserRound size={28} />}
                  <div>
                    <strong>{user.name}</strong>
                    {user.login && <span className="muted small">@{user.login} on GitHub</span>}
                  </div>
                </div>
                <p className="account-sync">
                  {account.syncing ? (
                    <>
                      <RefreshCw size={15} className="spin" aria-hidden /> Syncing your notes…
                    </>
                  ) : account.error ? (
                    <span className="account-error">{account.error}</span>
                  ) : (
                    <>
                      <CloudCheck size={15} aria-hidden /> Synced{account.syncedAt ? ` ${ago(account.syncedAt)}` : ""}
                    </>
                  )}
                </p>
                <p className="muted small">Your problems, checklist ticks, goals and solutions are saved to your Studia account, and follow you to every device.</p>
                <div className="account-actions">
                  <button className="btn" onClick={() => void syncNow()} disabled={account.syncing}>
                    <RefreshCw size={15} aria-hidden /> Sync now
                  </button>
                  <button className="btn" onClick={() => void signOut().then(() => setOpen(false))}>
                    <LogOut size={15} aria-hidden /> Sign out
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="switcher-title">Sign in to Studia</p>
                <p className="account-text">
                  One free account for DSA Atlas, Structura and Schemata. Your problems, checklist ticks, goals and solutions follow you to every device.
                </p>
                {account.error && <p className="account-error">{account.error}</p>}
                <button className="btn primary account-signin" onClick={() => void signIn()} disabled={account.status === "loading"}>
                  <LogIn size={16} aria-hidden /> {account.status === "loading" ? "Opening GitHub…" : "Continue with GitHub"}
                </button>
                <p className="muted small account-text">GitHub shares your name, username, picture and email address with Studia. Nothing else.</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
