/**
 * Asks the browser to keep DSA Atlas's data even under storage pressure.
 * Without this, IndexedDB is "best effort" and can be evicted.
 * Browsers decide silently (Chrome grants it to installed or often-used sites;
 * Firefox may ask; Safari grants it to Home Screen apps).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export interface StorageStatus {
  persisted: boolean | null;
  usedBytes: number | null;
  quotaBytes: number | null;
}

export async function storageStatus(): Promise<StorageStatus> {
  const s = navigator.storage;
  const persisted = s?.persisted ? await s.persisted().catch(() => null) : null;
  const est = s?.estimate ? await s.estimate().catch(() => null) : null;
  return { persisted, usedBytes: est?.usage ?? null, quotaBytes: est?.quota ?? null };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
