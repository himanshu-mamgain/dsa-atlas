/**
 * Daily reminder logic, shared by the scheduled Netlify function (which sends)
 * and tested here. Pure: no I/O, time passed in.
 */
import type { PushRegistration, ReminderItem, ReminderSettings } from "@dsa-atlas/shared";

export const MAX_ITEMS = 500;
export const MAX_TITLE = 200;

/** "YYYY-MM-DD" for a moment in a timezone. */
export function localDate(t: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}

/** Local hour (0–23) for a moment in a timezone. */
export function localHour(t: number, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(t);
  return Number(h);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Problems due today or overdue, in the user's timezone, oldest first. */
export function dueItems(items: ReminderItem[], now: number, timeZone: string): ReminderItem[] {
  const today = localDate(now, timeZone);
  return items.filter((i) => localDate(i.nextDue, timeZone) <= today).sort((a, b) => a.nextDue - b.nextDue);
}

/** Whether the reminder should go out on this (hourly) run. */
export function shouldSend(settings: ReminderSettings, lastSentDate: string | null, now: number): boolean {
  return localHour(now, settings.timeZone) === settings.hour && lastSentDate !== localDate(now, settings.timeZone);
}

export interface ReminderMessage {
  title: string;
  body: string;
  url: string;
}

export function reminderMessage(due: ReminderItem[]): ReminderMessage | null {
  if (due.length === 0) return null;
  const names = due.slice(0, 2).map((d) => d.title);
  const more = due.length - names.length;
  return {
    title: due.length === 1 ? "1 problem to revise today" : `${due.length} problems to revise today`,
    body: more > 0 ? `${names.join(", ")} and ${more} more` : names.join(" and "),
    url: due.length === 1 ? `/?problem=${encodeURIComponent(due[0].id)}` : "/",
  };
}

/** Validates what a device sends; returns an error message or null. */
export function validateRegistration(x: unknown): string | null {
  const r = x as Partial<PushRegistration> | null;
  if (!r || typeof r !== "object") return "Body must be an object";
  const s = r.subscription;
  if (!s || typeof s.endpoint !== "string" || !s.endpoint.startsWith("https://")) return "Invalid subscription endpoint";
  if (!s.keys || typeof s.keys.p256dh !== "string" || typeof s.keys.auth !== "string") return "Invalid subscription keys";
  if (typeof r.timeZone !== "string" || !isValidTimeZone(r.timeZone)) return "Invalid timeZone";
  if (!Number.isInteger(r.hour) || r.hour! < 0 || r.hour! > 23) return "hour must be 0–23";
  if (!Array.isArray(r.items) || r.items.length > MAX_ITEMS) return `items must be an array of at most ${MAX_ITEMS}`;
  for (const i of r.items)
    if (!i || typeof i.id !== "string" || typeof i.title !== "string" || i.title.length > MAX_TITLE || !Number.isFinite(i.nextDue))
      return "Invalid item";
  return null;
}
