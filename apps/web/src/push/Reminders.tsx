import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { currentSubscription, disableReminders, enableReminders, pushSupport, savedHour, sendTest, setReminderHour } from "./push";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const label = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function Reminders() {
  const [support] = useState(pushSupport);
  const [on, setOn] = useState<boolean | null>(null);
  const [hour, setHour] = useState(savedHour);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    currentSubscription().then((s) => setOn(!!s));
  }, []);

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      setMsg(done);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2>
        <Bell size={18} aria-hidden /> Reminders
      </h2>
      <p className="muted small">
        A daily notification when problems are due. Only problem titles and due dates are sent to the server, never your notes or code.
      </p>

      {support === "dev" && <p className="small">Push works on the deployed site (it needs the service worker), not in dev mode.</p>}
      {support === "unsupported" && <p className="small">This browser doesn't support push notifications.</p>}
      {support === "denied" && <p className="small">Notifications are blocked for this site. Allow them in your browser's site settings, then reload.</p>}
      {support === "ios-install" && (
        <p className="small">
          On iPhone and iPad, reminders work once DSA Atlas is installed: tap <strong>Share → Add to Home Screen</strong>, then open it from your home screen
          and come back here.
        </p>
      )}

      {support === "ok" && on !== null && (
        <div className="stack-sm">
          <label className="inline-label">
            Remind me at
            <select
              value={hour}
              disabled={busy}
              onChange={(e) => {
                const h = Number(e.target.value);
                setHour(h);
                if (on) run(() => setReminderHour(h), `Reminder time set to ${label(h)}.`);
              }}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {label(h)}
                </option>
              ))}
            </select>
          </label>
          <div className="row-actions">
            {on ? (
              <>
                <button className="btn" disabled={busy} onClick={() => run(sendTest, "Test sent. It should arrive in a few seconds.")}>
                  <Send size={16} aria-hidden /> Send test
                </button>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await disableReminders();
                      setOn(false);
                    }, "Reminders are off on this device.")
                  }
                >
                  <BellOff size={16} aria-hidden /> Turn off
                </button>
              </>
            ) : (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await enableReminders(hour);
                    setOn(true);
                  }, `Reminders are on. You'll get one at ${label(hour)} when problems are due.`)
                }
              >
                <Bell size={16} aria-hidden /> Turn on reminders
              </button>
            )}
          </div>
        </div>
      )}
      {msg && (
        <p className="small" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
