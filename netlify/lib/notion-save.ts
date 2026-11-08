// What /api/notion-note (netlify/functions/notion-note.mts) accepts and writes,
// kept free of network code so it can be tested (netlify/notion-save.test.ts).
// Ported from Structura's netlify/lib/notion-save.ts.
//
// Only you can save: the app seals each note with the key from the notes
// passphrase (packages/shared/src/notes.ts), and the function derives the same
// key from NOTION_PASSPHRASE. A request that doesn't open with it is refused.

export interface IncomingNote {
  problemId: string;
  problemTitle: string;
  text: string;
  /** When it was written (ms), so an old request can't be sent again later. */
  at: number;
  /** The writer's time zone, for the date heading. */
  timeZone?: string;
}

/** Saves older than this are refused (a copied request can't be replayed later). */
export const MAX_AGE = 5 * 60 * 1000;
export const MAX_TEXT = 6000;
/** The page under the notes root that holds one page per problem. */
export const FOLDER = "Notes from DSA Atlas";

const isText = (x: unknown, max: number): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= max;

export function parseNote(x: unknown, now: number): IncomingNote | { error: string } {
  const n = x as Partial<IncomingNote> | null;
  if (!n || typeof n.at !== "number" || Math.abs(now - n.at) > MAX_AGE) return { error: "This save is too old. Try again." };
  if (!isText(n.problemId, 80) || !/^[a-z0-9-]+$/.test(n.problemId)) return { error: "Unknown problem." };
  if (!isText(n.problemTitle, 160)) return { error: "Unknown problem." };
  if (!isText(n.text, MAX_TEXT)) return { error: `A note is 1 to ${MAX_TEXT} characters.` };
  let timeZone: string | undefined;
  try {
    // Throws for a zone the runtime doesn't know.
    if (typeof n.timeZone === "string" && n.timeZone.length < 64 && new Intl.DateTimeFormat("en", { timeZone: n.timeZone })) timeZone = n.timeZone;
  } catch {
    // An unknown zone: the heading uses UTC.
  }
  return { problemId: n.problemId, problemTitle: n.problemTitle.trim(), text: n.text.trim(), at: n.at, timeZone };
}

// Notion takes at most 2000 characters in one piece of text.
function chunks(text: string, size = 1900): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

const richText = (text: string) => chunks(text).map((content) => ({ type: "text", text: { content } }));

/** The note as Notion blocks: a dated heading, then paragraphs and bullet points as written. */
export function noteBlocks(note: IncomingNote) {
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: note.timeZone ?? "UTC" }).format(note.at);
  const blocks: object[] = [{ object: "block", type: "heading_3", heading_3: { rich_text: richText(when) } }];
  for (const para of note.text.split(/\n\s*\n/)) {
    const lines = para.split("\n").filter((l) => l.trim());
    if (lines.length && lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
      for (const l of lines) blocks.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: richText(l.replace(/^\s*[-*•]\s+/, "")) } });
    } else if (lines.length) {
      blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: richText(lines.join("\n")) } });
    }
  }
  // Notion appends at most 100 blocks per request.
  return blocks.slice(0, 100);
}

/** The page id from an id or a Notion URL. */
export function pageIdOf(input: string): string | null {
  const hex = input
    .split("?")[0]
    .replace(/-/g, "")
    .match(/[0-9a-f]{32,}/gi)
    ?.at(-1)
    ?.slice(-32)
    ?.toLowerCase();
  return hex ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` : null;
}
