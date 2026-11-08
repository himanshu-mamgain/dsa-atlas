// Turns the blocks of the Notion "Master Checklist" page into the app's
// checklist (src/data/checklist.json). Pure, so it can be tested.
//   # Tier N — Title          (heading 1)
//   ## Pattern                (heading 2)
//   - [x] Problem (linked)    (to-do, nested ones included)
//   # How to Practice         → the numbered lines (a code block or a numbered list)
//   # Pattern Recognition …   → the table's rows (first row is the header)
import type { Json, RawBlock } from "./notion-lib";
import { plain, rich } from "./notion-lib";

export interface ChecklistJson {
  source: string;
  tiers: { tier: number; title: string; sections: { pattern: string; items: { id: string; title: string; notion?: string; done: boolean }[] }[] }[];
  practice: string[];
  signals: { when: string; think: string }[];
}

// Same ids as scripts/checklist.mjs, so ticks saved on devices keep matching.
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * A link to a Notion page, as an app.notion.com URL; undefined for other links.
 * The API gives links to pages in the same workspace as "/<id>".
 */
function notionUrl(href: string | undefined): string | undefined {
  if (!href) return undefined;
  if (!/notion\.(so|com|site)|^\//.test(href)) return undefined;
  const hex = href.split("?")[0].replace(/-/g, "").match(/[0-9a-f]{32,}/gi)?.at(-1)?.slice(-32).toLowerCase();
  return hex ? `https://app.notion.com/p/${hex}` : undefined;
}

const textOf = (b: RawBlock) => plain(rich(b[b.type]?.rich_text)).trim();

export function checklistFromBlocks(raw: RawBlock[], source: string): ChecklistJson {
  const out: ChecklistJson = { source, tiers: [], practice: [], signals: [] };
  let block: "tier" | "practice" | "signals" | null = null;
  let tier: ChecklistJson["tiers"][number] | null = null;
  let section: ChecklistJson["tiers"][number]["sections"][number] | null = null;
  const seen = new Set<string>();

  const addTodo = (b: RawBlock) => {
    if (!tier) return;
    if (!section) {
      section = { pattern: "General", items: [] };
      tier.sections.push(section);
    }
    const r = rich(b.to_do?.rich_text);
    const title = plain(r).trim();
    if (title) {
      let id = slug(title);
      if (seen.has(id)) id = `${id}-t${tier.tier}`;
      seen.add(id);
      const notion = notionUrl(r.find((x) => x[2])?.[2]);
      section.items.push({ id, title, ...(notion ? { notion } : {}), done: Boolean(b.to_do?.checked) });
    }
    for (const k of b.kids ?? []) if (k.type === "to_do") addTodo(k);
  };

  for (const b of raw) {
    const text = b.type.startsWith("heading_") ? textOf(b) : "";
    if (b.type === "heading_1") {
      const m = text.match(/^Tier\s+(\d+)\s*[—–-]\s*(.+)$/i);
      if (m) {
        tier = { tier: Number(m[1]), title: m[2].trim(), sections: [] };
        out.tiers.push(tier);
        section = null;
        block = "tier";
      } else if (/how to practi[cs]e/i.test(text)) block = "practice";
      else if (/pattern recognition/i.test(text)) block = "signals";
      else block = null;
      continue;
    }
    if (block === "tier" && b.type === "heading_2" && tier) {
      section = { pattern: text, items: [] };
      tier.sections.push(section);
      continue;
    }
    if (block === "tier" && b.type === "to_do") addTodo(b);
    if (block === "practice") {
      const lines =
        b.type === "code"
          ? plain(rich(b.code?.rich_text)).split(/\r?\n/)
          : b.type === "numbered_list_item"
            ? [`1. ${textOf(b) || plain(rich(b.numbered_list_item?.rich_text))}`]
            : [];
      for (const l of lines) {
        const m = l.trim().match(/^\d+\.\s+(.+)$/);
        if (m) out.practice.push(m[1].trim());
      }
    }
    if (block === "signals" && b.type === "table") {
      const rows = (b.kids ?? []).filter((r) => r.type === "table_row").map((r) => (r.table_row.cells as Json[][]).map((c) => plain(rich(c)).trim()));
      for (const [when, think] of rows.slice(b.table?.has_column_header ? 1 : 0)) if (when && think) out.signals.push({ when, think });
    }
  }
  // Empty sections (all items left out) aren't shown.
  for (const t of out.tiers) t.sections = t.sections.filter((s) => s.items.length);
  return out;
}

export const countItems = (c: ChecklistJson) => c.tiers.reduce((n, t) => n + t.sections.reduce((k, s) => k + s.items.length, 0), 0);
