// Shared storage-provider contract (Master Implementation Plan, Phase 0 —
// "Common StorageProvider"). Every financial module should eventually read
// and write through a StorageProvider instance rather than deciding for
// itself where data lives — this is what makes "This Device Only" (local
// IndexedDB) a real alternative to Google Drive instead of a special case
// bolted onto every page.
//
// Mirrors the backend's CollectionName set (backend/src/services/drive/types.ts)
// so a record shape is identical regardless of which provider stored it.

export const STORAGE_COLLECTIONS = [
  "transactions",
  "budgets",
  "investments",
  "bills",
  "goals",
  "accounts",
  "categories",
  "paymentMethods",
] as const;

export type StorageCollection = (typeof STORAGE_COLLECTIONS)[number];

export interface StorageRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export type StorageMode = "drive" | "local";

/** Outcome discipline per the master plan's "Data Integrity Rules" — a
 * mutation must resolve to one of exactly these three states, never a bare
 * throw the caller has to guess about. */
export type MutationOutcome<T> =
  | { status: "success"; data: T }
  | { status: "failure"; code: string; message: string }
  | { status: "unknown"; code: string; message: string };

export interface StorageProvider {
  readonly mode: StorageMode;

  /** Whether this provider is currently usable (Drive connected & initialized,
   * or local DB available) — checked before attempting any operation so
   * callers can show a setup/reconnect prompt instead of a raw failure. */
  isReady(): Promise<boolean>;

  list<T extends StorageRecord = StorageRecord>(collection: StorageCollection): Promise<T[]>;
  get<T extends StorageRecord = StorageRecord>(collection: StorageCollection, id: string): Promise<T | null>;
  /** `idempotencyKey`, when supplied, lets the provider recognize a retried
   * create of the same logical operation instead of creating a duplicate
   * record — see `lib/idempotencyKey.ts`. Ignored by providers (e.g. local
   * IndexedDB) where a duplicate-create race isn't possible. */
  create<T extends StorageRecord = StorageRecord>(
    collection: StorageCollection,
    data: Omit<T, "id" | "createdAt" | "updatedAt">,
    idempotencyKey?: string
  ): Promise<MutationOutcome<T>>;
  update<T extends StorageRecord = StorageRecord>(
    collection: StorageCollection,
    id: string,
    data: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>
  ): Promise<MutationOutcome<T>>;
  remove(collection: StorageCollection, id: string): Promise<MutationOutcome<{ id: string }>>;

  /** Full-collection overwrite — used by migration (write the complete source
   * dataset to a destination) and local import. Callers are responsible for
   * only calling this once they've verified the source data, per the plan's
   * "never partially overwrite" rule. */
  replaceCollection<T extends StorageRecord = StorageRecord>(collection: StorageCollection, records: T[]): Promise<MutationOutcome<null>>;
}
