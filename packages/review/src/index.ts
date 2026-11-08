/**
 * Spaced repetition shared by the app and the reminder function, so both
 * agree on what is due.
 */
import type { Review, ReviewResult } from "@dsa-atlas/shared";

/** Days until the next review, by stage. */
export const INTERVAL_DAYS = [1, 3, 7, 14, 30, 60] as const;

const DAY = 24 * 60 * 60 * 1000;

export function newReview(now = Date.now()): Review {
  return { stage: 0, lastSeen: null, nextDue: now, history: [] };
}

/** Moves the review forward after a revision. "forgot" starts over at day 1. */
export function applyReview(review: Review, result: ReviewResult, now = Date.now()): Review {
  const last = INTERVAL_DAYS.length - 1;
  let stage: number;
  if (result === "forgot") stage = 0;
  else if (result === "easy") stage = Math.min(review.stage + 2, last);
  else stage = Math.min(review.stage + 1, last);
  return {
    stage,
    lastSeen: now,
    nextDue: startOfDay(now) + INTERVAL_DAYS[stage] * DAY,
    history: [...review.history, { at: now, result }],
  };
}

export const isDue = (review: Review, now = Date.now()) => review.nextDue <= endOfDay(now);

export function dueLabel(review: Review, now = Date.now()): string {
  if (review.lastSeen === null) return "New";
  const days = Math.round((startOfDay(review.nextDue) - startOfDay(now)) / DAY);
  if (days < 0) return `${-days}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `In ${days}d`;
}

/** Consecutive days, ending today or yesterday, with at least one review. */
export function streak(reviewTimes: number[], now = Date.now()): number {
  const days = new Set(reviewTimes.map(startOfDay));
  let day = startOfDay(now);
  if (!days.has(day)) day -= DAY;
  let count = 0;
  while (days.has(day)) {
    count++;
    day -= DAY;
  }
  return count;
}

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const endOfDay = (t: number) => startOfDay(t) + DAY - 1;

export * from "./reminder";
