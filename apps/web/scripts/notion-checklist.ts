// Refreshes src/data/checklist.json from your Notion "Master Checklist" page,
// before `vite build` (the checklist is part of the app). Ticks there become the
// starting ticks for problems this device hasn't touched.
//
//   NOTION_TOKEN               the same integration as the notes
//   NOTION_CHECKLIST_PAGE_ID   optional: the checklist page (defaults to the Master Checklist)
// Without a token, or if Notion fails, the saved checklist.json is kept and the
// build carries on.
//
//   npx tsx scripts/notion-checklist.ts   (run by `npm run build`)
import { readFile, writeFile } from "node:fs/promises";
import { api, pageIdOf, tree } from "./notion-lib";
import { checklistFromBlocks, countItems } from "./checklist-from-notion";

const OUT = new URL("../src/data/checklist.json", import.meta.url);
const DEFAULT_PAGE = "38663e41004f819785bfdf128b6e6d40";

async function main() {
  const token = process.env.NOTION_TOKEN?.trim();
  const page = pageIdOf(process.env.NOTION_CHECKLIST_PAGE_ID || DEFAULT_PAGE);
  if (!token || !page) {
    console.log("notion-checklist: skipped (no NOTION_TOKEN); using the saved checklist");
    return;
  }
  const meta = await api(token, `/pages/${page}`);
  const checklist = checklistFromBlocks(await tree(token, page), `https://app.notion.com/p/${page.replace(/-/g, "")}`);
  const count = countItems(checklist);
  // A page that didn't parse (renamed headings, wrong page) must not wipe the checklist.
  if (checklist.tiers.length === 0 || count === 0) throw new Error(`"${meta.url}" has no "Tier N — …" sections with to-dos`);
  const next = JSON.stringify(checklist, null, 1) + "\n";
  const prev = await readFile(OUT, "utf8").catch(() => "");
  if (prev !== next) await writeFile(OUT, next);
  console.log(`notion-checklist: ${checklist.tiers.length} tiers, ${count} problems${prev === next ? " (unchanged)" : " (updated)"}`);
}

main().catch((error: Error) => console.warn(`notion-checklist: kept the saved checklist. ${error.message}`));
