/**
 * Push reminders, device side: subscribe/unsubscribe, and keep the server's
 * copy of due dates current. Only titles and due dates leave the device.
 */
import { liveQuery } from "dexie";
import type { PushRegistration, ReminderItem } from "@dsa-atlas/shared";
import { db } from "../db/db";

const API = "/api/push";
const HOUR_KEY = "dsa-atlas:reminder-hour";
export const DEFAULT_HOUR = 9;

export type PushSupport = "ok" | "unsupported" | "ios-install" | "denied" | "dev";

export function pushSupport(): PushSupport {
  if (!import.meta.env.PROD) return "dev";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

export function savedHour(): number {
  try {
    const v = Number(localStorage.getItem(HOUR_KEY));
    return Number.isInteger(v) && v >= 0 && v <= 23 && localStorage.getItem(HOUR_KEY) !== null ? v : DEFAULT_HOUR;
  } catch {
    return DEFAULT_HOUR;
  }
}

function storeHour(hour: number) {
  try {
    localStorage.setItem(HOUR_KEY, String(hour));
  } catch {
    /* private mode: the server still has the hour */
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

async function items(): Promise<ReminderItem[]> {
  const all = await db.problems.toArray();
  return all.map((p) => ({ id: p.id, title: p.title.slice(0, 200), nextDue: p.review.nextDue }));
}

async function put(sub: PushSubscription, hour: number, list: ReminderItem[]) {
  const json = sub.toJSON();
  const body: PushRegistration = {
    subscription: { endpoint: json.endpoint!, expirationTime: json.expirationTime, keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth } },
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hour,
    items: list,
  };
  const res = await fetch(API, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Server error ${res.status}`);
}

export async function enableReminders(hour: number): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications were not allowed.");
  const keyRes = await fetch(API);
  if (!keyRes.ok) throw new Error((await keyRes.json().catch(() => null))?.error ?? "Push isn't available right now.");
  const { publicKey } = (await keyRes.json()) as { publicKey: string };
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
  await put(sub, hour, await items());
  storeHour(hour);
}

export async function setReminderHour(hour: number): Promise<void> {
  const sub = await currentSubscription();
  storeHour(hour);
  if (sub) await put(sub, hour, await items());
}

export async function disableReminders(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch(API, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTest(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new Error("Reminders aren't on for this device.");
  const res = await fetch(`${API}/test`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Server error ${res.status}`);
}

/**
 * Keeps the server's due dates in step with the notes: whenever problems
 * change (added, revised, renamed), re-sends the list a few seconds later.
 */
export function startReminderSync() {
  if (pushSupport() !== "ok") return;
  let timer: number | undefined;
  let last = "";
  liveQuery(items).subscribe((list) => {
    const sig = JSON.stringify(list);
    if (sig === last) return;
    const first = last === "";
    last = sig;
    window.clearTimeout(timer);
    timer = window.setTimeout(
      async () => {
        const sub = await currentSubscription();
        if (sub) await put(sub, savedHour(), list).catch((e) => console.warn("reminder sync failed", e));
      },
      first ? 0 : 3000,
    );
  });
}

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = (s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
