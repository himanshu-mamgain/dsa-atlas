/** Shared by the push functions: storage, VAPID setup and sending. */
import { getStore } from "@netlify/blobs";
import webpush from "web-push";
import type { PushRegistration } from "@dsa-atlas/shared";
import type { ReminderMessage } from "@dsa-atlas/review";

export interface StoredRegistration extends PushRegistration {
  /** Local date ("YYYY-MM-DD") the last daily reminder went out. */
  lastSentDate: string | null;
  updatedAt: number;
}

export const subscriptions = () => getStore({ name: "push-subscriptions", consistency: "strong" });

/** Blob key for a subscription: a hash, so endpoints don't appear in key listings. */
export async function keyFor(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export type SendResult = "sent" | "gone" | "failed";

/** Sends one notification. "gone" means the browser dropped the subscription: delete it. */
export async function send(reg: PushRegistration, msg: ReminderMessage): Promise<SendResult> {
  const keys = vapid();
  if (!keys) return "failed";
  try {
    await webpush.sendNotification(reg.subscription, JSON.stringify(msg), {
      TTL: 6 * 60 * 60,
      urgency: "normal",
      vapidDetails: { subject: keys.subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
    });
    return "sent";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("push failed", status, (err as Error).message);
    return "failed";
  }
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
