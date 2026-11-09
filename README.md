# DSA Atlas

Your DSA notebook: brute force → optimal, time/space complexity graphs, and side-by-side language comparisons for every problem.

Installable PWA (Android, iOS, desktop) that works offline. Notes stay on your device. Companion to [Structura](https://structura-web.netlify.app/): problems can link to Structura topics.

## Features (phase 1)

- **Problems** with difficulty, platform link, topics, patterns and Structura topic links
- **Approaches**: brute force → better → optimal, each with its key idea and time/space complexity
- **Code in many languages** (C++, Java, Python, JavaScript, TypeScript, Rust, Go) in the Monaco editor (the VS Code editor), bundled locally so it works offline, with a symbol key bar on phones
- **Compare**: diff any two solutions, e.g. brute C++ vs optimal Python, with per-language notes
- **Complexity graph** of every approach, with optional reference curves
- **Spaced repetition**: problems come back after 1 → 3 → 7 → 14 → 30 → 60 days; streak and topic progress on the home screen
- **Master Checklist**: your Notion "Must Solve Problems by Pattern" list (3 tiers, 134 problems) with ticks, Notion links, practice steps and pattern signals. Snapshot in `apps/web/src/data/notion/`; regenerate with `npm run checklist -w @dsa-atlas/web`
- **Solve page** for every checklist problem (`?solve=<id>`): the statement from its Notion page, hints (core insight, dry run, edge cases…) folded away until you need them, your own editor (saved on the device), and the reference solutions from your notes, brute force → optimal. "Mark solved" ticks it off and puts it into revision.
- **Measured complexity**: runs each JavaScript solution (yours and the notes') in a Web Worker on inputs grown from the problem's example, from n = 2 up to about 250,000, on whichever variant is slowest (all equal, sorted, a palindrome, balanced brackets…), and fits O(1) … O(n!) to the work it counts: loop passes, calls, and built-ins like sort and slice. Steps instead of milliseconds, so the answer is the same every run; time is shown beside it. Code in `packages/complexity` (`inputs`, `instrument`, `fit`) and `apps/web/src/measure`.
- **Company goals**: target a company by a date (GoKwik, Ram Fincorp, ixigo, Cars24, CarDekho, or any), start from your checklist, see the pace per day and what to solve next
- **The Structura look**: the same dark theme, five tabs along the bottom on phones and in the top bar on desktop, pattern rings and "Up next" tiles on Today
- **Backup**: JSON export/import
- **Push reminders** (phase 2): a daily notification at your chosen time when problems are due. Only titles and due dates go to the server.

## Getting started

Requires Node 20+.

```sh
npm install
npm run dev
```

Open http://localhost:5173.

## Repository

npm workspaces, TypeScript, React 19, Vite 8, Motion, Recharts, Dexie (IndexedDB), vite-plugin-pwa.

| Path | What it is |
| --- | --- |
| `apps/web` | The PWA: pages, Monaco editor, graphs, service worker |
| `packages/shared` | Data types shared by the app and (later) the push functions |
| `packages/review` | Spaced-repetition logic, shared by the app and the reminder function |
| `packages/complexity` | Big-O parsing, example parsing, input generation, step counting and curve fitting |
| `netlify/functions` | `push` (`/api/push`: subscribe, unsubscribe, test) and `daily-reminders` (hourly schedule) |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the app with hot reload |
| `npm run build` | Type-checks and builds the app |
| `npm run typecheck` | Type-checks every workspace |
| `npm test` | Unit tests (Vitest) for `review` and `complexity` |
| `npm run icons -w @dsa-atlas/web` | Regenerates PWA icons from `public/favicon.svg` |

## Roadmap

1. ✅ Problems, approaches, Monaco, offline PWA, complexity graph, compare, spaced repetition
2. ✅ Netlify push reminders (scheduled function + Web Push + Netlify Blobs)
3. ✅ Run JavaScript in the browser and measure its complexity (Python via Pyodide later)
4. Chrome extension to capture problems from LeetCode/GFG

## Notion notes

Same setup as Structura. Each deploy copies your Notion DSA page and its sub-pages into the site (`apps/web/scripts/notion.ts`), encrypted with a passphrase because the site is public. The app shows them under **Notion notes**, in Ctrl+K search, and on matching problems (same title, ignoring anything in brackets, or a Notion link from the checklist). The build also refreshes the Master Checklist from Notion (`scripts/notion-checklist.ts`); ticks there apply to problems you haven't ticked or unticked in the app.

**Save to Notion** on a problem seals the note with the notes key and sends it to `/api/notion-note` (`netlify/functions/notion-note.mts`), which appends it to *<your DSA page> / Notes from DSA Atlas / <problem>*. It shows up in the app after the next deploy.

Netlify environment variables (scope: Builds and Functions):

| Variable | Value |
| --- | --- |
| `NOTION_TOKEN` | an internal integration's secret (notion.so/profile/integrations). Share your DSA page with it (••• → Connections). Saving back needs the "Insert content" capability. Structura's integration works too. |
| `NOTION_ROOT_PAGE_ID` | your "DSA — Data Structures & Algorithms" page (its URL or id) |
| `NOTION_PASSPHRASE` | encrypts the notes; the app asks for it once per browser |
| `NOTION_EXCLUDE` | optional: comma-separated titles to leave out |
| `NOTION_MAX_DEPTH` | optional: levels of sub-pages to include (default 4) |
| `NOTION_CHECKLIST_PAGE_ID` | optional: the checklist page (defaults to the Master Checklist) |

Without a token both steps are skipped: the app hides notes and keeps the saved checklist. A Notion error never fails the build. Unchanged pages are reused from `node_modules/.cache/dsa-atlas-notion`. Test locally against a mock with `NOTION_API=<url>`. Never commit the token or generated notes.

## Deployment

Push reminders need three environment variables on Netlify (Site configuration → Environment variables, scope: Functions), then a redeploy:

| Variable | Value |
| --- | --- |
| `VAPID_PUBLIC_KEY` | from `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | from the same command; keep it secret, never commit it |
| `VAPID_SUBJECT` | optional: `mailto:` plus your email (defaults to a noreply address) |

Subscriptions are stored in Netlify Blobs (store `push-subscriptions`).

Netlify builds with `netlify.toml` (`npm run build -w @dsa-atlas/web`, publishing `apps/web/dist`).
