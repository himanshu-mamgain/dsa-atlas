import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { accountsEnabled, APP_ID, handoffTokens, hasSessionCookie, returningFromSignIn, signInRequired, studiaLogin, studiaLogout, viaStudia } from "./config";
import { applySnapshot, onLocalChange, snapshot } from "./data";
import { mergeAtlas, stable, type AtlasData } from "./merge";

// Your Studia account in DSA Atlas: who is signed in, and keeping your problems, checklist,
// goals and solve-page work in step with the copy in Supabase. Sync is read-merge-write:
// fetch the account's copy, merge it with this device's (merge.ts), save the result here and
// there. So two devices that changed different things both keep their work.

export interface AccountUser {
  name: string;
  login?: string;
  avatar?: string;
}

export interface AccountState {
  /** off: no Supabase settings in this build. */
  status: "off" | "signed-out" | "loading" | "signed-in";
  user?: AccountUser;
  /** When your data last reached the account. */
  syncedAt?: number;
  syncing?: boolean;
  error?: string;
}

/** The `app_progress` table refuses rows over 512,000 bytes (see the studia repo's migration). */
const MAX_BYTES = 512_000;

let state: AccountState = { status: accountsEnabled ? "signed-out" : "off" };
const listeners = new Set<() => void>();
const set = (patch: Partial<AccountState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}

const client = () => import("./client").then((m) => m.supabase);

function userOf(session: Session): AccountUser {
  const meta = session.user.user_metadata ?? {};
  return {
    name: meta.full_name || meta.name || meta.user_name || session.user.email || "Signed in",
    login: meta.user_name || meta.preferred_username,
    avatar: meta.avatar_url,
  };
}

let userId: string | undefined;
let lastSynced = ""; // this device's data as last saved to the account
let timer: ReturnType<typeof setTimeout> | undefined;
let stopWatching: (() => void) | undefined;

/** Fetch the account's copy, merge it with this device's, and save the result in both places. */
export async function syncNow(): Promise<void> {
  if (!userId || state.syncing) return;
  clearTimeout(timer);
  timer = undefined;
  set({ syncing: true });
  try {
    const supabase = await client();
    const { data: row, error } = await supabase.from("app_progress").select("data").eq("user_id", userId).eq("app", APP_ID).maybeSingle();
    if (error) throw error;
    const remote = row?.data as AtlasData | undefined;
    const local = await snapshot();
    const merged = mergeAtlas(local, remote?.version === 1 ? remote : { ...local, deleted: {} });
    const text = stable(merged);
    lastSynced = text;
    if (text !== stable(local)) await applySnapshot(merged, local);
    if (!remote || text !== stable(remote)) {
      const bytes = new TextEncoder().encode(text).length;
      if (bytes > MAX_BYTES) throw new Error(`your notes are ${Math.round(bytes / 1000)} KB, and the account holds up to ${MAX_BYTES / 1000} KB. They're still safe on this device.`);
      const { error: saveError } = await supabase.from("app_progress").upsert({ user_id: userId, app: APP_ID, data: merged, updated_at: new Date().toISOString() });
      if (saveError) throw saveError;
    }
    set({ syncing: false, syncedAt: Date.now(), error: undefined });
  } catch (e) {
    lastSynced = "";
    set({ syncing: false, error: navigator.onLine ? `Couldn't sync: ${(e as Error).message ?? "unknown error"}` : "You're offline: your notes will sync when you're back." });
  }
}

/** A change here: sync a few seconds later, so a burst of edits is one save. */
function onChange() {
  if (!userId) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (stable(await snapshot()) !== lastSynced) void syncNow();
    else timer = undefined;
  }, 4000);
}

function signedIn(session: Session) {
  const first = userId !== session.user.id;
  userId = session.user.id;
  set({ status: "signed-in", user: userOf(session) });
  if (!first) return;
  stopWatching ??= onLocalChange(onChange);
  // Not inside Supabase's auth callback: its docs warn that calling the client there can deadlock.
  setTimeout(() => void syncNow(), 0);
}

