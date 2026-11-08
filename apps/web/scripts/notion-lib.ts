// The Notion API and the block conversion shared by the build steps
// (notion.ts for the notes, notion-checklist.ts for the Master Checklist).
// Ported from Structura's apps/web/scripts/notion.ts so both apps read Notion the same way.
import type { Block, ListItem, Rich } from "../../../packages/shared/src/notes";

export const API = process.env.NOTION_API ?? "https://api.notion.com/v1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;
export interface RawBlock {
  id: string;
  type: string;
  has_children: boolean;
  [type: string]: Json;
  kids?: RawBlock[];
}

// ─── The Notion API, about three requests a second ───────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let slot = 0;
export const stats = { requests: 0 };

export async function api(token: string, path: string): Promise<Json> {
  for (let attempt = 0; ; attempt++) {
    // Each call takes the next free slot, 340 ms apart, however many run at once.
    const at = Math.max(slot, Date.now());
    slot = at + 340;
    await sleep(at - Date.now());
    stats.requests++;
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" } });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep((Number(res.headers.get("retry-after")) || 2 ** attempt) * 1000);
      continue;
    }
    throw new Error(`Notion answered ${res.status} for ${path}: ${(await res.text()).slice(0, 300)}`);
  }
}

async function children(token: string, id: string): Promise<RawBlock[]> {
  const out: RawBlock[] = [];
  let cursor: string | undefined;
  do {
    const page: Json = await api(token, `/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    out.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return out;
}

/** A page's blocks with their nested blocks, stopping at sub-pages (they're notes of their own). */
export async function tree(token: string, id: string, depth = 0): Promise<RawBlock[]> {
  const blocks = await children(token, id);
  await Promise.all(
    blocks.map(async (b) => {
      if (b.has_children && b.type !== "child_page" && b.type !== "child_database" && depth < 8) b.kids = await tree(token, b.id, depth + 1);
    }),
  );
  return blocks;
}

// ─── Notion blocks → the app's compact blocks ────────────────────────────────

export const plain = (rich: Rich[]) => rich.map(([text]) => text).join("");

export function rich(list: Json[] | undefined): Rich[] {
  return (list ?? []).map((x: Json): Rich => {
    const a = x.annotations ?? {};
    const marks = `${a.bold ? "b" : ""}${a.italic ? "i" : ""}${a.strikethrough ? "s" : ""}${a.underline ? "u" : ""}${a.code ? "c" : ""}`;
    const text = x.type === "equation" ? x.equation.expression : (x.plain_text ?? "");
    // A mention of another page links to it.
    const href = x.href ?? (x.type === "mention" && x.mention?.page?.id ? `https://www.notion.so/${x.mention.page.id.replace(/-/g, "")}` : undefined);
    return href ? [text, marks, href] : marks ? [text, marks] : [text];
  });
}

const fileUrl = (v: Json): string | undefined => v?.file?.url ?? v?.external?.url;

