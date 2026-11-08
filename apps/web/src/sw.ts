/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// /notion/ and /api/ are real files and functions, not app pages.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist: [/^\/notion\//, /^\/api\//] }));

// Notion notes (scripts/notion.ts): fresh when online, the last copy when offline.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/notion/"),
  new NetworkFirst({ cacheName: "dsa-atlas-notes", networkTimeoutSeconds: 4 }),
);

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// Push reminders (sent by the Netlify reminder function in a later phase).
self.addEventListener("push", (event) => {
  const data = event.data?.json() as { title?: string; body?: string; url?: string } | undefined;
  event.waitUntil(
    self.registration.showNotification(data?.title ?? "DSA Atlas", {
      body: data?.body ?? "You have problems to revise today.",
      icon: "/pwa-192x192.png",
      badge: "/pwa-64x64.png",
      data: { url: data?.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const win = wins[0];
      if (win) return win.navigate(url).then((w) => w?.focus());
      return self.clients.openWindow(url);
    }),
  );
});
