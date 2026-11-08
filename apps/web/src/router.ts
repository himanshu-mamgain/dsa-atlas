import { useSyncExternalStore } from "react";

/**
 * Tiny query-string router, like Structura's:
 *   ?problem=<id>           read view
 *   ?problem=<id>&edit=1    editor
 *   ?page=problems|settings|revise
 */
export type Route =
  | { name: "home" }
  | { name: "problems" }
  | { name: "settings" }
  | { name: "revise" }
  | { name: "problem"; id: string; edit?: boolean };

function parse(): Route {
  const q = new URLSearchParams(location.search);
  const id = q.get("problem");
  if (id) return { name: "problem", id, edit: q.get("edit") === "1" };
  const page = q.get("page");
  if (page === "problems" || page === "settings" || page === "revise") return { name: page };
  return { name: "home" };
}

let current = parse();
const listeners = new Set<() => void>();

window.addEventListener("popstate", () => {
  current = parse();
  listeners.forEach((l) => l());
});

export function navigate(href: string, { replace = false } = {}) {
  if (replace) history.replaceState(null, "", href);
  else history.pushState(null, "", href);
  current = parse();
  listeners.forEach((l) => l());
  if (!replace) window.scrollTo({ top: 0 });
}

export const hrefFor = (r: Route) => {
  if (r.name === "home") return "/";
  if (r.name === "problem") return `/?problem=${encodeURIComponent(r.id)}${r.edit ? "&edit=1" : ""}`;
  return `/?page=${r.name}`;
};

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
