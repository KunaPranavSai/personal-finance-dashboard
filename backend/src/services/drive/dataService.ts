import crypto from "crypto";
import { ApiError } from "../../middleware/errorHandler";
import {
  findFile,
  findOrCreateFolder,
  readFileContent,
  upsertFile,
  listFileRevisions,
  readFileRevisionContent,
  DATA_FOLDER_NAME,
  METADATA_FOLDER_NAME,
} from "./googleDriveClient";
import { getAccessTokenForUser } from "./connection";
import { CollectionName, CollectionFile, ManifestFile, DriveRecord, SCHEMA_VERSION, COLLECTIONS } from "./types";

const MANIFEST_FILENAME = "manifest.json";

function collectionFilename(name: CollectionName): string {
  return `${name}.json`;
}

function checksumOf(records: unknown[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(records)).digest("hex");
}

function emptyCollectionFile(): CollectionFile {
  return { schemaVersion: SCHEMA_VERSION, dataVersion: 0, lastUpdated: new Date().toISOString(), checksum: checksumOf([]), records: [] };
}

// ─── Folder resolution cache ─────────────────────────────────────────────────
// Folder ids never change once a workspace is initialized, so resolving them
// once per process (per user) and reusing that avoids a Drive API round trip
// on every single request. Short-ish TTL so a folder recreated out-of-band
// (extremely unlikely, but possible if a user deletes it in Drive) is
// eventually noticed rather than cached forever.
const FOLDER_CACHE_TTL_MS = 10 * 60 * 1000;
const folderCache = new Map<string, { dataFolderId: string; metadataFolderId: string; expiresAt: number }>();

async function resolveWorkspaceFolders(userId: string, accessToken: string, rootFolderId: string) {
  const cached = folderCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const [dataFolderId, metadataFolderId] = await Promise.all([
    findOrCreateFolder(accessToken, DATA_FOLDER_NAME, rootFolderId),
    findOrCreateFolder(accessToken, METADATA_FOLDER_NAME, rootFolderId),
  ]);
  const entry = { dataFolderId, metadataFolderId, expiresAt: Date.now() + FOLDER_CACHE_TTL_MS };
  folderCache.set(userId, entry);
  return entry;
}

export function invalidateFolderCache(userId: string): void {
  folderCache.delete(userId);
}

/** Clears every in-memory cache for a user — called on disconnect/reconnect/account-change so stale state from a previous connection is never served against a new one. */
export function invalidateAllCachesForUser(userId: string): void {
  folderCache.delete(userId);
  manifestCache.delete(userId);
  for (const name of COLLECTIONS) recordCache.delete(cacheKey(userId, name));
}

// ─── Manifest cache ───────────────────────────────────────────────────────────
const MANIFEST_CACHE_TTL_MS = 15 * 1000;
const manifestCache = new Map<string, { manifest: ManifestFile; fileId: string; expiresAt: number }>();

function invalidateManifestCache(userId: string): void {
  manifestCache.delete(userId);
}

async function loadManifest(userId: string, accessToken: string, metadataFolderId: string, opts?: { bypassCache?: boolean }): Promise<{ manifest: ManifestFile; fileId: string }> {
  if (!opts?.bypassCache) {
    const cached = manifestCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached;
  }
  const fileId = await findFile(accessToken, metadataFolderId, MANIFEST_FILENAME);
  if (!fileId) {
    throw new ApiError(500, "Google Drive storage is not initialized for this account.", "DRIVE_NOT_INITIALIZED");
  }
  const raw = await readFileContent(accessToken, fileId);
  let manifest: ManifestFile;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new ApiError(500, "Your Penny Pilot manifest file in Google Drive is corrupted.", "DRIVE_DATA_CORRUPTED");
  }
  const entry = { manifest, fileId, expiresAt: Date.now() + MANIFEST_CACHE_TTL_MS };
  manifestCache.set(userId, entry);
  return entry;
}

