// Refreshes src/data/structura-topics.json from the live Structura site.
// Runs before each build. Structura's topics.json can't be fetched from the
// browser (no CORS header), so DSA Atlas ships a copy. If the download fails,
// the committed copy is kept and the build carries on.
import { readFile, writeFile } from "node:fs/promises";

const URL = "https://structura-web.netlify.app/topics.json";
const OUT = new globalThis.URL("../src/data/structura-topics.json", import.meta.url);

try {
  const res = await fetch(URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const topics = await res.json();
  const valid =
    Array.isArray(topics) &&
    topics.length > 0 &&
    topics.every((t) => typeof t?.id === "string" && typeof t?.title === "string" && typeof t?.blurb === "string");
  if (!valid) throw new Error("unexpected shape");
  const next = JSON.stringify(topics.map(({ id, title, blurb }) => ({ id, title, blurb })));
  const prev = await readFile(OUT, "utf8").catch(() => "");
  if (prev.trim() !== next) await writeFile(OUT, next);
  console.log(`structura-topics: ${topics.length} topics${prev.trim() === next ? " (unchanged)" : " (updated)"}`);
} catch (err) {
  console.warn(`structura-topics: keeping the saved copy (${err.message})`);
}
