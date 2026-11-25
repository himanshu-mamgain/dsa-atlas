import { Workbox } from "workbox-window";

/**
 * A page still running an old version asks for that version's files (the code viewer, a
 * chart), but a deploy has replaced them, so they 404 and the page breaks. Reload into the
 * new version instead: at most once a minute, so a real network failure can't loop.
 * Returns false when it didn't reload (show the error instead).
 */
export function reloadForNewVersion(): boolean {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem("dsa-atlas:reloaded-at")) || 0;
  } catch {
    // Storage blocked: allow one reload.
  }
  if (Date.now() - last < 60_000) return false;
  try {
    sessionStorage.setItem("dsa-atlas:reloaded-at", String(Date.now()));
  } catch {
    // Nothing to remember it in.
  }
  location.reload();
  return true;
}

/** "Failed to fetch dynamically imported module" (Chrome), "Importing a module script failed" (Safari)… */
export const isMissingFileError = (error: unknown) =>
  /dynamically imported module|module script failed|error loading dynamically imported|preload css/i.test(String((error as Error)?.message ?? error));

let touched = false;

/** Registers the service worker in production and moves open pages onto a new version. */
export function registerServiceWorker() {
  // Vite reports a file of this version that failed to load.
  addEventListener("vite:preloadError", (event) => {
    if (reloadForNewVersion()) event.preventDefault();
  });
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  for (const type of ["pointerdown", "keydown", "touchstart"]) addEventListener(type, () => (touched = true), { once: true, passive: true });

  const wb = new Workbox("/sw.js", { type: "module" });
  wb.addEventListener("waiting", () => wb.messageSkipWaiting());
  // The new version has taken over and removed the old version's files. If you haven't
  // started doing anything yet, load it now; otherwise a missing file triggers the reload.
  wb.addEventListener("controlling", (event) => {
    if (event.isUpdate && !touched) location.reload();
  });
  void wb.register();

  // An installed app can stay open for days; look for a new version when it comes back.
  let lastCheck = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || Date.now() - lastCheck < 30 * 60_000) return;
    lastCheck = Date.now();
    void wb.update().catch(() => undefined);
  });
}