async function saveManifest(userId: string, accessToken: string, metadataFolderId: string, fileId: string, manifest: ManifestFile): Promise<void> {
  manifest.updatedAt = new Date().toISOString();
  await upsertFile(accessToken, metadataFolderId, MANIFEST_FILENAME, JSON.stringify(manifest, null, 2), fileId);
  invalidateManifestCache(userId);
}

// ─── Per-user-per-collection write lock ──────────────────────────────────────
// Fully serializes writes to the same user's same collection within this
// process, which is what actually makes "read current state, mutate, write
// back" safe against lost updates — two concurrent requests can no longer
// both read the same starting array and race to write. Single-instance
// deployment (same constraint already relied on elsewhere in this codebase,
// e.g. the OAuth state nonce map), so this is sufficient in practice.
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = locks.get(key) ?? Promise.resolve();
  // Run `fn` after the prior operation settles, whether it resolved or rejected, so one
  // failed write never wedges the lock for everyone after it.
  const run = prior.then(fn, fn);
  // What we hand the *next* caller as "prior" must itself never reject, otherwise every
  // subsequent write on this key would short-circuit without ever calling `fn`.
  locks.set(key, run.catch(() => undefined));
  return run;
}

// ─── Record cache (read-through, short TTL) ──────────────────────────────────
const RECORD_CACHE_TTL_MS = 20 * 1000;
const recordCache = new Map<string, { file: CollectionFile; expiresAt: number }>();

function cacheKey(userId: string, collection: CollectionName): string {
  return `${userId}:${collection}`;
}

function invalidateRecordCache(userId: string, collection: CollectionName): void {
  recordCache.delete(cacheKey(userId, collection));
}

async function loadCollectionFile(userId: string, accessToken: string, dataFolderId: string, metadataFolderId: string, collection: CollectionName, opts?: { bypassCache?: boolean }): Promise<CollectionFile> {
  const key = cacheKey(userId, collection);
  if (!opts?.bypassCache) {
    const cached = recordCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.file;
  }

  const { manifest } = await loadManifest(userId, accessToken, metadataFolderId, { bypassCache: opts?.bypassCache });
  const entry = manifest.files[collection];
  let file: CollectionFile;
  if (!entry) {
    // Collection file missing from the manifest (shouldn't normally happen post-init) —
    // degrade to an empty collection rather than failing every read for this user.
    file = emptyCollectionFile();
  } else {
    const raw = await readFileContent(accessToken, entry.fileId);
    try {
      file = JSON.parse(raw);
    } catch {
      throw new ApiError(500, `Your ${collection} data file in Google Drive is corrupted.`, "DRIVE_DATA_CORRUPTED");
    }
    // The file's own embedded checksum is authoritative — recompute and compare so an
    // out-of-band edit (or a partial/corrupted write) is caught rather than trusted.
    const actualChecksum = checksumOf(file.records);
    if (actualChecksum !== file.checksum) {
      throw new ApiError(500, `Your ${collection} data in Google Drive appears to have been modified outside Penny Pilot and failed an integrity check. Use Settings → Data & Google Drive → Verify Data before continuing.`, "DRIVE_DATA_CORRUPTED");
    }
  }

  recordCache.set(key, { file, expiresAt: Date.now() + RECORD_CACHE_TTL_MS });
  return file;
}

async function saveCollectionFile(userId: string, accessToken: string, dataFolderId: string, metadataFolderId: string, collection: CollectionName, file: CollectionFile): Promise<void> {
  file.checksum = checksumOf(file.records);
  file.lastUpdated = new Date().toISOString();
  file.dataVersion += 1;

  const { manifest, fileId: manifestFileId } = await loadManifest(userId, accessToken, metadataFolderId, { bypassCache: true });
  const existingEntry = manifest.files[collection];
  const fileId = await upsertFile(accessToken, dataFolderId, collectionFilename(collection), JSON.stringify(file, null, 2), existingEntry?.fileId);

  manifest.files[collection] = { fileId, dataVersion: file.dataVersion, checksum: file.checksum, lastUpdated: file.lastUpdated };
  await saveManifest(userId, accessToken, metadataFolderId, manifestFileId, manifest);
  invalidateRecordCache(userId, collection);
}

