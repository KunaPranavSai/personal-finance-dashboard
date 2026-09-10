/** Every record stored in a Drive collection file carries at least these fields. */
export interface DriveRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export const COLLECTIONS = [
  "transactions",
  "budgets",
  "investments",
  "bills",
  "goals",
  "accounts",
  "categories",
  "paymentMethods",
  "settings",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

export const SCHEMA_VERSION = 1;

export interface CollectionFile<T extends DriveRecord = DriveRecord> {
  schemaVersion: number;
  dataVersion: number;
  lastUpdated: string;
  checksum: string;
  records: T[];
}

export interface ManifestFileEntry {
  fileId: string;
  dataVersion: number;
  checksum: string;
  lastUpdated: string;
}

export interface ManifestFile {
  schemaVersion: number;
  accountEmail: string | null;
  initializedAt: string;
  updatedAt: string;
  files: Partial<Record<CollectionName, ManifestFileEntry>>;
}
