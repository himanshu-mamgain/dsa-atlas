// Builds your Notion DSA notes into the site, after `vite build`:
// dist/notion/index.json lists them and dist/notion/<id>.json holds each one,
// with images saved beside them (Notion's own image links expire after an hour).
// The app shows them in the Notes section, on matching problems, and in search.
// Same format and encryption as Structura's notes.
//
// Needs, in Netlify's environment variables (or the shell):
//   NOTION_TOKEN          an internal integration's secret (notion.so/profile/integrations)
//   NOTION_ROOT_PAGE_ID   the page whose sub-pages are the notes (its id or URL), e.g.
//                         "DSA — Data Structures & Algorithms"; share it with the
//                         integration (••• → Connections)
//   NOTION_PASSPHRASE     recommended: the site is public, so with this every file is
//                         encrypted and the app asks for it once
//   NOTION_EXCLUDE        optional: comma-separated titles (or ids) to leave out
//   NOTION_MAX_DEPTH      optional: how many levels of sub-pages to include (default 4)
// Without a token it does nothing, and the app hides notes. A Notion error never
// fails the build: the deploy just goes out without notes, and the log says why.
//
//   npx tsx scripts/notion.ts   (run by `npm run build`)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Block,
  deriveKey,
  type NoteFile,
  type NoteMeta,
  type NotesIndex,
  PBKDF2_ITERATIONS,
  type PublishedIndex,
  saltFor,
  seal,
  toBase64,
} from "../../../packages/shared/src/notes";
import { api, convert, pageIcon, pageIdOf, pageTitle, type RawBlock, stats, summary, texts, tree } from "./notion-lib";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "../dist/notion");
// node_modules survives between Netlify builds, so unchanged pages aren't fetched again.
const CACHE = join(here, "../../../node_modules/.cache/dsa-atlas-notion");
const MAX_DEPTH = Math.min(Math.max(Number(process.env.NOTION_MAX_DEPTH) || 4, 1), 6);
const MAX_IMAGE = 8 * 1024 * 1024;

interface Cached {
  edited: string;
  raw: RawBlock[];
}

function readCache(id: string): Cached | null {
  try {
    return JSON.parse(readFileSync(join(CACHE, `${id}.json`), "utf8")) as Cached;
  } catch {
    return null;
  }
}