// ─── Idempotent-create support ────────────────────────────────────────────────
// An optional client-supplied idempotency key lets a retried "create" (e.g. after a
// network blip lost the success response) return the original record instead of
// inserting a duplicate — this is what actually prevents duplicate writes; the
// per-collection lock above only prevents lost *updates*, not duplicate *creates*.
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const idempotencyCache = new Map<string, { record: DriveRecord; expiresAt: number }>();
function idempotencyKeyFor(userId: string, collection: CollectionName, key: string): string {
  return `${userId}:${collection}:${key}`;
}

async function withWorkspace<T>(userId: string, fn: (ctx: { accessToken: string; dataFolderId: string; metadataFolderId: string }) => Promise<T>): Promise<T> {
  const { connection, accessToken } = await getAccessTokenForUser(userId);
  if (!connection.backupFolderId) {
    throw new ApiError(500, "Google Drive storage is not initialized for this account.", "DRIVE_NOT_INITIALIZED");
  }
  const { dataFolderId, metadataFolderId } = await resolveWorkspaceFolders(userId, accessToken, connection.backupFolderId);
  return fn({ accessToken, dataFolderId, metadataFolderId });
}

export async function listRecords<T extends DriveRecord = DriveRecord>(userId: string, collection: CollectionName): Promise<T[]> {
  return withWorkspace(userId, async ({ accessToken, dataFolderId, metadataFolderId }) => {
    const file = await loadCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection);
    return file.records as T[];
  });
}

export async function getRecord<T extends DriveRecord = DriveRecord>(userId: string, collection: CollectionName, id: string): Promise<T | null> {
  const records = await listRecords<T>(userId, collection);
  return records.find((r) => r.id === id) ?? null;
}

export interface CreateOptions {
  /** Optional client-supplied idempotency key — a retried create with the same key returns the original record. */
  idempotencyKey?: string;
}

export async function createRecord<T extends DriveRecord = DriveRecord>(
  userId: string,
  collection: CollectionName,
  data: Omit<T, "id" | "createdAt" | "updatedAt">,
  opts?: CreateOptions
): Promise<T> {
  if (opts?.idempotencyKey) {
    const cached = idempotencyCache.get(idempotencyKeyFor(userId, collection, opts.idempotencyKey));
    if (cached && cached.expiresAt > Date.now()) return cached.record as T;
  }

  return withLock(`${userId}:${collection}`, () =>
    withWorkspace(userId, async ({ accessToken, dataFolderId, metadataFolderId }) => {
      const file = await loadCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, { bypassCache: true });
      const now = new Date().toISOString();
      const record = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as unknown as T;
      file.records.push(record);
      await saveCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, file);

      if (opts?.idempotencyKey) {
        idempotencyCache.set(idempotencyKeyFor(userId, collection, opts.idempotencyKey), { record, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
      }
      return record;
    })
  );
}

export async function updateRecord<T extends DriveRecord = DriveRecord>(
  userId: string,
  collection: CollectionName,
  id: string,
  patch: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>
): Promise<T> {
  return withLock(`${userId}:${collection}`, () =>
    withWorkspace(userId, async ({ accessToken, dataFolderId, metadataFolderId }) => {
      const file = await loadCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, { bypassCache: true });
      const idx = file.records.findIndex((r) => r.id === id);
      if (idx === -1) throw new ApiError(404, "Record not found");
      const updated = { ...file.records[idx], ...patch, id, updatedAt: new Date().toISOString() } as T;
      file.records[idx] = updated;
      await saveCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, file);
      return updated;
    })
  );
}

/** Insert-or-update a record at a caller-chosen, stable id — used for singleton-style records
 * (e.g. the one settings/profile blob per user) rather than the usual server-generated id. */
