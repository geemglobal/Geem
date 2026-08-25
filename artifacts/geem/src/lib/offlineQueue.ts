// IndexedDB-backed offline mutation queue.
// Mutations that fail because the device is offline are stored here and
// replayed automatically when connectivity is restored.

const DB_NAME = "geem-offline-v1";
const STORE = "mutations";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

export interface QueuedMutation {
  id: string;
  method: string;
  url: string;
  data?: unknown;
  token?: string;
  timestamp: number;
  label: string;
}

export async function enqueue(m: Omit<QueuedMutation, "id" | "timestamp">): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ ...m, id: crypto.randomUUID(), timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getQueue(): Promise<QueuedMutation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as QueuedMutation[]) ?? []);
    req.onerror   = () => reject(req.error);
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function clearQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/** Replay every queued mutation against the live API. */
export async function syncQueue(
  onProgress?: (done: number, total: number) => void,
): Promise<{ ok: number; failed: number }> {
  const queue = await getQueue();
  let ok = 0, failed = 0;
  for (const item of queue) {
    try {
      const res = await fetch(`/api${item.url}`, {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          ...(item.token ? { Authorization: `Bearer ${item.token}` } : {}),
        },
        body: item.data !== undefined ? JSON.stringify(item.data) : undefined,
      });
      if (res.ok) { await removeFromQueue(item.id); ok++; }
      else failed++;
    } catch { failed++; }
    onProgress?.(ok + failed, queue.length);
  }
  return { ok, failed };
}
