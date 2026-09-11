import { prisma } from "../../lib/prisma";

/**
 * The six states a USER-role account can be in with respect to the Google-Drive-primary
 * architecture (see the Privacy Policy and services/drive/init.ts). Derived entirely from
 * Postgres-only signals — this deliberately never calls the Google Drive API on a user's
 * behalf, so the admin console never needs, and never gets, access to any user's Drive
 * contents (least privilege — see Task 10 in the redesign brief).
 */
export type MigrationState =
  | "NEW_USER"
  | "DRIVE_SETUP_REQUIRED"
  | "MIGRATION_REQUIRED"
  | "MIGRATION_IN_PROGRESS"
  | "MIGRATION_COMPLETED"
  | "MIGRATION_FAILED";

export interface MigrationSignals {
  hasLegacyData: boolean;
  connected: boolean;
  initialized: boolean;
  hasError: boolean;
}

export function deriveMigrationState({ hasLegacyData, connected, initialized, hasError }: MigrationSignals): MigrationState {
  if (initialized) return "MIGRATION_COMPLETED";
  if (!connected) return hasLegacyData ? "MIGRATION_REQUIRED" : "NEW_USER";
  // Connected (tokens saved) but not yet initialized/verified — see services/drive/init.ts.
  if (hasError) return "MIGRATION_FAILED";
  return hasLegacyData ? "MIGRATION_IN_PROGRESS" : "DRIVE_SETUP_REQUIRED";
}

/** Bulk-computes which of the given userIds have any pre-existing legacy financial rows in
 * Postgres, in exactly 6 queries regardless of how many userIds are passed. */
async function bulkHasLegacyData(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const legacy = new Set<string>();
  const results = await Promise.all([
    prisma.category.findMany({ where: { userId: { in: userIds } }, distinct: ["userId"], select: { userId: true } }),
    prisma.transaction.findMany({ where: { userId: { in: userIds } }, distinct: ["userId"], select: { userId: true } }),
    prisma.budget.findMany({ where: { userId: { in: userIds } }, distinct: ["userId"], select: { userId: true } }),
    prisma.investment.findMany({ where: { userId: { in: userIds } }, distinct: ["userId"], select: { userId: true } }),
    prisma.bill.findMany({ where: { userId: { in: userIds } }, distinct: ["userId"], select: { userId: true } }),
    prisma.goal.findMany({ where: { userId: { in: userIds } }, distinct: ["userId"], select: { userId: true } }),
  ]);
  for (const rows of results) for (const r of rows) legacy.add(r.userId);
  return legacy;
}

export interface MigrationStatusRow {
  userId: string;
  name: string;
  email: string;
  uid: string;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  accountEmail: string | null;
  state: MigrationState;
  lastConnectAttemptAt: Date | null;
  lastConnectError: string | null;
}

/** Paginated per-user migration status for the admin Migration Status page. `search` matches
 * name/email/uid (case-insensitive, prefix or substring). */
export async function listMigrationStatuses(page: number, pageSize: number, search?: string, stateFilter?: MigrationState) {
  const where = search
    ? {
        role: "USER" as const,
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { uid: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : { role: "USER" as const };

  // Filtering by derived state can't be pushed into the DB query (it's computed from two
  // separate signals), so when a state filter is requested we compute over every USER account
  // and paginate the filtered result in memory. This app's user base is admin-console scale,
  // not a public multi-tenant SaaS with millions of rows, so this is an acceptable trade-off
  // for keeping the state logic in one place instead of duplicating it as raw SQL.
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, uid: true, status: true, createdAt: true, lastLoginAt: true },
    ...(stateFilter ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
  });

  const userIds = users.map((u) => u.id);
  const [connections, legacySet] = await Promise.all([
    prisma.backupConnection.findMany({
      where: { userId: { in: userIds }, provider: "google_drive" },
      select: { userId: true, accountEmail: true, backupFolderId: true, lastConnectAttemptAt: true, lastConnectError: true },
    }),
    bulkHasLegacyData(userIds),
  ]);
  const connectionByUserId = new Map(connections.map((c) => [c.userId, c]));

  const allRows: MigrationStatusRow[] = users.map((u) => {
    const conn = connectionByUserId.get(u.id);
    const state = deriveMigrationState({
      hasLegacyData: legacySet.has(u.id),
      connected: Boolean(conn),
      initialized: Boolean(conn?.backupFolderId),
      hasError: Boolean(conn?.lastConnectError),
    });
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      uid: u.uid,
      status: u.status,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      accountEmail: conn?.accountEmail ?? null,
      state,
      lastConnectAttemptAt: conn?.lastConnectAttemptAt ?? null,
      lastConnectError: conn?.lastConnectError ?? null,
    };
  });

  const filtered = stateFilter ? allRows.filter((r) => r.state === stateFilter) : allRows;
  const total = stateFilter ? filtered.length : await prisma.user.count({ where });
  const items = stateFilter ? filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize) : filtered;

  return { items, total };
}

/** Platform-wide migration state counts, for the admin dashboard's summary cards. */
export async function getMigrationSummary(): Promise<Record<MigrationState, number>> {
  const users = await prisma.user.findMany({ where: { role: "USER" }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const [connections, legacySet] = await Promise.all([
    prisma.backupConnection.findMany({
      where: { userId: { in: userIds }, provider: "google_drive" },
      select: { userId: true, backupFolderId: true, lastConnectError: true },
    }),
    bulkHasLegacyData(userIds),
  ]);
  const connectionByUserId = new Map(connections.map((c) => [c.userId, c]));

  const summary: Record<MigrationState, number> = {
    NEW_USER: 0,
    DRIVE_SETUP_REQUIRED: 0,
    MIGRATION_REQUIRED: 0,
    MIGRATION_IN_PROGRESS: 0,
    MIGRATION_COMPLETED: 0,
    MIGRATION_FAILED: 0,
  };
  for (const id of userIds) {
    const conn = connectionByUserId.get(id);
    const state = deriveMigrationState({
      hasLegacyData: legacySet.has(id),
      connected: Boolean(conn),
      initialized: Boolean(conn?.backupFolderId),
      hasError: Boolean(conn?.lastConnectError),
    });
    summary[state] += 1;
  }
  return summary;
}