/** Converts blocks; sub-pages are reported to `found`. */
export function convert(raw: RawBlock[], found: (id: string, title: string) => void): Block[] {
  const out: Block[] = [];
  const push = (b: Block) => out.push(b);
  const list = (t: "ul" | "ol" | "todo", item: ListItem) => {
    const last = out.at(-1);
    if (last && last.t === t) last.items.push(item);
    else push({ t, items: [item] });
  };
  for (const b of raw) {
    const v = b[b.type] ?? {};
    const c = b.kids?.length ? convert(b.kids, found) : undefined;
    switch (b.type) {
      case "paragraph": {
        const r = rich(v.rich_text);
        if (plain(r).trim() || c) push({ t: "p", r, ...(c && { c }) });
        break;
      }
      case "heading_1":
      case "heading_2":
      case "heading_3":
        push({ t: `h${b.type.at(-1)}` as "h1" | "h2" | "h3", r: rich(v.rich_text), ...(c && { c }) });
        break;
      case "quote":
      case "toggle":
        push({ t: b.type, r: rich(v.rich_text), ...(c && { c }) });
        break;
      case "bulleted_list_item":
        list("ul", { r: rich(v.rich_text), ...(c && { c }) });
        break;
      case "numbered_list_item":
        list("ol", { r: rich(v.rich_text), ...(c && { c }) });
        break;
      case "to_do":
        list("todo", { r: rich(v.rich_text), done: Boolean(v.checked), ...(c && { c }) });
        break;
      case "callout":
        push({ t: "callout", r: rich(v.rich_text), ...(v.icon?.emoji && { icon: v.icon.emoji }), ...(c && { c }) });
        break;
      case "code":
        push({ t: "code", text: plain(rich(v.rich_text)), lang: v.language ?? "plain text", ...(v.caption?.length && { caption: plain(rich(v.caption)) }) });
        break;
      case "divider":
        push({ t: "hr" });
        break;
      case "equation":
        push({ t: "eq", text: v.expression ?? "" });
        break;
      case "table":
        push({
          t: "table",
          head: Boolean(v.has_column_header),
          rows: (b.kids ?? []).filter((r) => r.type === "table_row").map((r) => (r.table_row.cells as Json[][]).map(rich)),
        });
        break;
      case "image": {
        const src = fileUrl(v);
        // Notion-hosted images get an id-based name; the notes build downloads them.
        if (src) push({ t: "img", src: v.type === "file" ? `notion-file:${b.id}|${src}` : src, ...(v.caption?.length && { caption: rich(v.caption) }) });
        break;
      }
      case "bookmark":
      case "embed":
      case "link_preview":
      case "video":
      case "pdf":
      case "file":
      case "audio": {
        const url = v.url ?? (v.type === "external" ? fileUrl(v) : undefined);
        // Uploaded files' links expire, so only lasting links are kept.
        if (url) push({ t: "link", url, title: plain(rich(v.caption)) || v.name || url });
        break;
      }
      case "child_page":
        found(b.id, v.title ?? "");
        push({ t: "page", id: b.id, title: v.title ?? "" });
        break;
      case "link_to_page":
        if (v.page_id) push({ t: "page", id: v.page_id, title: "" });
        break;
      case "child_database":
        push({ t: "link", url: `https://www.notion.so/${b.id.replace(/-/g, "")}`, title: `${v.title || "Database"} (in Notion)` });
        break;
      case "column_list":
      case "column":
      case "synced_block":
        if (c) out.push(...c);
        break;
      // table_of_contents, breadcrumb, template, unsupported: nothing to show.
    }
  }
  return out;
}

/** Every bit of text in the blocks, for word counts and the summary. */
export function texts(blocks: Block[]): string[] {
  const out: string[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      if ("r" in b) out.push(plain(b.r));
      if ("items" in b) for (const i of b.items) (out.push(plain(i.r)), i.c && walk(i.c));
      if ("c" in b && b.c) walk(b.c);
      if (b.t === "table") for (const row of b.rows) for (const cell of row) out.push(plain(cell));
      if (b.t === "code") out.push(b.text);
    }
  };
  walk(blocks);
  return out;
}

export function summary(blocks: Block[]): string {
  const first = blocks.find((b) => (b.t === "p" || b.t === "callout" || b.t === "quote") && plain(b.r).trim().length > 30);
  const text = first && "r" in first ? plain(first.r).replace(/\s+/g, " ").trim() : "";
  return text.length > 180 ? `${text.slice(0, 177).replace(/\s+\S*$/, "")}…` : text;
}

/** The page id from an id or a Notion URL (the last 32 hex digits before any query). */
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

export function pageTitle(page: Json): string {
  const prop: Json = Object.values(page.properties ?? {}).find((p: Json) => p?.type === "title");
  return plain(rich(prop?.title)) || "Untitled";
}

export const pageIcon = (page: Json): string | undefined => page.icon?.emoji ?? page.icon?.external?.url;
