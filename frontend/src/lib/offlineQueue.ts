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

export async function enqueueMutation(entity: QueuedEntity, path: string, body: unknown): Promise<QueuedMutation> {
  const db = await openDb();
  const item: QueuedMutation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    entity,
    method: "POST",
    path,
    body,
    createdAt: new Date().toISOString(),
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

export async function countQueuedMutations(): Promise<number> {
  const items = await getQueuedMutations();
  return items.length;
}
