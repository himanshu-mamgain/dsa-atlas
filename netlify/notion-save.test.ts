import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveKey, PBKDF2_ITERATIONS, saltFor, seal, toBase64 } from "../packages/shared/src/notes";
import { FOLDER, MAX_AGE, noteBlocks, pageIdOf, parseNote } from "./lib/notion-save";

const now = Date.UTC(2026, 10, 8, 10);
const good = { problemId: "two-sum", problemTitle: "Two Sum", text: "Use a hash map.\n\n- seen[x] = i\n- check target - x", at: now, timeZone: "Asia/Kolkata" };

describe("parseNote", () => {
  it("accepts a fresh note and trims it", () => {
    expect(parseNote({ ...good, text: "  hi  " }, now)).toMatchObject({ problemId: "two-sum", text: "hi" });
  });
  it("refuses old, odd or empty notes", () => {
    expect(parseNote({ ...good, at: now - MAX_AGE - 1 }, now)).toHaveProperty("error");
    expect(parseNote({ ...good, problemId: "../etc" }, now)).toHaveProperty("error");
    expect(parseNote({ ...good, text: "   " }, now)).toHaveProperty("error");
    expect(parseNote(null, now)).toHaveProperty("error");
  });
  it("drops an unknown time zone", () => {
    expect(parseNote({ ...good, timeZone: "Mars/Base" }, now)).toMatchObject({ timeZone: undefined });
  });
});

describe("noteBlocks", () => {
  it("dates the note and keeps bullets as bullets", () => {
    const blocks = noteBlocks(good as never) as { type: string }[];
    expect(blocks.map((b) => b.type)).toEqual(["heading_3", "paragraph", "bulleted_list_item", "bulleted_list_item"]);
  });
});

describe("pageIdOf", () => {
  it("reads ids and URLs", () => {
    expect(pageIdOf("https://app.notion.com/p/DSA-0f1e2d3c4b5a69788796a5b4c3d2e1f0?pvs=4")).toBe("0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0");
    expect(pageIdOf("nope")).toBeNull();
  });
});

describe("/api/notion-note", () => {
  const ROOT = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("opens a sealed note and appends it under Notes from DSA Atlas / <problem>", async () => {
    process.env.NOTION_TOKEN = "secret";
    process.env.NOTION_ROOT_PAGE_ID = ROOT;
    process.env.NOTION_PASSPHRASE = "correct horse";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);

    const calls: { method: string; path: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const path = url.replace(/^https:\/\/api\.notion\.com\/v1/, "");
      calls.push({ method: init.method ?? "GET", path, body: init.body ? JSON.parse(String(init.body)) : undefined });
      const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (init.method === "GET") return ok({ results: [], has_more: false });
      if (init.method === "POST") return ok({ id: `page-${calls.length}` });
      return ok({});
    });

    const { default: handler } = await import("./functions/notion-note.mjs");
    const key = await deriveKey("correct horse", await saltFor(ROOT), PBKDF2_ITERATIONS);
    const data = toBase64(await seal(key, new TextEncoder().encode(JSON.stringify(good))));
    const res = await handler(new Request("https://dsa-atz.netlify.app/api/notion-note", { method: "POST", body: JSON.stringify({ data }) }));
    expect(res.status).toBe(200);
    const made = calls.filter((c) => c.method === "POST").map((c) => (c.body as { properties: { title: { title: { text: { content: string } }[] } } }).properties.title.title[0].text.content);
    expect(made).toEqual([FOLDER, "Two Sum"]);
    expect(calls.at(-1)?.method).toBe("PATCH");

    // A note sealed with another passphrase is refused.
    const wrong = await deriveKey("guess", await saltFor(ROOT), PBKDF2_ITERATIONS);
    const forged = toBase64(await seal(wrong, new TextEncoder().encode(JSON.stringify(good))));
    const refused = await handler(new Request("https://dsa-atz.netlify.app/api/notion-note", { method: "POST", body: JSON.stringify({ data: forged }) }));
    expect(refused.status).toBe(401);
  });
});
