import { StorageCollection, StorageProvider, StorageRecord, MutationOutcome } from "./types";
import { idbGetAll, idbGet, idbPut, idbDelete, idbReplaceAll, isLocalStorageAvailable } from "./localDb";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toOutcome<T>(err: unknown): MutationOutcome<T> {
  const code = (err as { code?: string })?.code ?? "LOCAL_STORAGE_WRITE_FAILED";
  const message = err instanceof Error ? err.message : "Local write failed";
  // A thrown DOMException/transaction abort here means the browser told us
  // definitively that the write did not happen — that's a known failure, not
  // an uncertain outcome (unlike a network timeout against Drive).
  return { status: "failure", code, message };
}

/** "This Device Only" storage — IndexedDB-backed, no server round-trip for
 * financial data at all. Every write is a durable local transaction (see
 * localDb.ts), so unlike Drive there's no "unknown outcome" case: IndexedDB
 * transactions either commit or abort, they don't time out ambiguously. */
export class LocalStorageProvider implements StorageProvider {
  readonly mode = "local" as const;

  async isReady(): Promise<boolean> {
    return isLocalStorageAvailable();
  }

  async list<T extends StorageRecord = StorageRecord>(collection: StorageCollection): Promise<T[]> {
    return idbGetAll<T>(collection);
  }

  async get<T extends StorageRecord = StorageRecord>(collection: StorageCollection, id: string): Promise<T | null> {
    return idbGet<T>(collection, id);
  }

  async create<T extends StorageRecord = StorageRecord>(
    collection: StorageCollection,
    data: Omit<T, "id" | "createdAt" | "updatedAt">,
    // Not needed: a single-tab IndexedDB write can't race a duplicate retry
    // the way a network request can — accepted only to satisfy the shared
    // StorageProvider interface.
    _idempotencyKey?: string
  ): Promise<MutationOutcome<T>> {
    const now = new Date().toISOString();
    const record = { ...data, id: newId(), createdAt: now, updatedAt: now } as T;
    try {
      await idbPut(collection, record);
      return { status: "success", data: record };
    } catch (err) {
      return toOutcome<T>(err);
    }
  }

  async update<T extends StorageRecord = StorageRecord>(
    collection: StorageCollection,
    id: string,
    data: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>
  ): Promise<MutationOutcome<T>> {
    try {
      const existing = await idbGet<T>(collection, id);
      if (!existing) return { status: "failure", code: "LOCAL_RECORD_NOT_FOUND", message: "Record not found." };
      const updated = { ...existing, ...data, id, updatedAt: new Date().toISOString() } as T;
      await idbPut(collection, updated);
      return { status: "success", data: updated };
    } catch (err) {
      return toOutcome<T>(err);
    }
  }

  async remove(collection: StorageCollection, id: string): Promise<MutationOutcome<{ id: string }>> {
    try {
      await idbDelete(collection, id);
      return { status: "success", data: { id } };
    } catch (err) {
      return toOutcome<{ id: string }>(err);
    }
  }

  async replaceCollection<T extends StorageRecord = StorageRecord>(collection: StorageCollection, records: T[]): Promise<MutationOutcome<null>> {
    try {
      await idbReplaceAll(collection, records);
      return { status: "success", data: null };
    } catch (err) {
      return toOutcome<null>(err);
    }
  }
}