function signedOut() {
  userId = undefined;
  lastSynced = "";
  clearTimeout(timer);
  timer = undefined;
  stopWatching?.();
  stopWatching = undefined;
  set({ status: "signed-out", user: undefined, syncedAt: undefined, error: undefined });
}

let started = false;
/** Why signing in failed, when the address says it did. */
let failed: string | null = null;
/** Leaving for Studia (to sign in or out): don't also send the learner to the login page. */
let leaving = false;

/** The address says signing in just failed: show that, rather than trying again in a loop. */
function signInFailed(): string | null {
  const q = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return q.get("error_description") ?? hash.get("error_description");
}

function toStudiaLogin() {
  if (leaving || failed) return;
  leaving = true;
  window.location.replace(studiaLogin());
}

/** Load Supabase and follow the session. Called at start-up only when there may be one. */
async function start() {
  if (started) return;
  started = true;
  set({ status: "loading" });
  // Read the address before anything tidies it.
  const handed = handoffTokens();
  failed = signInFailed();
  const supabase = await client();
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) signedIn(session);
    else if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
      signedOut();
      if (failed) set({ error: `Sign-in didn't finish: ${failed}` });
      // No session, or it has run out: sign in at Studia. (Not while a handed-over one is being kept.)
      if (signInRequired && !handed) toStudiaLogin();
    }
  });
  // Tokens, codes and errors from signing in don't stay in the address (or in the history).
  const url = new URL(window.location.href);
  const keys = ["code", "error", "error_code", "error_description", "state"].filter((key) => url.searchParams.has(key));
  // Only rewrite the query when there's something to take out: rewriting turns "?page" into "?page=".
  for (const key of keys) url.searchParams.delete(key);
  const hash = new URLSearchParams(url.hash.slice(1));
  const tokensInHash = hash.has("access_token") || hash.has("error_description");
  if (tokensInHash) url.hash = "";
  if (keys.length || tokensInHash) window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  // A session handed over by the Studia site: keep it.
  if (handed) {
    const { error } = await supabase.auth.setSession(handed);
    if (error) set({ status: "signed-out", error: `Signing in through Studia didn't finish: ${error.message}` });
  }
  // Save what's waiting before the page goes away, and catch up after being offline.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && timer) void syncNow();
  });
  window.addEventListener("online", () => userId && void syncNow());
}

const CRAWLER = /bot\b|crawler|spider|Googlebot|bingbot|DuckDuckBot|Baiduspider|YandexBot|facebookexternalhit|WhatsApp|Slackbot|Twitterbot|LinkedInBot|Lighthouse/i;

/**
 * At start-up: only load Supabase if this browser is signed in or coming back from signing in.
 * When signing in is required and nobody is, send the learner to Studia's login instead and
 * return true, so the app doesn't start only to leave.
 */
export function startAccount(): boolean {
  if (!accountsEnabled) return false;
  if (hasSessionCookie() || returningFromSignIn()) {
    void start();
    return false;
  }
  // Offline, Studia can't be reached: let the app open with what this device has. Search engines
  // and link previews aren't sent away either.
  if (signInRequired && navigator.onLine && !CRAWLER.test(navigator.userAgent)) {
    toStudiaLogin();
    return true;
  }
  return false;
}

/** Sign in with GitHub, then come back to this same page. With a Studia site, that's where it happens. */
export async function signIn() {
  if (viaStudia) {
    leaving = true;
    window.location.assign(studiaLogin());
    return;
  }
  await start();
  set({ status: "loading", error: undefined });
  const supabase = await client();
  const back = new URL(window.location.href);
  back.hash = "";
  const { error } = await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo: back.toString() } });
  if (error) set({ status: "signed-out", error: error.message });
}

/** Sign out of the Studia account. This device keeps all its data. */
export async function signOut() {
  if (timer) await syncNow();
  const supabase = await client();
  // "local": this browser only (and, on studia.dev, the other apps sharing its cookie), not every device.
  leaving = viaStudia;
  await supabase.auth.signOut({ scope: "local" });
  signedOut();
  // Sign out of Studia too, or its login would sign this app straight back in.
  if (viaStudia) window.location.assign(studiaLogout());
}
