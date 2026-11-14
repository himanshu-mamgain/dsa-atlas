# App ecosystem

DSA Atlas, [Structura](https://github.com/himanshu-mamgain/structura) and [Schemata](https://github.com/himanshu-mamgain/schemata) are linked apps. Each keeps its own data on the device (no shared accounts); they connect through links and a shared app list.

## Apps

| id | Name | URL | Accent |
| --- | --- | --- | --- |
| `dsa-atlas` | DSA Atlas | https://dsa-atz.netlify.app | `#34d399` |
| `structura` | Structura | https://structura-web.netlify.app | `#a78bfa` |
| `schemata` | Schemata | https://schemata-web.netlify.app | `#38bdf8` |

Source of truth in this repo: [`packages/shared/src/ecosystem.ts`](../packages/shared/src/ecosystem.ts). Structura and Schemata (`src/ecosystem.ts`) keep the same list. When an app is added, update all three.

## Links (keep stable: the other apps build them)

| Link | URL |
| --- | --- |
| Structura topic | `https://structura-web.netlify.app/?topic=<topicId>` |
| Schemata roadmap stage or database guide | `https://schemata-web.netlify.app/?topic=<topicId>` |
| Schemata interview question | `https://schemata-web.netlify.app/?q=<questionId>` |
| Schemata SQL editor on a dataset | `https://schemata-web.netlify.app/?page=playground&dataset=<datasetId>` |
| DSA Atlas problems for a Structura topic | `https://dsa-atz.netlify.app/?page=problems&structura=<topicId>` |
| One DSA Atlas problem | `https://dsa-atz.netlify.app/?problem=<problemId>` |
| DSA Atlas checklist at one pattern | `https://dsa-atz.netlify.app/?page=checklist&pattern=<pattern>` |

`<topicId>` is the target app's topic id (kebab-case, e.g. `consistent-hashing` in Structura, `indexing` in Schemata). Schemata's `<datasetId>` is `shop`, `chinook` or `northwind`. `<pattern>` is a checklist pattern name as written in the checklist (e.g. `Trees`, `Graphs`).

## How each app uses them

**DSA Atlas**
- Each problem can list related Structura topics (picked by name in the editor). The read view shows them as "See it in Structura" cards.
- `?page=problems&structura=<id>` shows the problems linked to that topic, with a link back.
- Structura's topic list comes from `https://structura-web.netlify.app/topics.json`, copied at build time into `apps/web/src/data/structura-topics.json` (that file has no CORS header, so browsers can't fetch it cross-site). If the download fails, the saved copy is used.
- Checklist: the `Trees` pattern links to Schemata's `indexing` topic (B-tree indexes), and `Graphs` and `Recursion` link to `subqueries` (recursive CTEs), as "Databases use this".
- Header: an app switcher listing all three apps.

**Schemata**
- Its topic list is at `https://schemata-web.netlify.app/topics.json` (`[{ id, title, blurb }]`, served with `Access-Control-Allow-Origin: *`). Schemata is not deployed yet, so nothing in this repo's build fetches it; the topic ids DSA Atlas links to are written in the code.
- Links back to DSA Atlas checklist patterns (`Trees` for B-trees, `Graphs` for recursive CTEs).

**Structura** (to do in the Structura repo)
- Header: the same app switcher.
- Each topic page: a "Practice related DSA problems" link to `?page=problems&structura=<topicId>` on DSA Atlas.

## Not shared (on purpose, for now)

Notes, progress and push subscriptions stay in each app on each device. Shared accounts and sync would need a backend; see the discussion in the PR that introduced this file.