export async function upsertRecordWithId<T extends DriveRecord = DriveRecord>(
  userId: string,
  collection: CollectionName,
  id: string,
  data: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>
): Promise<T> {
  return withLock(`${userId}:${collection}`, () =>
    withWorkspace(userId, async ({ accessToken, dataFolderId, metadataFolderId }) => {
      const file = await loadCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, { bypassCache: true });
      const now = new Date().toISOString();
      const idx = file.records.findIndex((r) => r.id === id);
      let record: T;
      if (idx === -1) {
        record = { ...data, id, createdAt: now, updatedAt: now } as unknown as T;
        file.records.push(record);
      } else {
        record = { ...file.records[idx], ...data, id, updatedAt: now } as T;
        file.records[idx] = record;
      }
      await saveCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, file);
      return record;
    })
  );
}

export async function deleteRecord(userId: string, collection: CollectionName, id: string): Promise<boolean> {
  return withLock(`${userId}:${collection}`, () =>
    withWorkspace(userId, async ({ accessToken, dataFolderId, metadataFolderId }) => {
      const file = await loadCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, { bypassCache: true });
      const before = file.records.length;
      file.records = file.records.filter((r) => r.id !== id);
      if (file.records.length === before) return false;
      await saveCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, file);
      return true;
    })
  );
}

export async function deleteRecords(userId: string, collection: CollectionName, ids: string[]): Promise<number> {
  return withLock(`${userId}:${collection}`, () =>
    withWorkspace(userId, async ({ accessToken, dataFolderId, metadataFolderId }) => {
      const file = await loadCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, { bypassCache: true });
      const idSet = new Set(ids);
      const before = file.records.length;
      file.records = file.records.filter((r) => !idSet.has(r.id));
      const deleted = before - file.records.length;
      if (deleted > 0) await saveCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, file);
      return deleted;
    })
  );
}

/** Bulk-replace an entire collection's records in one write (used by restore). */
export async function replaceCollection<T extends DriveRecord = DriveRecord>(userId: string, collection: CollectionName, records: T[]): Promise<void> {
  return withLock(`${userId}:${collection}`, () =>
    withWorkspace(userId, async ({ accessToken, dataFolderId, metadataFolderId }) => {
      const file = await loadCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, { bypassCache: true });
      file.records = records;
      await saveCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, file);
    })
  );
}

/** Fetch every collection at once — used by dashboard/analytics/reports/export, which all need the full picture. */
export async function listAllCollections(userId: string): Promise<Record<CollectionName, DriveRecord[]>> {
  return withWorkspace(userId, async ({ accessToken, dataFolderId, metadataFolderId }) => {
    const entries = await Promise.all(
      COLLECTIONS.map(async (name) => [name, (await loadCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, name)).records] as const)
    );
    return Object.fromEntries(entries) as Record<CollectionName, DriveRecord[]>;
  });
}

export async function verifyStorage(userId: string): Promise<{ ok: boolean; issues: string[]; collections: Record<CollectionName, { count: number; dataVersion: number; lastUpdated: string }> }> {
  const issues: string[] = [];
  const collections = {} as Record<CollectionName, { count: number; dataVersion: number; lastUpdated: string }>;

  await withWorkspace(userId, async ({ accessToken, dataFolderId, metadataFolderId }) => {
    for (const name of COLLECTIONS) {
      try {
        const file = await loadCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, name, { bypassCache: true });
        collections[name] = { count: file.records.length, dataVersion: file.dataVersion, lastUpdated: file.lastUpdated };
      } catch (err) {
        issues.push(`${name}: ${err instanceof Error ? err.message : "unknown error"}`);
        collections[name] = { count: 0, dataVersion: 0, lastUpdated: "" };
      }
    }
  });

  return { ok: issues.length === 0, issues, collections };
}

export interface RevisionSummary {
  id: string;
  modifiedTime: string;
}

/** Lists Drive's own revision history for one collection file — this IS the "Restore" source
 * of truth, and also what backs the "safe pre-restore state" requirement (every write already
 * creates a new Drive revision, so nothing is ever destroyed by restoring an older one). */
