import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for Netlify Blobs.
const blobs = new Map<string, unknown>();
vi.mock("@netlify/blobs", () => ({
  getStore: () => ({
    get: async (k: string) => blobs.get(k) ?? null,
    setJSON: async (k: string, v: unknown) => void blobs.set(k, structuredClone(v)),
    delete: async (k: string) => void blobs.delete(k),
    list: async () => ({ blobs: [...blobs.keys()].map((key) => ({ key })) }),
  }),
}));

const sent: { endpoint: string; payload: { title: string; body: string; url: string } }[] = [];
let failWith: number | null = null;
vi.mock("web-push", () => ({
  default: {
    sendNotification: async (sub: { endpoint: string }, payload: string) => {
      if (failWith) throw Object.assign(new Error("push error"), { statusCode: failWith });
      sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
    },
  },
}));

const { default: push } = await import("./functions/push.mjs");
const { default: daily } = await import("./functions/daily-reminders.mjs");

const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
const subscription = { endpoint, keys: { p256dh: "p", auth: "a" } };
const req = (method: string, body?: unknown, path = "/api/push") =>
  new Request(`https://dsa-atz.netlify.app${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });

describe("push functions", () => {
  beforeEach(() => {
    blobs.clear();
    sent.length = 0;
    failWith = null;
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    vi.useRealTimers();
  });

  it("returns 503 without VAPID keys", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    expect((await push(req("GET"))).status).toBe(503);
  });

  it("serves the public key, saves, tests and deletes a subscription", async () => {
    expect(await (await push(req("GET"))).json()).toEqual({ publicKey: "pub" });

    const bad = await push(req("PUT", { subscription, timeZone: "Asia/Kolkata", hour: 99, items: [] }));
    expect(bad.status).toBe(400);

    const ok = await push(req("PUT", { subscription, timeZone: "Asia/Kolkata", hour: 9, items: [{ id: "two-sum", title: "Two Sum", nextDue: 0 }] }));
    expect(ok.status).toBe(200);
    expect(blobs.size).toBe(1);
    expect([...blobs.keys()][0]).not.toContain("fcm"); // keys are hashes, not endpoints

    const test = await push(req("POST", { endpoint }, "/api/push/test"));
    expect(test.status).toBe(200);
    expect(sent[0].payload.title).toMatch(/reminders are on/i);

    expect((await push(req("DELETE", { endpoint }))).status).toBe(200);
    expect(blobs.size).toBe(0);
    expect((await push(req("POST", { endpoint }, "/api/push/test"))).status).toBe(404);
  });

  it("sends the daily reminder once, at the local hour, and drops dead subscriptions", async () => {
    // 2026-11-08 03:30 UTC = 09:00 in Kolkata.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.UTC(2026, 10, 8, 3, 30));
    const items = [
      { id: "two-sum", title: "Two Sum", nextDue: Date.UTC(2026, 10, 7) },
      { id: "lru", title: "LRU Cache", nextDue: Date.UTC(2026, 10, 20) },
    ];
    await push(req("PUT", { subscription, timeZone: "Asia/Kolkata", hour: 9, items }));

    await daily();
    expect(sent).toHaveLength(1);
    expect(sent[0].payload).toEqual({ title: "1 problem to revise today", body: "Two Sum", url: "/?problem=two-sum" });

    await daily(); // same hour, same day: nothing more
    expect(sent).toHaveLength(1);

    vi.setSystemTime(Date.UTC(2026, 10, 9, 3, 30)); // next day, browser has dropped the subscription
    failWith = 410;
    await daily();
    expect(blobs.size).toBe(0);
  });
});
