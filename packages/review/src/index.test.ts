import { describe, expect, it } from "vitest";
import { applyReview, isDue, newReview, streak } from "./index";

const DAY = 86_400_000;
const now = new Date(2026, 10, 8, 12).getTime();

describe("review", () => {
  it("new problems are due now", () => {
    expect(isDue(newReview(now), now)).toBe(true);
  });

  it("ok moves one step, easy two, forgot resets", () => {
    const r1 = applyReview(newReview(now), "ok", now);
    expect(r1.stage).toBe(1);
    expect(isDue(r1, now)).toBe(false);
    expect(isDue(r1, now + 3 * DAY)).toBe(true);
    expect(applyReview(r1, "easy", now).stage).toBe(3);
    expect(applyReview(r1, "forgot", now).stage).toBe(0);
  });

  it("counts a streak ending today or yesterday", () => {
    expect(streak([now, now - DAY, now - 2 * DAY], now)).toBe(3);
    expect(streak([now - DAY, now - 2 * DAY], now)).toBe(2);
    expect(streak([now - 3 * DAY], now)).toBe(0);
  });
});
