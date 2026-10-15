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
  idempotencyKey: string;
  owner?: string;
  attempts?: number;
  status?: "pending" | "rejected";
  lastError?: string;
}

const OWNER_CACHE = "pp-queue-owner";
const OWNER_KEY = "/__pp_queue_owner";
const MAX_ATTEMPTS = 10;

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
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
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

async function update(id: string, patch: Partial<QueuedMutation>): Promise<void> {
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

// Same classification as src/lib/offlineSync.ts (keep in sync).
function classify(status: number): "ok" | "auth" | "retry" | "reject" {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401) return "auth";
  if (status === 403 || status === 408 || status === 425 || status === 429 || status >= 500) return "retry";
  return "reject";
}

async function flushQueue() {
  // Only the account currently signed in on this browser (the page records it in Cache Storage). Nobody signed in, or
  // an item that belongs to someone else / predates account tracking: leave it for the page to handle.
  const cached = await (await caches.open(OWNER_CACHE)).match(OWNER_KEY);
  const owner = cached ? await cached.text() : null;
  if (!owner) return;

  const items = await getAll();
  let synced = 0;

  for (const item of items) {
    if (item.status === "rejected" || item.owner !== owner) continue;
    try {
      // The app tells us its API origin right after registering (see OfflineSyncManager.tsx) since the frontend
      // and backend are on different origins. Without it yet, fall back to same-origin.
      const base = (self as unknown as { __PENNY_PILOT_API_ORIGIN__?: string }).__PENNY_PILOT_API_ORIGIN__ ?? "";
      const res = await fetch(`${base}${item.path}`, {
        method: item.method,
        credentials: "include",
        headers: { "Content-Type": "application/json", "Idempotency-Key": item.idempotencyKey },
        body: JSON.stringify(item.body),
      });
      const kind = classify(res.status);
      if (kind === "ok") {
        await remove(item.id);
        synced += 1;
      } else if (kind === "reject") {
        let lastError = `The server refused it (${res.status}).`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) lastError = body.error;
        } catch {
          /* keep the generic reason */
        }
        await update(item.id, { status: "rejected", lastError }); // kept for the user to review, never deleted here
      } else {
        const attempts = (item.attempts ?? 0) + 1;
        if (attempts >= MAX_ATTEMPTS) await update(item.id, { attempts, status: "rejected", lastError: `Could not be saved after ${attempts} attempts.` });
        else await update(item.id, { attempts });
        if (kind === "auth" || attempts < MAX_ATTEMPTS) break; // keep order; stop until the next sync
      }
    } catch {
      break; // still offline: the next sync event or 'online' listener retries
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

// ─── Web Push ────────────────────────────────────────────────────────────────
// The server sends { title, body, url, tag, kind, ts, uid }. `uid` is an opaque per-user tag; the page writes
// the signed-in user's tag into Cache Storage (lib/push.ts). A push for anyone else (previous account on a
// shared device, or signed out) is dropped and its subscription ended, so it can never be displayed here.
const IDENTITY_CACHE = "pp-push-identity";
const IDENTITY_KEY = "/__pp_push_uid";

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  ts?: number;
  uid?: string;
}

async function currentIdentity(): Promise<string | null> {
  try {
    const res = await (await caches.open(IDENTITY_CACHE)).match(IDENTITY_KEY);
    return res ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Only same-origin paths are ever opened from a notification. */
function safeUrl(raw: unknown): string {
  try {
    const u = new URL(typeof raw === "string" ? raw : "/dashboard", self.location.origin);
    return u.origin === self.location.origin ? u.href : new URL("/dashboard", self.location.origin).href;
  } catch {
    return new URL("/dashboard", self.location.origin).href;
  }
}

async function onPush(event: PushEvent) {
  let data: PushPayload = {};
  try {
    data = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    data = { body: event.data?.text() };
  }
  if (data.uid && (await currentIdentity()) !== data.uid) {
    const sub = await self.registration.pushManager.getSubscription();
    await sub?.unsubscribe();
    return;
  }
  await self.registration.showNotification(data.title || "Penny Pilot", {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-72.png",
    tag: data.tag, // same tag replaces instead of stacking
    timestamp: data.ts,
    data: { url: safeUrl(data.url) },
  });
}

self.addEventListener("push", (event) => event.waitUntil(onPush(event)));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? safeUrl("/dashboard");
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if (open.url !== url && "navigate" in open) await (open as WindowClient).navigate(url);
        return;
      }
      await self.clients.openWindow(url); // app closed: opens (and, if signed out, goes through login then back here)
    })()
  );
});

// The browser rotated the subscription (expiry, key change): register the new one so notifications keep working.
// Category choices live on the old server row and are not copied; the user's settings screen shows the defaults.
self.addEventListener("pushsubscriptionchange", (event) => {
  const e = event as unknown as { oldSubscription?: PushSubscription; waitUntil: (p: Promise<unknown>) => void };
  e.waitUntil(
    (async () => {
      const key = e.oldSubscription?.options?.applicationServerKey;
      if (!key) return;
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const b64 = (n: "p256dh" | "auth") => {
        const buf = sub.getKey(n);
        return buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";
      };
      const base = (self as unknown as { __PENNY_PILOT_API_ORIGIN__?: string }).__PENNY_PILOT_API_ORIGIN__ ?? "";
      await fetch(`${base}/api/push/subscribe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: b64("p256dh"), auth: b64("auth") } }),
      });
    })().catch(() => {})
  );
});
