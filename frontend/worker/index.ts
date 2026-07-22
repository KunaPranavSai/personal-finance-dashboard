// Custom service worker source, merged into the generated Workbox worker by
// @ducanh2912/next-pwa (see next.config.ts). Runs in the ServiceWorkerGlobalScope.
//
// Handles the Background Sync side of the offline queue: if the tab that
// queued a mutation gets closed before connectivity returns, the browser
// wakes this worker to flush IndexedDB directly, rather than requiring the
// app to be open. Keep the store name/shape in sync with
// src/lib/offlineQueue.ts.

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const DB_NAME = "penny-pilot-offline";
const DB_VERSION = 1;
const STORE_NAME = "mutation-queue";
const SYNC_TAG = "penny-pilot-sync-queue";

interface QueuedMutation {
  id: string;
  entity: string;
  method: "POST";
  path: string;
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

async function getAll(): Promise<QueuedMutation[]> {
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

async function remove(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function notifyClients(message: { type: string; count?: number }) {
  const clientsList = await self.clients.matchAll({ type: "window" });
  clientsList.forEach((client) => client.postMessage(message));
}

async function flushQueue() {
  const items = await getAll();
  let synced = 0;

  for (const item of items) {
    try {
      // The app tells us its API origin right after registering (see
      // OfflineSyncManager.tsx) since the frontend and backend are on
      // different origins. Without it yet, fall back to same-origin.
      const base = (self as unknown as { __PENNY_PILOT_API_ORIGIN__?: string }).__PENNY_PILOT_API_ORIGIN__ ?? "";
      const res = await fetch(`${base}${item.path}`, {
        method: item.method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
      });
      if (res.ok) {
        await remove(item.id);
        synced += 1;
      } else {
        break; // server rejected it (or auth expired) — leave it queued, don't hammer retries
      }
    } catch {
      break; // still offline — stop, the next sync event or 'online' listener will retry
    }
  }

  if (synced > 0) {
    await notifyClients({ type: "PENNY_PILOT_SYNC_COMPLETE", count: synced });
  }
}

self.addEventListener("sync", (event) => {
  const syncEvent = event as unknown as { tag: string; waitUntil: (p: Promise<unknown>) => void };
  if (syncEvent.tag === SYNC_TAG) {
    syncEvent.waitUntil(flushQueue());
  }
});

// Allow the page to trigger skipWaiting() on demand (see ServiceWorkerUpdatePrompt.tsx).
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "SET_API_ORIGIN") {
    (self as unknown as { __PENNY_PILOT_API_ORIGIN__?: string }).__PENNY_PILOT_API_ORIGIN__ = event.data.origin;
  }
});
