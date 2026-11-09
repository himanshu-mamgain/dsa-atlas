import { useSyncExternalStore } from "react";

/**
 * Dark by default, like Structura, so the two apps feel like one; "system"
 * follows the OS. The choice is a per-device convenience kept in localStorage.
 */
export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY = "dsa-atlas:theme";
const media = window.matchMedia("(prefers-color-scheme: light)");
const listeners = new Set<() => void>();

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

let choice = readChoice();

export const resolve = (c: ThemeChoice): Theme => (c === "system" ? (media.matches ? "light" : "dark") : c);

function apply() {
  const theme = resolve(choice);
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f6f7fb" : "#0a0e1a");
  listeners.forEach((l) => l());
}

export function setThemeChoice(c: ThemeChoice) {
  choice = c;
  try {
    if (c === "dark") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, c);
  } catch {
    /* private mode: still applies for this visit */
  }
  apply();
}

media.addEventListener("change", () => choice === "system" && apply());
apply();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useThemeChoice = () => useSyncExternalStore(subscribe, () => choice);
export const useTheme = () => useSyncExternalStore(subscribe, () => resolve(choice));
