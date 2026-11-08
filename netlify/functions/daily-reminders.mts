/**
 * Runs every hour. For each device whose chosen local hour is now, and which
 * hasn't been reminded today, sends "N problems to revise today" if any are due.
 */
import type { Config } from "@netlify/functions";
import { dueItems, localDate, reminderMessage, shouldSend } from "../../packages/review/src/index";
import { send, subscriptions, vapid, type StoredRegistration } from "../lib/push";

export default async () => {
  if (!vapid()) {
    console.error("daily-reminders: VAPID keys are not set");
    return;
  }
  const store = subscriptions();
  const now = Date.now();
  const { blobs } = await store.list();
  let sent = 0;
  let removed = 0;

  for (const { key } of blobs) {
    const reg = (await store.get(key, { type: "json" })) as StoredRegistration | null;
    if (!reg || !shouldSend(reg, reg.lastSentDate, now)) continue;

    const msg = reminderMessage(dueItems(reg.items, now, reg.timeZone));
    if (msg) {
      const result = await send(reg, msg);
      if (result === "gone") {
        await store.delete(key);
        removed++;
        continue;
      }
      if (result === "failed") continue; // logged in send(); the next chance is tomorrow at the same hour
      sent++;
    }
    // Mark the day done even when nothing was due, so we don't re-check every hour.
    await store.setJSON(key, { ...reg, lastSentDate: localDate(now, reg.timeZone) });
  }

  console.log(`daily-reminders: ${blobs.length} devices, ${sent} sent, ${removed} removed`);
};

export const config: Config = { schedule: "@hourly" };
