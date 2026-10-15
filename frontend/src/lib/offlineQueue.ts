"use client";

// Minimal, dependency-free IndexedDB queue for mutations made while offline.
// Shared shape with worker/index.ts, which reads the same store from the
// service worker during a Background Sync event — keep the two in sync if
// this schema ever changes.

const DB_NAME = "penny-pilot-offline";
const DB_VERSION = 1;
export const STORE_NAME = "mutation-queue";
export const SYNC_TAG = "penny-pilot-sync-queue";

export type QueuedEntity = "expense" | "income" | "budget" | "investment";

export interface QueuedMutation {
  id: string;
  entity: QueuedEntity;
  method: "POST";
  path: string; // e.g. "/api/transactions"
  body: unknown;
  createdAt: string;
  /** Same key sent on the original (failed-to-reach-server) attempt — reused
   * on every later flush of this queued item so a duplicate create can never
   * result from retrying the same queued mutation more than once. */
  idempotencyKey: string;
  /** uid of the account that made the change. A queued write is only ever sent under that same account. */
  owner?: string;
  /** failed sync attempts that were retryable (network, 5xx, 429...) */
  attempts?: number;
  /** "rejected": the server definitively refused it (validation, conflict). Never retried automatically and
   * never silently deleted: the user decides (retry or discard). */
  status?: "pending" | "rejected";
  lastError?: string;
}

// Who the queue belongs to right now. Also mirrored into Cache Storage so the service worker (which has no
// access to React state) can refuse to flush another account's queued writes.
export const OWNER_CACHE = "pp-queue-owner";
export const OWNER_KEY = "/__pp_queue_owner";
let currentOwner: string | null = null;
export const getQueueOwner = () => currentOwner;
export async function setQueueOwner(uid: string | null): Promise<void> {
  currentOwner = uid;
  try {
    const cache = await caches.open(OWNER_CACHE);
    if (uid) await cache.put(OWNER_KEY, new Response(uid));
    else await cache.delete(OWNER_KEY);
  } catch {
    /* Cache Storage unavailable: the SW then skips owner-tagged items (safe default) */
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueMutation(entity: QueuedEntity, path: string, body: unknown, idempotencyKey: string): Promise<QueuedMutation> {
  const db = await openDb();
  const item: QueuedMutation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    entity,
    method: "POST",
    path,
    body,
    createdAt: new Date().toISOString(),
    idempotencyKey,
    owner: currentOwner ?? undefined,
    attempts: 0,
    status: "pending",
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  // Ask the service worker to flush this in the background even if the tab
  // closes before connectivity returns. Silently no-ops where unsupported
  // (Safari/iOS) — the 'online' event listener in OfflineSyncManager is the
  // fallback for those browsers.
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration && "sync" in registration) {
      await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register(SYNC_TAG);
    }
  } catch {
    // Background Sync not supported or permission denied — fine, the online-event fallback still applies.
  }

  return item;
}

export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  const db = await openDb();
  const items = await new Promise<QueuedMutation[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as QueuedMutation[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeQueuedMutation(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function updateQueuedMutation(id: string, patch: Partial<QueuedMutation>): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const get = store.get(id);
    get.onsuccess = () => {
      if (get.result) store.put({ ...get.result, ...patch, id });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Items still waiting to sync (not counting rejected ones). */
export async function countQueuedMutations(): Promise<number> {
  return (await getQueuedMutations()).filter((i) => i.status !== "rejected").length;
}

export async function getRejectedMutations(): Promise<QueuedMutation[]> {
  return (await getQueuedMutations()).filter((i) => i.status === "rejected");
}
