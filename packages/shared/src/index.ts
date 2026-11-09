/** Data shapes shared by the app, the push functions and (later) the extension. */

export const LANGUAGES = ["cpp", "java", "python", "javascript", "typescript", "rust", "go"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  cpp: "C++",
  java: "Java",
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  rust: "Rust",
  go: "Go",
};

export const APPROACH_KINDS = ["brute", "better", "optimal"] as const;
export type ApproachKind = (typeof APPROACH_KINDS)[number];

export const APPROACH_LABELS: Record<ApproachKind, string> = {
  brute: "Brute force",
  better: "Better",
  optimal: "Optimal",
};

export type Difficulty = "Easy" | "Medium" | "Hard";
export type Platform = "LeetCode" | "GFG" | "Codeforces" | "Other";

export interface Solution {
  language: Language;
  code: string;
  /** What differs in this language: library costs, overflow, recursion limits… */
  languageNotes: string;
}

export interface MeasuredPoint {
  n: number;
  ms: number;
}

export interface Approach {
  id: string;
  kind: ApproachKind;
  /** The key insight in a line or two. */
  idea: string;
  /** Big-O strings, e.g. "O(n log n)". */
  time: string;
  space: string;
  solutions: Solution[];
  measured?: MeasuredPoint[];
}

/** Spaced-repetition state. */
export interface Review {
  /** Index into the review intervals; 0 = new. */
  stage: number;
  lastSeen: number | null;
  /** Epoch ms when the problem is next due. */
  nextDue: number;
  history: { at: number; result: ReviewResult }[];
}

export type ReviewResult = "easy" | "ok" | "forgot";

export interface Problem {
  id: string;
  title: string;
  url: string;
  platform: Platform;
  difficulty: Difficulty;
  topics: string[];
  patterns: string[];
  /** Structura topic ids, e.g. "consistent-hashing". */
  structuraTopics: string[];
  approaches: Approach[];
  /** Markdown. */
  notes: string;
  review: Review;
  createdAt: number;
  updatedAt: number;
}

/** What a device sends the push function: only titles and due dates, never notes or code. */
export interface ReminderItem {
  id: string;
  title: string;
  nextDue: number;
}

export interface ReminderSettings {
  /** IANA timezone, e.g. "Asia/Kolkata". */
  timeZone: string;
  /** Local hour (0–23) to send the daily reminder. */
  hour: number;
}

export interface PushSubscriptionJSONStrict {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

export interface PushRegistration extends ReminderSettings {
  subscription: PushSubscriptionJSONStrict;
  items: ReminderItem[];
}


export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export * from "./ecosystem";

/** Checklist progress for one item of the Master Checklist (kept on the device). */
export interface ChecklistState {
  id: string;
  done: boolean;
  doneAt: number | null;
  /** The DSA Atlas problem made from this item, if any. */
  problemId?: string;
  /** Ticked or unticked in the app, so Notion's tick no longer applies. */
  touched?: boolean;
}

/** A practice target for a company: problems to finish by a date. */
export interface Goal {
  id: string;
  company: string;
  /** "YYYY-MM-DD". */
  targetDate: string;
  /** Checklist item ids ("c:<id>") and problem ids ("p:<id>"). */
  items: string[];
  note: string;
  createdAt: number;
}

/** One measured run of a solution: steps and time per call at each n. */
export interface MeasuredRun {
  /** Hash of the code and example that were measured; a change makes the result stale. */
  key: string;
  /** "O(n log n)". */
  bigO: string;
  /** Fitted to counted steps, or to time when the code couldn't be counted. */
  basis: "steps" | "time";
  /** The fit on time alone, for comparison. */
  timeBigO?: string;
  /** What n means: "length of nums". */
  n: string;
  /** The worst input found: "all equal". */
  variant: string;
  points: { n: number; ms: number; steps?: number }[];
  /** Why it stopped growing n: "size", "slow", "stack"… */
  stopped: string;
  at: number;
}

/** Your own attempt at a Master Checklist problem, from its solve page. */
export interface Attempt {
  /** The checklist item id. */
  id: string;
  language: Language;
  code: string;
  /** The example call used for measuring ("nums = [2,7,11,15], target = 9"). */
  example?: string;
  updatedAt: number;
  /** Measurements by solution: "mine", or "ref:<title>" for one from your notes. */
  runs?: Record<string, MeasuredRun>;
}

export * from "./notes";
