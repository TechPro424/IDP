// Local verdict cache (IndexedDB) with 7-day TTL + model-version recheck.
export interface CachedVerdict {
  videoId: string;
  verdict: string;
  srs?: number;
  H?: number;
  reasons: { label: string; value: string }[];
  modelVersion: string;
  ts: number;
}

const DB_NAME = 'slop-filter';
const STORE = 'verdicts';
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'videoId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedVerdict(videoId: string, modelVersion: string): Promise<CachedVerdict | undefined> {
  try {
    const db = await openDb();
    const entry = await new Promise<CachedVerdict | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(videoId);
      tx.onsuccess = () => resolve(tx.result);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    if (!entry) return undefined;
    if (entry.modelVersion !== modelVersion) return undefined; // stale model
    if (Date.now() - entry.ts > CACHE_TTL_MS) return undefined; // stale
    return entry;
  } catch {
    return undefined;
  }
}

export async function putCachedVerdict(entry: CachedVerdict): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry);
      tx.onsuccess = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* cache is best-effort */
  }
}
