/**
 * /api/push
 *   GET    → { publicKey } for PushManager.subscribe
 *   PUT    → save or update this device's subscription, reminder time and due dates
 *   DELETE → { endpoint } remove this device
 * /api/push/test
 *   POST   → { endpoint } send a test notification to this device now
 */
import type { Config } from "@netlify/functions";
import { validateRegistration } from "../../packages/review/src/index";
import type { PushRegistration } from "../../packages/shared/src/index";
import { json, keyFor, send, subscriptions, vapid, type StoredRegistration } from "../lib/push";

const MAX_BODY = 100_000;

export default async (req: Request) => {
  const keys = vapid();
  if (!keys) return json({ error: "Push isn't configured on the server (missing VAPID keys)." }, 503);

  const url = new URL(req.url);
  const isTest = url.pathname.endsWith("/test");

  if (req.method === "GET" && !isTest) return json({ publicKey: keys.publicKey });

  const text = await req.text();
  if (text.length > MAX_BODY) return json({ error: "Body too large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const store = subscriptions();

  if (req.method === "PUT" && !isTest) {
    const error = validateRegistration(body);
    if (error) return json({ error }, 400);
    const reg = body as PushRegistration;
    const key = await keyFor(reg.subscription.endpoint);
    const existing = (await store.get(key, { type: "json" })) as StoredRegistration | null;
    const record: StoredRegistration = {
      subscription: reg.subscription,
      timeZone: reg.timeZone,
      hour: reg.hour,
      items: reg.items,
      lastSentDate: existing?.lastSentDate ?? null,
      updatedAt: Date.now(),
    };
    await store.setJSON(key, record);
    return json({ ok: true, items: reg.items.length });
  }

  const endpoint = (body as { endpoint?: unknown })?.endpoint;
  if (typeof endpoint !== "string") return json({ error: "endpoint required" }, 400);
  const key = await keyFor(endpoint);

  if (req.method === "DELETE" && !isTest) {
    await store.delete(key);
    return json({ ok: true });
  }

  if (req.method === "POST" && isTest) {
    const reg = (await store.get(key, { type: "json" })) as StoredRegistration | null;
    if (!reg) return json({ error: "This device isn't subscribed" }, 404);
    const result = await send(reg, {
      title: "DSA Atlas reminders are on",
      body: `You'll get a daily nudge at ${String(reg.hour).padStart(2, "0")}:00 when problems are due.`,
      url: "/",
    });
    if (result === "gone") await store.delete(key);
    return json({ result }, result === "sent" ? 200 : 502);
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = { path: ["/api/push", "/api/push/test"] };
