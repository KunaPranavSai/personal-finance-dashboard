// Thin native-IndexedDB wrapper (no added dependency) backing
// LocalStorageProvider — "This Device Only" mode from the master plan.
// One object store per StorageCollection, keyPath "id".

import { STORAGE_COLLECTIONS } from "./types";

const DB_NAME = "penny-pilot-local";
// Bump this whenever STORAGE_COLLECTIONS gains a new entry — onupgradeneeded
// below only re-runs (and only then adds any missing object stores, via the
// contains() check) when the requested version is higher than what's
// already on disk. A browser that first created this database before a
// given collection existed would otherwise be permanently stuck missing
// that store, since IndexedDB never invents a new store on its own.
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

export class LocalStorageUnavailableError extends Error {
  code = "LOCAL_STORAGE_UNAVAILABLE";
  constructor(message = "This browser doesn't support or allow local storage.") {
    super(message);
  }
}

export class LocalStorageQuotaError extends Error {
  code = "LOCAL_STORAGE_QUOTA_EXCEEDED";
  constructor(message = "This browser has reached its available storage limit.") {
    super(message);
  }
}

export class LocalStorageCorruptedError extends Error {
  code = "LOCAL_STORAGE_CORRUPTED";
  constructor(message = "Local data appears to be corrupted.") {
    super(message);
  }
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new LocalStorageUnavailableError());
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      reject(new LocalStorageUnavailableError());
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const collection of STORAGE_COLLECTIONS) {
        if (!db.objectStoreNames.contains(collection)) {
          db.createObjectStore(collection, { keyPath: "id" });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new LocalStorageUnavailableError(request.error?.message));
    request.onblocked = () => reject(new LocalStorageUnavailableError("Local database upgrade was blocked by another open tab."));
  });
  return dbPromise;
}

/** True if IndexedDB can actually be opened right now — used by
 * isReady()/onboarding to distinguish "not set up" from "unavailable"
 * without throwing. */
export async function isLocalStorageAvailable(): Promise<boolean> {
  try {
    await openDb();
    return true;
  } catch {
    return false;
  }
}

function mapRequestError(err: DOMException | null): Error {
  if (err?.name === "QuotaExceededError") return new LocalStorageQuotaError();
  if (err?.name === "DataError" || err?.name === "InvalidStateError") return new LocalStorageCorruptedError(err.message);
  return new LocalStorageUnavailableError(err?.message);
}

export async function idbGetAll<T>(collection: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(collection, "readonly");
    const req = tx.objectStore(collection).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(mapRequestError(req.error));
  });
}

export async function idbGet<T>(collection: string, id: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(collection, "readonly");
    const req = tx.objectStore(collection).get(id);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(mapRequestError(req.error));
  });
}

export async function idbPut<T>(collection: string, record: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(collection, "readwrite");
    tx.objectStore(collection).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(mapRequestError(tx.error));
    tx.onabort = () => reject(mapRequestError(tx.error));
  });
}

export async function idbDelete(collection: string, id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(collection, "readwrite");
    tx.objectStore(collection).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(mapRequestError(tx.error));
    tx.onabort = () => reject(mapRequestError(tx.error));
  });
}

/** Atomic full-collection overwrite (clear + put-all in one transaction) — if
 * any record fails to write, the whole transaction aborts and the store is
 * left exactly as it was, per the plan's "never partially overwrite" rule. */
export async function idbReplaceAll<T>(collection: string, records: T[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(collection, "readwrite");
    const store = tx.objectStore(collection);
    store.clear();
    for (const record of records) store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(mapRequestError(tx.error));
    tx.onabort = () => reject(mapRequestError(tx.error));
  });
}
