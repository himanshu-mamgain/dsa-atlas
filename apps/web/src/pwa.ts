import { Workbox } from "workbox-window";

/** Registers the service worker in production and applies updates on the next visit. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const wb = new Workbox("/sw.js", { type: "module" });
  wb.addEventListener("waiting", () => wb.messageSkipWaiting());
  wb.register();
}
