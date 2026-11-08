import { useSyncExternalStore } from "react";

/** Tiny query-string router, like Structura's: ?problem=<id>, ?page=problems|settings. */
export type Route =
  | { name: "home" }
  | { name: "problems" }
  | { name: "settings" }
  | { name: "problem"; id: string };

function parse(): Route {
  const q = new URLSearchParams(location.search);
  const id = q.get("problem");
  if (id) return { name: "problem", id };
  const page = q.get("page");
  if (page === "problems" || page === "settings") return { name: page };
  return { name: "home" };
}

let current = parse();
const listeners = new Set<() => void>();

window.addEventListener("popstate", () => {
  current = parse();
  listeners.forEach((l) => l());
});

export function navigate(href: string) {
  history.pushState(null, "", href);
  current = parse();
  listeners.forEach((l) => l());
  window.scrollTo({ top: 0 });
}

export const hrefFor = (r: Route) =>
  r.name === "home" ? "/" : r.name === "problem" ? `/?problem=${encodeURIComponent(r.id)}` : `/?page=${r.name}`;

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