export async function listCollectionRevisions(userId: string, collection: CollectionName): Promise<RevisionSummary[]> {
  return withWorkspace(userId, async ({ accessToken, metadataFolderId }) => {
    const { manifest } = await loadManifest(userId, accessToken, metadataFolderId);
    const entry = manifest.files[collection];
    if (!entry) return [];
    const revisions = await listFileRevisions(accessToken, entry.fileId);
    return revisions.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());
  });
}

/** Reads (without applying) a specific past revision of a collection file, for the restore
 * confirmation screen — validates schema version and the revision's own embedded checksum. */
export async function previewCollectionRevision(userId: string, collection: CollectionName, revisionId: string): Promise<CollectionFile> {
  return withWorkspace(userId, async ({ accessToken, metadataFolderId }) => {
    const { manifest } = await loadManifest(userId, accessToken, metadataFolderId);
    const entry = manifest.files[collection];
    if (!entry) throw new ApiError(404, `No ${collection} file found.`);
    const raw = await readFileRevisionContent(accessToken, entry.fileId, revisionId);
    let file: CollectionFile;
    try {
      file = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "That revision's content could not be read — it may be corrupted.", "DRIVE_DATA_CORRUPTED");
    }
    if (file.schemaVersion !== SCHEMA_VERSION) {
      throw new ApiError(400, `That revision uses a data format (schema v${file.schemaVersion}) this version of Penny Pilot doesn't support.`);
    }
    if (checksumOf(file.records) !== file.checksum) {
      throw new ApiError(400, "That revision failed an integrity check and can't be safely restored.", "DRIVE_DATA_CORRUPTED");
    }
    return file;
  });
}

/** Applies a previously-previewed revision as the collection's new current content. Writing it
 * back creates yet another new Drive revision on top — the version being replaced is never
 * actually deleted, so this can always be undone by restoring again. */
export async function restoreCollectionFromRevision(userId: string, collection: CollectionName, revisionId: string): Promise<CollectionFile> {
  const revision = await previewCollectionRevision(userId, collection, revisionId);
  return withLock(`${userId}:${collection}`, () =>
    withWorkspace(userId, async ({ accessToken, dataFolderId, metadataFolderId }) => {
      const file: CollectionFile = { ...revision, dataVersion: revision.dataVersion }; // dataVersion re-incremented by saveCollectionFile
      await saveCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, file);
      return file;
    })
  );
}

/**
 * Creates every empty collection file + the manifest for a brand-new workspace. Safe to call
 * against a folder that already has some files — only creates what's missing, never overwrites
 * existing collection data (so reconnecting the *same* Google account is a no-op here, and this
 * can't accidentally wipe a workspace that already has records in it).
 */
export async function initializeEmptyWorkspace(accessToken: string, dataFolderId: string, metadataFolderId: string, accountEmail: string | null): Promise<void> {
  let manifestFileId = await findFile(accessToken, metadataFolderId, MANIFEST_FILENAME);
  let manifest: ManifestFile;
  if (manifestFileId) {
    try {
      manifest = JSON.parse(await readFileContent(accessToken, manifestFileId));
    } catch {
      manifest = { schemaVersion: SCHEMA_VERSION, accountEmail, initializedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), files: {} };
    }
  } else {
    manifest = { schemaVersion: SCHEMA_VERSION, accountEmail, initializedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), files: {} };
  }

  for (const name of COLLECTIONS) {
    if (manifest.files[name]) continue; // already initialized — never overwrite
    const filename = collectionFilename(name);
    const existingFileId = await findFile(accessToken, dataFolderId, filename);
    if (existingFileId) {
      // File exists in Drive but wasn't in the manifest (e.g. manifest was lost/corrupted) —
      // adopt it as-is rather than clobbering whatever records it already holds.
      try {
        const existing: CollectionFile = JSON.parse(await readFileContent(accessToken, existingFileId));
        manifest.files[name] = { fileId: existingFileId, dataVersion: existing.dataVersion, checksum: existing.checksum, lastUpdated: existing.lastUpdated };
        continue;
      } catch {
        // fall through and treat as unreadable/corrupt — re-initialize this one file
      }
    }
    const empty = emptyCollectionFile();
    const fileId = await upsertFile(accessToken, dataFolderId, filename, JSON.stringify(empty, null, 2), existingFileId ?? undefined);
    manifest.files[name] = { fileId, dataVersion: empty.dataVersion, checksum: empty.checksum, lastUpdated: empty.lastUpdated };
  }

  manifest.accountEmail = accountEmail;
  manifestFileId = await upsertFile(accessToken, metadataFolderId, MANIFEST_FILENAME, JSON.stringify(manifest, null, 2), manifestFileId ?? undefined);
}

