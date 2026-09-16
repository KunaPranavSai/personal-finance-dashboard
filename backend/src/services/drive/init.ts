import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../middleware/errorHandler";
import {
  findOrCreateFolder,
  findExistingPennyPilotRoot,
  DATA_FOLDER_NAME,
  METADATA_FOLDER_NAME,
} from "./googleDriveClient";
import {
  initializeEmptyWorkspace,
  replaceCollectionWithContext,
  readMigrationMarker,
  markMigrationVerified,
  verifyStorageWithContext,
  invalidateAllCachesForUser,
} from "./dataService";
import { DriveRecord } from "./types";

const expenseCategories: Record<string, string[]> = {
  Home: ["Mortgage", "Rent", "Utilities", "Repairs"],
  "Daily Living": ["Groceries", "Dining Out", "Pet Care"],
  Transportation: ["Fuel", "Public Transport", "Parking"],
  Entertainment: ["Streaming Services", "Movies", "Concerts"],
  Health: ["Prescriptions", "Medical Expenses", "Health Club"],
  Personal: ["Clothing", "Salon", "Gifts"],
  "Dues & Subscriptions": ["Internet", "Memberships"],
  "Financial Obligations": ["Credit Cards", "Loans", "Taxes"],
  EMI: ["Home Loan EMI", "Car Loan EMI", "Personal Loan EMI"],
  Shopping: ["Electronics", "Home Goods"],
  Travel: ["Flights", "Hotels"],
  Education: ["Tuition", "Courses"],
  Insurance: ["Life", "Health", "Vehicle"],
  Investments: ["Mutual Funds", "Stocks", "SIPs"],
  Miscellaneous: ["Uncategorized"],
};

const incomeCategories: Record<string, string[]> = {
  Salary: ["Base Salary", "Bonus"],
  Freelancing: ["Freelance Project"],
  "Business Income": ["Side Business"],
  Interest: ["Savings Interest", "FD Interest"],
  Dividends: ["Stock Dividends"],
  "Rental Income": ["Property Rent"],
  Refunds: ["Tax Refund", "Purchase Refund"],
  "Other Income": ["Gifts", "Other"],
};

const defaultAccountNames = ["Bank Account", "Credit Card", "Wallet", "Cash", "Savings Account"];

