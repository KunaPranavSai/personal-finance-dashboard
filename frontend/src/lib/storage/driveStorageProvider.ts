import { api, ApiClientError } from "../api";
import { DriveStatus, isDriveReady } from "../driveStatus";
import { StorageCollection, StorageProvider, StorageRecord, MutationOutcome } from "./types";

/** REST base path for each collection under the existing Drive-backed API —
 * these are the same endpoints every page already calls directly today. */
const COLLECTION_PATH: Record<StorageCollection, string> = {
  transactions: "/api/transactions",
  budgets: "/api/budgets",
  investments: "/api/investments",
  bills: "/api/bills",
  goals: "/api/goals",
  accounts: "/api/accounts",
  categories: "/api/categories",
  paymentMethods: "/api/payment-methods",
};

/** HTTP statuses that represent a definitively *known* failure reason —
 * even though they're `>= 500`, these are not ambiguous like a bare
 * timeout/gateway error, so they must not fall into the "unknown" bucket
 * (which implies "we can't tell, verify before retrying"). 507 is Google
 * Drive storage-quota-exceeded (see lib/driveErrors.ts's mapGoogleDriveError
 * on the backend) — a certain, well-understood cause, not an ambiguous one. */
const KNOWN_FAILURE_STATUSES = new Set([507]);

/** Turns a thrown ApiClientError into the plan's three-state mutation
 * outcome — a network/timeout failure where we can't tell if the write
 * landed is reported as "unknown", never silently treated as "failure"
 * (which would invite an unsafe blind retry). A definitively known failure
 * reason (e.g. Drive quota exceeded) is reported as "failure", even though
 * its HTTP status happens to be >= 500, since there's nothing ambiguous
 * about it. */
function toOutcome<T>(err: unknown): MutationOutcome<T> {
  if (err instanceof ApiClientError) {
    const code = (err.details as { code?: string })?.code ?? `HTTP_${err.status}`;
    if (!KNOWN_FAILURE_STATUSES.has(err.status) && (err.status === 0 || err.status >= 500)) {
      return { status: "unknown", code, message: err.message };
    }
    return { status: "failure", code, message: err.message };
  }
  return { status: "unknown", code: "NETWORK_ERROR", message: err instanceof Error ? err.message : "Request failed" };
}

/** Adapter over the existing Drive-backed REST API — wraps calls the app
 * already makes today so it's a drop-in StorageProvider with zero behavior
 * change for Drive-mode users. */
export class DriveStorageProvider implements StorageProvider {
  readonly mode = "drive" as const;

  async isReady(): Promise<boolean> {
    try {
      const status = await api.get<DriveStatus>("/api/drive/status");
      return isDriveReady(status);
    } catch {
      return false;
    }
  }

  async list<T extends StorageRecord = StorageRecord>(collection: StorageCollection): Promise<T[]> {
    const res = await api.get<{ items: T[] }>(COLLECTION_PATH[collection]);
    return res.items;
  }

  async get<T extends StorageRecord = StorageRecord>(collection: StorageCollection, id: string): Promise<T | null> {
    try {
      return await api.get<T>(`${COLLECTION_PATH[collection]}/${id}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) return null;
      throw err;
    }
  }

  async create<T extends StorageRecord = StorageRecord>(
    collection: StorageCollection,
    data: Omit<T, "id" | "createdAt" | "updatedAt">,
    idempotencyKey?: string
  ): Promise<MutationOutcome<T>> {
    try {
      const created = await api.post<T>(COLLECTION_PATH[collection], data, idempotencyKey);
      return { status: "success", data: created };
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
      const updated = await api.patch<T>(`${COLLECTION_PATH[collection]}/${id}`, data);
      return { status: "success", data: updated };
    } catch (err) {
      return toOutcome<T>(err);
    }
  }

  async remove(collection: StorageCollection, id: string): Promise<MutationOutcome<{ id: string }>> {
    try {
      await api.delete(`${COLLECTION_PATH[collection]}/${id}`);
      return { status: "success", data: { id } };
    } catch (err) {
      return toOutcome<{ id: string }>(err);
    }
  }

  async replaceCollection<T extends StorageRecord = StorageRecord>(
    collection: StorageCollection,
    records: T[]
  ): Promise<MutationOutcome<null>> {
    // NOTE: `${collection}/replace` doesn't exist on the backend yet — this
    // method is unused until the migration phase adds it. Declared now so
    // the StorageProvider interface is complete for both providers.
    try {
      await api.post(`${COLLECTION_PATH[collection]}/replace`, { records });
      return { status: "success", data: null };
    } catch (err) {
      return toOutcome<null>(err);
    }
  }
}
