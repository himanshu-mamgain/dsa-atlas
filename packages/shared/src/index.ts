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

export const STRUCTURA_URL = "https://structura-web.netlify.app";
export const structuraTopicUrl = (id: string) => `${STRUCTURA_URL}/?topic=${encodeURIComponent(id)}`;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
