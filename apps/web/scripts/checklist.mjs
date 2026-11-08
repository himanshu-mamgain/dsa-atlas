// Turns the Notion "Master Checklist" snapshot (src/data/notion/master-checklist.md)
// into src/data/checklist.json for the Checklist page.
//   npm run checklist -w @dsa-atlas/web
import { readFile, writeFile } from "node:fs/promises";

const SRC = new URL("../src/data/notion/master-checklist.md", import.meta.url);
const OUT = new URL("../src/data/checklist.json", import.meta.url);
const NOTION = "https://app.notion.com";
const PAGE = "https://app.notion.com/p/38663e41004f819785bfdf128b6e6d40";

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const md = await readFile(SRC, "utf8");
const tiers = [];
const practice = [];
const signals = [];
let tier = null;
let section = null;
let block = null;
const seen = new Set();

for (const raw of md.split(/\r?\n/)) {
  const line = raw.trim();
  let m;
  if ((m = line.match(/^# Tier (\d) — (.+)$/))) {
    tier = { tier: Number(m[1]), title: m[2], sections: [] };
    tiers.push(tier);
    block = "tier";
  } else if (line === "# Practice") block = "practice";
  else if (line === "# Pattern Recognition") block = "signals";
  else if (block === "tier" && (m = line.match(/^## (.+)$/))) {
    section = { pattern: m[1], items: [] };
    tier.sections.push(section);
  } else if (block === "tier" && (m = line.match(/^- \[( |x)\] (.+)$/))) {
    const done = m[1] === "x";
    const link = m[2].match(/^\[(.+)\]\((\/p\/[0-9a-f]+)\)$/);
    const title = link ? link[1] : m[2];
    let id = slug(title);
    if (seen.has(id)) id = `${id}-t${tier.tier}`;
    seen.add(id);
    section.items.push({ id, title, ...(link ? { notion: NOTION + link[2] } : {}), done });
  } else if (block === "practice" && (m = line.match(/^\d+\. (.+)$/))) practice.push(m[1]);
  else if (block === "signals" && (m = line.match(/^\| (.+?) \| (.+?) \|$/))) signals.push({ when: m[1], think: m[2] });
}

const count = tiers.reduce((n, t) => n + t.sections.reduce((k, s) => k + s.items.length, 0), 0);
await writeFile(OUT, JSON.stringify({ source: PAGE, tiers, practice, signals }, null, 1) + "\n");
console.log(`checklist: ${tiers.length} tiers, ${count} problems, ${practice.length} practice steps, ${signals.length} signals`);
