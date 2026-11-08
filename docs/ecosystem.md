# App ecosystem

DSA Atlas and [Structura](https://github.com/himanshu-mamgain/structura) are linked apps. Each keeps its own data on the device (no shared accounts); they connect through links and a shared app list.

## Apps

| id | Name | URL | Accent |
| --- | --- | --- | --- |
| `dsa-atlas` | DSA Atlas | https://dsa-atz.netlify.app | `#34d399` |
| `structura` | Structura | https://structura-web.netlify.app | `#a78bfa` |

Source of truth in this repo: [`packages/shared/src/ecosystem.ts`](../packages/shared/src/ecosystem.ts). Structura keeps the same list. When an app is added, update both.

## Links (keep stable: the other app builds them)

| Link | URL |
| --- | --- |
| Structura topic | `https://structura-web.netlify.app/?topic=<topicId>` |
| DSA Atlas problems for a Structura topic | `https://dsa-atz.netlify.app/?page=problems&structura=<topicId>` |
| One DSA Atlas problem | `https://dsa-atz.netlify.app/?problem=<problemId>` |

`<topicId>` is Structura's topic id (kebab-case, e.g. `consistent-hashing`).

## How each app uses them

**DSA Atlas**
- Each problem can list related Structura topics (picked by name in the editor). The read view shows them as "See it in Structura" cards.
- `?page=problems&structura=<id>` shows the problems linked to that topic, with a link back.
- Structura's topic list comes from `https://structura-web.netlify.app/topics.json`, copied at build time into `apps/web/src/data/structura-topics.json` (that file has no CORS header, so browsers can't fetch it cross-site). If the download fails, the saved copy is used.
- Header: an app switcher listing both apps.

**Structura** (to do in the Structura repo)
- Header: the same app switcher.
- Each topic page: a "Practice related DSA problems" link to `?page=problems&structura=<topicId>` on DSA Atlas.

## Not shared (on purpose, for now)

Notes, progress and push subscriptions stay in each app on each device. Shared accounts and sync would need a backend; see the discussion in the PR that introduced this file.
