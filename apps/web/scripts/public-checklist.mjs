// Publishes the Master Checklist as /checklist.json (ids, titles, tiers and patterns, in order),
// so the Studia site can plan a daily queue and link each item to its solve page. Only what the
// checklist page already shows; nobody's ticks or code. Runs after `vite build`.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const checklist = JSON.parse(readFileSync(join(here, "../src/data/checklist.json"), "utf8"));
const items = checklist.tiers.flatMap((t) =>
  t.sections.flatMap((s) => s.items.map((i) => ({ id: i.id, title: i.title, tier: t.tier, pattern: s.pattern }))),
);
writeFileSync(
  join(here, "../dist/checklist.json"),
  JSON.stringify({ tiers: checklist.tiers.map((t) => ({ tier: t.tier, title: t.title })), items }),
);
console.log(`checklist.json: ${items.length} problems`);
