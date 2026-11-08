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
- **Backup**: JSON export/import

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
| `packages/complexity` | Big-O parsing and curve sampling for the graph |

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
2. Netlify push reminders (scheduled function + Web Push + Netlify Blobs)
3. Run code in the browser (JS worker, Python via Pyodide) and plot measured runtimes
4. Chrome extension to capture problems from LeetCode/GFG

## Deployment

Netlify builds with `netlify.toml` (`npm run build -w @dsa-atlas/web`, publishing `apps/web/dist`).