function defaultCategoryRecords(): DriveRecord[] {
  const now = new Date().toISOString();
  const records: DriveRecord[] = [];
  for (const [source, type] of [[expenseCategories, "EXPENSE"], [incomeCategories, "INCOME"]] as const) {
    for (const [name, subs] of Object.entries(source)) {
      records.push({
        id: crypto.randomUUID(),
        name,
        type,
        subcategories: subs.map((s) => ({ id: crypto.randomUUID(), name: s })),
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return records;
}

function defaultAccountRecords(): DriveRecord[] {
  const now = new Date().toISOString();
  return defaultAccountNames.map((name) => ({ id: crypto.randomUUID(), name, createdAt: now, updatedAt: now }));
}

/** True if this account has any pre-existing financial rows in Postgres from before Penny
 * Pilot moved to Google Drive as the source of truth — i.e. a "legacy" account that needs the
 * migration flow, as opposed to a genuinely new signup with nothing to move. Read-only, side
 * effect free, safe to call before any Drive connection exists (used by GET /api/drive/status
 * so the frontend can show "Migrate your data" messaging before the user even connects). */
export async function hasLegacyPostgresData(userId: string): Promise<boolean> {
  // Sequential, short-circuiting on the first nonzero table instead of firing
  // all six counts at once via Promise.all — that burst of 6 simultaneous
  // connections was enough to exhaust the shared pool's session limit under
  // load. Same result (true iff any of these tables has a row for this
  // user), just without the connection spike; also cheaper on average since
  // it usually stops at the first or second table.
  const counts = [
    () => prisma.category.count({ where: { userId } }),
    () => prisma.transaction.count({ where: { userId } }),
    () => prisma.budget.count({ where: { userId } }),
    () => prisma.investment.count({ where: { userId } }),
    () => prisma.bill.count({ where: { userId } }),
    () => prisma.goal.count({ where: { userId } }),
  ];
  for (const count of counts) {
    if ((await count()) > 0) return true;
  }
  return false;
}

/**
 * One-time migration of a user's pre-existing Postgres financial rows into their Drive
 * workspace. Safe to re-run: it always re-reads Postgres (which this never modifies or
 * deletes) and wholesale-replaces the Drive collections, so a retry after a partial failure
 * overwrites rather than duplicates. The caller (setupWorkspace) only invokes this while the
 * migration-verified marker is absent, and only stamps that marker after this succeeds and the
 * written data is read back and verified.
 */
async function migratePostgresDataToDrive(
  userId: string,
  accessToken: string,
  dataFolderId: string,
  metadataFolderId: string
): Promise<{ migrated: boolean; counts: Record<string, number> }> {
  const [categories, accounts, paymentMethods, transactions, budgets, investments, bills, goals] = await Promise.all([
    prisma.category.findMany({ where: { userId }, include: { subcategories: true } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.paymentMethodType.findMany({ where: { userId } }),
    prisma.transaction.findMany({ where: { userId } }),
    prisma.budget.findMany({ where: { userId } }),
    prisma.investment.findMany({ where: { userId } }),
    prisma.bill.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId } }),
  ]);

  const hasAnyData = transactions.length > 0 || budgets.length > 0 || investments.length > 0 || bills.length > 0 || goals.length > 0 || categories.length > 0;
  if (!hasAnyData) return { migrated: false, counts: {} };

  const now = new Date().toISOString();
  const categoryIdMap = new Map<string, string>(); // old Postgres id -> new Drive id
  const accountIdMap = new Map<string, string>();
  const paymentMethodIdMap = new Map<string, string>();

  const categoryRecords: DriveRecord[] = categories.map((c) => {
    const newId = crypto.randomUUID();
    categoryIdMap.set(c.id, newId);
    return {
      id: newId,
      name: c.name,
      type: c.type,
      subcategories: c.subcategories.map((s) => ({ id: crypto.randomUUID(), name: s.name })),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.createdAt.toISOString(),
    };
  });

  const accountRecords: DriveRecord[] = accounts.map((a) => {
    const newId = crypto.randomUUID();
    accountIdMap.set(a.id, newId);
    return { id: newId, name: a.name, createdAt: a.createdAt.toISOString(), updatedAt: a.createdAt.toISOString() };
  });

  const paymentMethodRecords: DriveRecord[] = paymentMethods.map((p) => {
    const newId = crypto.randomUUID();
    paymentMethodIdMap.set(p.id, newId);
    return { id: newId, name: p.name, createdAt: p.createdAt.toISOString(), updatedAt: p.createdAt.toISOString() };
  });

  // A transaction/budget whose Postgres categoryId doesn't resolve to one of this user's
  // categories (a pre-existing dangling reference — e.g. the category row was removed
  // directly in the database at some point) is remapped to a lazily-created "Uncategorized"
  // fallback category instead of being written with a null categoryId. This is the actual
  // fix for the dashboard's "Cannot read properties of null (reading 'name')" crash: the API
  // legitimately returns `category: null` for an unresolvable categoryId, and every migrated
  // record now has a real, resolvable one instead of ever depending on that null case.
  const fallbackCategoryIds = new Map<"EXPENSE" | "INCOME", string>();
  function resolveCategoryId(oldCategoryId: string, type: "EXPENSE" | "INCOME"): string {
    const mapped = categoryIdMap.get(oldCategoryId);
    if (mapped) return mapped;
    let fallbackId = fallbackCategoryIds.get(type);
    if (!fallbackId) {
      fallbackId = crypto.randomUUID();
      fallbackCategoryIds.set(type, fallbackId);
      categoryRecords.push({ id: fallbackId, name: "Uncategorized", type, subcategories: [], createdAt: now, updatedAt: now });
    }
    return fallbackId;
  }

  const transactionRecords: DriveRecord[] = transactions.map((t) => ({
    id: crypto.randomUUID(),
    date: t.date.toISOString(),
    description: t.description,
    amount: Number(t.amount),
    type: t.type,
    categoryId: resolveCategoryId(t.categoryId, t.type),
    merchant: t.merchant,
    accountId: t.accountId ? accountIdMap.get(t.accountId) ?? null : null,
    paymentMethodTypeId: t.paymentMethodTypeId ? paymentMethodIdMap.get(t.paymentMethodTypeId) ?? null : null,
    location: t.location,
    tags: t.tags,
    notes: t.notes,
    recurring: t.recurring,
    fixedVariable: t.fixedVariable,
    essentiality: t.essentiality,
    attachmentUrl: t.attachmentUrl,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  const budgetRecords: DriveRecord[] = budgets.map((b) => ({
    id: crypto.randomUUID(),
    categoryId: resolveCategoryId(b.categoryId, "EXPENSE"),
    period: b.period,
    periodKey: b.periodKey,
    amount: Number(b.amount),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }));

  const investmentRecords: DriveRecord[] = investments.map((i) => ({
    id: crypto.randomUUID(),
    instrument: i.instrument,
    category: i.category,
    investedAmount: Number(i.investedAmount),
    currentValue: Number(i.currentValue),
    purchaseDate: i.purchaseDate.toISOString(),
    monthlyContribution: Number(i.monthlyContribution),
    annualReturnPct: Number(i.annualReturnPct),
    platform: i.platform,
    notes: i.notes,
    isAutoSync: i.isAutoSync,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));

  const billRecords: DriveRecord[] = bills.map((b) => ({
    id: crypto.randomUUID(),
    name: b.name,
    type: b.type,
    dueDate: b.dueDate.toISOString(),
    amount: Number(b.amount),
    paidAmount: Number(b.paidAmount),
    autoPay: b.autoPay,
    interestRate: b.interestRate ? Number(b.interestRate) : null,
    tenureMonths: b.tenureMonths,
    notes: b.notes,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }));

  const goalRecords: DriveRecord[] = goals.map((g) => ({
    id: crypto.randomUUID(),
    name: g.name,
    category: g.category,
    targetAmount: Number(g.targetAmount),
    currentAmount: Number(g.currentAmount),
    monthlyContribution: Number(g.monthlyContribution),
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }));

  await Promise.all([
    replaceCollectionWithContext(userId, accessToken, dataFolderId, metadataFolderId, "categories", categoryRecords),
    replaceCollectionWithContext(userId, accessToken, dataFolderId, metadataFolderId, "accounts", accountRecords),
    replaceCollectionWithContext(userId, accessToken, dataFolderId, metadataFolderId, "paymentMethods", paymentMethodRecords),
    replaceCollectionWithContext(userId, accessToken, dataFolderId, metadataFolderId, "transactions", transactionRecords),
    replaceCollectionWithContext(userId, accessToken, dataFolderId, metadataFolderId, "budgets", budgetRecords),
    replaceCollectionWithContext(userId, accessToken, dataFolderId, metadataFolderId, "investments", investmentRecords),
    replaceCollectionWithContext(userId, accessToken, dataFolderId, metadataFolderId, "bills", billRecords),
    replaceCollectionWithContext(userId, accessToken, dataFolderId, metadataFolderId, "goals", goalRecords),
  ]);

  return {
    migrated: true,
    counts: {
      categories: categoryRecords.length,
      accounts: accountRecords.length,
      paymentMethods: paymentMethodRecords.length,
      transactions: transactionRecords.length,
      budgets: budgetRecords.length,
      investments: investmentRecords.length,
      bills: billRecords.length,
      goals: goalRecords.length,
    },
  };
}

export interface WorkspaceResult {
  rootFolderId: string;
  migrated: boolean;
  counts: Record<string, number>;
}

/**
 * Sets up (or safely re-adopts) a user's Penny Pilot Drive workspace under the given root
 * folder, and — the first time only — migrates any pre-existing Postgres financial data (or
 * seeds the default category/account taxonomy for a genuinely new account) into it.
 *
 * Whether that (re)migration step still needs to run is decided by a `migrationCompletedAt`
 * marker stamped onto the Drive manifest itself, NOT by whether the manifest/collection files
 * already exist. This is what makes retrying after an interrupted first attempt safe: if a
 * prior call got partway through (e.g. some collections written, others lost to a transient
 * Drive API error) and threw before reaching the marker, the manifest and some collection
 * files already exist, but the marker doesn't — so the next call re-runs migration, which
 * wholesale-replaces every collection from Postgres again (Postgres is never modified by this,
 * so replaying it is always safe and never duplicates records).
 *
 * The marker is only stamped after the migrated/seeded data has been read back from Drive and
 * verified — the caller (POST /api/drive/callback) only persists this connection as
 * "initialized" in Postgres after setupWorkspace returns successfully, so a user can never be
 * routed to the dashboard against a workspace that hasn't actually been confirmed complete.
 */
export async function setupWorkspace(userId: string, accessToken: string, rootFolderId: string, accountEmail: string | null): Promise<WorkspaceResult> {
  const dataFolderId = await findOrCreateFolder(accessToken, DATA_FOLDER_NAME, rootFolderId);
  const metadataFolderId = await findOrCreateFolder(accessToken, METADATA_FOLDER_NAME, rootFolderId);

  await initializeEmptyWorkspace(accessToken, dataFolderId, metadataFolderId, accountEmail);
  invalidateAllCachesForUser(userId);

  const alreadyMigrated = await readMigrationMarker(accessToken, metadataFolderId);
  if (alreadyMigrated) {
    return { rootFolderId, migrated: false, counts: {} };
  }

  // Safety gate (see Penny-Pilot-P0-Drive-Safety-Trace.md, issue P0-2-A): the
  // migration-marker check above is what makes replaying a same-user
  // interrupted attempt safe, but a *pre-existing, non-empty* workspace that
  // lacks the marker isn't necessarily that — it could be a different
  // Penny Pilot connection's data (e.g. this Google account was previously
  // used by another Penny Pilot login) whose setup was itself interrupted
  // before the marker was stamped. Blindly proceeding into
  // migratePostgresDataToDrive below would wholesale-replace those records
  // with the *current* user's own data. Refuse to guess: if anything is
  // already there, stop and require an explicit "start fresh" choice
  // instead of ever silently overwriting unverified existing data.
  const existingDataCheck = await verifyStorageWithContext(accessToken, dataFolderId, metadataFolderId, userId);
  const hasUnverifiedExistingData = Object.values(existingDataCheck.counts).some((count) => (count ?? 0) > 0);
  if (hasUnverifiedExistingData) {
    throw new ApiError(
      409,
      "This Google Drive folder already contains Penny Pilot data, but Penny Pilot can't verify it was fully set up. To protect that data, it can't be automatically reused. Please choose \"Start Fresh\" to create a new workspace instead.",
      "DRIVE_WORKSPACE_UNVERIFIED"
    );
  }

  const migration = await migratePostgresDataToDrive(userId, accessToken, dataFolderId, metadataFolderId);
  if (!migration.migrated) {
    // Genuinely new user with nothing in Postgres either — seed the same default
    // category/account taxonomy the app has always given new users, just in Drive now.
    await Promise.all([
      replaceCollectionWithContext(userId, accessToken, dataFolderId, metadataFolderId, "categories", defaultCategoryRecords()),
      replaceCollectionWithContext(userId, accessToken, dataFolderId, metadataFolderId, "accounts", defaultAccountRecords()),
    ]);
  }

  // Verify what was actually written before declaring this workspace ready — a silent partial
  // failure here must never be indistinguishable from success.
  const verification = await verifyStorageWithContext(accessToken, dataFolderId, metadataFolderId, userId);
  if (!verification.ok) {
    throw new Error(`Google Drive workspace verification failed after setup: ${verification.issues.join("; ")}`);
  }
  const expectedNonEmpty = migration.migrated
    ? (Object.entries(migration.counts) as [string, number][]).filter(([, count]) => count > 0).map(([name]) => name)
    : ["categories", "accounts"];
  const shortfall = expectedNonEmpty.filter((name) => !verification.counts[name as keyof typeof verification.counts]);
  if (shortfall.length > 0) {
    throw new Error(`Google Drive workspace verification found missing data after setup: ${shortfall.join(", ")}`);
  }

  await markMigrationVerified(accessToken, metadataFolderId);
  invalidateAllCachesForUser(userId);

  return { rootFolderId, migrated: migration.migrated, counts: migration.counts };
}

export { findExistingPennyPilotRoot };
