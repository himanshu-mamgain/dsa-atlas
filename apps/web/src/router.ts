import { useSyncExternalStore } from "react";

/**
 * Tiny query-string router, like Structura's:
 *   ?problem=<id>           read view
 *   ?problem=<id>&edit=1    editor
 *   ?goal=<id>              one company goal
 *   ?page=problems|settings|revise|checklist|goals
 *   ?page=problems&structura=<topic id>   problems linked to a Structura topic
 */
export type Route =
  | { name: "home" }
  | { name: "problems"; structura?: string }
  | { name: "settings" }
  | { name: "revise" }
  | { name: "checklist" }
  | { name: "goals" }
  | { name: "goal"; id: string }
  | { name: "problem"; id: string; edit?: boolean };

const PAGES = ["settings", "revise", "checklist", "goals"] as const;

function parse(): Route {
  const q = new URLSearchParams(location.search);
  const id = q.get("problem");
  if (id) return { name: "problem", id, edit: q.get("edit") === "1" };
  const goal = q.get("goal");
  if (goal) return { name: "goal", id: goal };
  const page = q.get("page");
  if (page === "problems") return { name: "problems", structura: q.get("structura") ?? undefined };
  if (PAGES.includes(page as (typeof PAGES)[number])) return { name: page as (typeof PAGES)[number] };
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
  if (r.name === "problems" && r.structura) return `/?page=problems&structura=${encodeURIComponent(r.structura)}`;
  if (r.name === "problem") return `/?problem=${encodeURIComponent(r.id)}${r.edit ? "&edit=1" : ""}`;
  if (r.name === "goal") return `/?goal=${encodeURIComponent(r.id)}`;
  return `/?page=${r.name}`;
};

/** Which nav item a route belongs to. */
export const section = (r: Route): Route["name"] => (r.name === "problem" ? "problems" : r.name === "goal" ? "goals" : r.name);

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