// ─── Setup-time helpers (raw accessToken/folder context, no DB lookup) ────────
// The functions below are used only during the connect/setup flow (services/drive/init.ts),
// before the connection's `backupFolderId` is durably persisted to Postgres — so they take
// their Drive context directly instead of going through `withWorkspace`, which requires that
// row to already exist. This is what lets setup verify a workspace is fully ready *before*
// the app ever marks the account "Drive-initialized".

/** Bulk-replace an entire collection's records, given an already-resolved Drive context. Used
 * only by the one-time legacy-data migration (services/drive/init.ts), which resolves its own
 * folder ids up front rather than via a persisted connection. */
export async function replaceCollectionWithContext<T extends DriveRecord = DriveRecord>(
  userId: string,
  accessToken: string,
  dataFolderId: string,
  metadataFolderId: string,
  collection: CollectionName,
  records: T[]
): Promise<void> {
  return withLock(`${userId}:${collection}`, async () => {
    const file = await loadCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, { bypassCache: true });
    file.records = records;
    await saveCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, collection, file);
  });
}

/** Reads the manifest's migration-completion marker directly (raw context, no DB/user cache). */
export async function readMigrationMarker(accessToken: string, metadataFolderId: string): Promise<string | null> {
  const manifestFileId = await findFile(accessToken, metadataFolderId, MANIFEST_FILENAME);
  if (!manifestFileId) return null;
  try {
    const manifest: ManifestFile = JSON.parse(await readFileContent(accessToken, manifestFileId));
    return manifest.migrationCompletedAt ?? null;
  } catch {
    return null;
  }
}

/** Stamps the manifest as migration-verified — only ever called after the migrated data has
 * been read back from Drive and confirmed to match what was written (see init.ts). This stamp,
 * not mere manifest existence, is what setupWorkspace uses to decide whether legacy-data
 * migration still needs to (re)run, which is what makes a retry after a partial failure safe. */
export async function markMigrationVerified(accessToken: string, metadataFolderId: string): Promise<void> {
  const manifestFileId = await findFile(accessToken, metadataFolderId, MANIFEST_FILENAME);
  if (!manifestFileId) throw new ApiError(500, "Cannot mark migration complete: manifest is missing.", "DRIVE_DATA_CORRUPTED");
  const manifest: ManifestFile = JSON.parse(await readFileContent(accessToken, manifestFileId));
  manifest.migrationCompletedAt = new Date().toISOString();
  manifest.updatedAt = manifest.migrationCompletedAt;
  await upsertFile(accessToken, metadataFolderId, MANIFEST_FILENAME, JSON.stringify(manifest, null, 2), manifestFileId);
}

/** Same as verifyStorage(), but for setup-time use with a raw, not-yet-persisted Drive context. */
export async function verifyStorageWithContext(
  accessToken: string,
  dataFolderId: string,
  metadataFolderId: string,
  userId: string
): Promise<{ ok: boolean; issues: string[]; counts: Partial<Record<CollectionName, number>> }> {
  const issues: string[] = [];
  const counts: Partial<Record<CollectionName, number>> = {};
  for (const name of COLLECTIONS) {
    try {
      const file = await loadCollectionFile(userId, accessToken, dataFolderId, metadataFolderId, name, { bypassCache: true });
      counts[name] = file.records.length;
    } catch (err) {
      issues.push(`${name}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }
  return { ok: issues.length === 0, issues, counts };
}
