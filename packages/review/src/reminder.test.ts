import { describe, expect, it } from "vitest";
import { dueItems, localDate, localHour, reminderMessage, shouldSend, validateRegistration } from "./reminder";

// 2026-11-08 03:30 UTC = 09:00 in Kolkata (UTC+5:30), 22:30 the day before in New York.
const now = Date.UTC(2026, 10, 8, 3, 30);
const IST = "Asia/Kolkata";

describe("timezones", () => {
  it("reads local date and hour", () => {
    expect(localDate(now, IST)).toBe("2026-11-08");
    expect(localHour(now, IST)).toBe(9);
    expect(localDate(now, "America/New_York")).toBe("2026-11-07");
  });
});

describe("dueItems", () => {
  const items = [
    { id: "a", title: "A", nextDue: Date.UTC(2026, 10, 8, 17) }, // later today in IST (22:30)
    { id: "b", title: "B", nextDue: Date.UTC(2026, 10, 5) }, // overdue
    { id: "c", title: "C", nextDue: Date.UTC(2026, 10, 8, 19) }, // 00:30 tomorrow in IST
  ];
  it("includes today and overdue, oldest first", () => {
    expect(dueItems(items, now, IST).map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("shouldSend", () => {
  it("sends once, at the chosen local hour", () => {
    expect(shouldSend({ timeZone: IST, hour: 9 }, null, now)).toBe(true);
    expect(shouldSend({ timeZone: IST, hour: 9 }, "2026-11-08", now)).toBe(false);
    expect(shouldSend({ timeZone: IST, hour: 8 }, null, now)).toBe(false);
  });
});

describe("reminderMessage", () => {
  it("summarises", () => {
    expect(reminderMessage([])).toBeNull();
    expect(reminderMessage([{ id: "two-sum", title: "Two Sum", nextDue: 0 }])).toEqual({
      title: "1 problem to revise today",
      body: "Two Sum",
      url: "/?problem=two-sum",
    });
    const m = reminderMessage(["A", "B", "C", "D"].map((t) => ({ id: t, title: t, nextDue: 0 })));
    expect(m?.title).toBe("4 problems to revise today");
    expect(m?.body).toBe("A, B and 2 more");
    expect(m?.url).toBe("/");
  });
});

describe("validateRegistration", () => {
  const ok = {
    subscription: { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "p", auth: "a" } },
    timeZone: IST,
    hour: 9,
    items: [{ id: "a", title: "A", nextDue: 1 }],
  };
  it("accepts a valid body and rejects bad ones", () => {
    expect(validateRegistration(ok)).toBeNull();
    expect(validateRegistration({ ...ok, hour: 24 })).not.toBeNull();
    expect(validateRegistration({ ...ok, timeZone: "Mars/Base" })).not.toBeNull();
    expect(validateRegistration({ ...ok, subscription: { ...ok.subscription, endpoint: "http://x" } })).not.toBeNull();
    expect(validateRegistration({ ...ok, items: [{ id: "a", title: "x".repeat(201), nextDue: 1 }] })).not.toBeNull();
  });
});