async function main() {
  const token = process.env.NOTION_TOKEN?.trim();
  const root = pageIdOf(process.env.NOTION_ROOT_PAGE_ID ?? "");
  if (!token || !root) {
    console.log("notion: skipped (set NOTION_TOKEN and NOTION_ROOT_PAGE_ID to build notes)");
    return;
  }
  const passphrase = process.env.NOTION_PASSPHRASE ?? "";
  const exclude = new Set(
    (process.env.NOTION_EXCLUDE ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  mkdirSync(CACHE, { recursive: true });

  const rootPage = await api(token, `/pages/${root}`);
  const notes: (NoteMeta & { blocks: Block[] })[] = [];
  const left = new Set<string>();
  let reused = 0;

  // Breadth first from the root, so the list follows Notion's order.
  let level: { id: string; parent: string | null }[] = [{ id: root, parent: null }];
  for (let depth = 0; depth <= MAX_DEPTH && level.length; depth++) {
    const next: { id: string; parent: string | null }[] = [];
    const pages = await Promise.all(
      level.map(async ({ id, parent }) => {
        const page = depth === 0 ? rootPage : await api(token, `/pages/${id}`);
        const title = pageTitle(page);
        if (depth > 0 && (exclude.has(title.toLowerCase()) || exclude.has(id) || exclude.has(id.replace(/-/g, "")))) {
          left.add(id);
          return null;
        }
        const cached = readCache(id);
        let raw: RawBlock[];
        // Pages that hold sub-pages are always read again: a new sub-page may not
        // change its parent's edit time. They're mostly lists, so it's cheap.
        if (cached && cached.edited === page.last_edited_time && !cached.raw.some((b) => b.type === "child_page")) {
          raw = cached.raw;
          reused++;
        } else {
          raw = await tree(token, id);
          writeFileSync(join(CACHE, `${id}.json`), JSON.stringify({ edited: page.last_edited_time, raw }));
        }
        const found: { id: string; title: string }[] = [];
        const blocks = convert(raw, (child, childTitle) => found.push({ id: child, title: childTitle }));
        if (depth < MAX_DEPTH) next.push(...found.map((f) => ({ id: f.id, parent: depth === 0 ? null : id })));
        if (depth === 0) return null; // The root lists the notes; it isn't one itself.
        const words = texts(blocks).join(" ").split(/\s+/).filter(Boolean).length;
        return { id, title, icon: pageIcon(page), url: page.url, edited: page.last_edited_time, parent, summary: summary(blocks), words, blocks };
      }),
    );
    notes.push(...pages.filter((p) => p !== null));
    level = next;
  }

  // Sub-page links get their titles; links to pages outside the notes become Notion links.
  const byId = new Map(notes.map((n) => [n.id, n]));
  const fix = (blocks: Block[]): Block[] =>
    blocks.flatMap((b): Block[] => {
      if (b.t === "page") {
        if (left.has(b.id)) return [];
        const note = byId.get(b.id);
        return note
          ? [{ ...b, title: note.title }]
          : b.title
            ? [{ t: "link", url: `https://www.notion.so/${b.id.replace(/-/g, "")}`, title: `${b.title} (in Notion)` }]
            : [];
      }
      if ("c" in b && b.c) return [{ ...b, c: fix(b.c) }];
      if ("items" in b) return [{ ...b, items: b.items.map((i) => (i.c ? { ...i, c: fix(i.c) } : i)) }];
      return [b];
    });
  for (const n of notes) n.blocks = fix(n.blocks);

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "img"), { recursive: true });
  const salt = await saltFor(root);
  const key = passphrase ? await deriveKey(passphrase, salt, PBKDF2_ITERATIONS) : null;
  const write = async (name: string, bytes: Uint8Array<ArrayBuffer>) =>
    writeFileSync(join(OUT, key ? name.replace(/\.\w+$/, ".bin") : name), key ? await seal(key, bytes) : bytes);
  const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

  // Images: downloaded once (by block id) and kept in the cache.
  let images = 0;
  const saveImages = async (blocks: Block[]): Promise<void> => {
    for (const b of blocks) {
      if (b.t === "img" && b.src.startsWith("notion-file:")) {
        const [id, url] = b.src.slice("notion-file:".length).split("|");
        const ext = (url.split("?")[0].match(/\.(png|jpe?g|gif|webp|svg)$/i)?.[1] ?? "png").toLowerCase();
        const cached = join(CACHE, `img-${id}.${ext}`);
        try {
          if (!existsSync(cached)) {
            const res = await fetch(url);
            const bytes = new Uint8Array(await res.arrayBuffer());
            if (!res.ok || bytes.length > MAX_IMAGE) throw new Error(`image ${res.status}, ${bytes.length} bytes`);
            writeFileSync(cached, bytes);
          }
          await write(`img/${id}.${ext}`, new Uint8Array(readFileSync(cached)));
          b.src = `/notion/img/${id}.${key ? "bin" : ext}`;
          images++;
        } catch (error) {
          console.warn(`notion: left out an image (${(error as Error).message})`);
          b.src = "";
        }
      }
      if ("c" in b && b.c) await saveImages(b.c);
      if ("items" in b) for (const i of b.items) if (i.c) await saveImages(i.c);
    }
  };

  for (const { blocks, ...meta } of notes) {
    await saveImages(blocks);
    const file: NoteFile = { id: meta.id, blocks: blocks.filter((b) => b.t !== "img" || b.src) };
    await write(`${meta.id}.json`, json(file));
  }

  const index: NotesIndex = {
    title: pageTitle(rootPage),
    url: rootPage.url,
    built: new Date().toISOString(),
    notes: notes.map(({ blocks: _, ...meta }) => meta),
  };
  const published: PublishedIndex = key
    ? { v: 1, locked: { salt: toBase64(salt), iter: PBKDF2_ITERATIONS, data: toBase64(await seal(key, json(index))) } }
    : { v: 1, index };
  writeFileSync(join(OUT, "index.json"), JSON.stringify(published));
  console.log(
    `notion: ${notes.length} notes and ${images} images from "${index.title}"${key ? ", locked with the passphrase" : " (public: set NOTION_PASSPHRASE to lock them)"}; ${stats.requests} requests, ${reused} pages unchanged`,
  );
}

main().catch((error: Error) => {
  rmSync(OUT, { recursive: true, force: true });
  console.warn(`notion: no notes this build. ${error.message}`);
});
