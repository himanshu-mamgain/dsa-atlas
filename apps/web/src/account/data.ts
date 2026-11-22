import type { EntityTable, Transaction } from "dexie";
import { db } from "../db/db";
import { stable, type AtlasData } from "./merge";

// Reads and writes the copy of your data that syncs with the Studia account (merge.ts), and
// tells the account when something here changed.

const TABLES = [db.problems, db.checklist, db.goals, db.attempts, db.deleted];

/** Everything to sync, read from IndexedDB in one go. */
export async function snapshot(): Promise<AtlasData> {
  return db.transaction("r", TABLES, async () => {
    const [problems, checklist, goals, attempts, deleted] = await Promise.all([
      db.problems.toArray(),
      db.checklist.toArray(),
      db.goals.toArray(),
      db.attempts.toArray(),
      db.deleted.toArray(),
    ]);
    return { version: 1 as const, problems, checklist, goals, attempts, deleted: Object.fromEntries(deleted.map((d) => [d.key, d.at])) };
  });
}

/** Marks the transactions that write what came from the account, so they don't count as your changes. */
const fromAccount = new WeakSet<Transaction>();

/** Writes the merged copy here: only the records that differ, and removes what was deleted elsewhere. */
export async function applySnapshot(next: AtlasData, current: AtlasData) {
  await db.transaction("rw", TABLES, async (tx) => {
    fromAccount.add(tx);
    const sync = async <T extends { id: string }>(table: EntityTable<T, "id">, now: T[], was: T[]) => {
      const old = new Map(was.map((x) => [x.id, stable(x)]));
      const keep = new Set(now.map((x) => x.id));
      const put = now.filter((x) => old.get(x.id) !== stable(x));
      const gone = was.filter((x) => !keep.has(x.id)).map((x) => x.id);
      if (put.length) await table.bulkPut(put);
      // The id is always a string here; Dexie can't see that through the generic.
      if (gone.length) await table.bulkDelete(gone as Parameters<typeof table.bulkDelete>[0]);
    };
    await sync(db.problems, next.problems, current.problems);
    await sync(db.checklist, next.checklist, current.checklist);
    await sync(db.goals, next.goals, current.goals);
    await sync(db.attempts, next.attempts, current.attempts);
    const changed = Object.entries(next.deleted)
      .filter(([key, at]) => current.deleted[key] !== at)
      .map(([key, at]) => ({ key, at }));
    const forgotten = Object.keys(current.deleted).filter((key) => !(key in next.deleted));
    if (changed.length) await db.deleted.bulkPut(changed);
    if (forgotten.length) await db.deleted.bulkDelete(forgotten);
  });
}

let watching = false;
const listeners = new Set<() => void>();

/** Calls `fn` after each change you make here (not after writes that came from the account). */
export function onLocalChange(fn: () => void): () => void {
  listeners.add(fn);
  if (!watching) {
    watching = true;
    const changed = (tx: Transaction) => {
      if (!fromAccount.has(tx)) listeners.forEach((l) => l());
    };
    for (const table of TABLES) {
      table.hook("creating", (_key, _obj, tx) => changed(tx));
      table.hook("updating", (_mods, _key, _obj, tx) => changed(tx));
      table.hook("deleting", (_key, _obj, tx) => changed(tx));
    }
  }
  return () => listeners.delete(fn);
}
