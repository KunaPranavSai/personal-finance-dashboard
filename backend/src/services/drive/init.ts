import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import {
  findOrCreateFolder,
  findExistingPennyPilotRoot,
  findFile,
  DATA_FOLDER_NAME,
  METADATA_FOLDER_NAME,
} from "./googleDriveClient";
import { initializeEmptyWorkspace, replaceCollection, invalidateAllCachesForUser } from "./dataService";
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

/**
 * One-time migration of a user's pre-existing Postgres financial rows into their freshly
 * initialized Drive workspace. Only ever runs against an empty workspace (checked by the
 * caller), so it can never overwrite records the user has already created in Drive. Postgres
 * rows are left untouched (not deleted) — nothing in the app reads them again after this.
 */
async function migratePostgresDataToDrive(userId: string): Promise<{ migrated: boolean; counts: Record<string, number> }> {
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

  const transactionRecords: DriveRecord[] = transactions.map((t) => ({
    id: crypto.randomUUID(),
    date: t.date.toISOString(),
    description: t.description,
    amount: Number(t.amount),
    type: t.type,
    categoryId: categoryIdMap.get(t.categoryId) ?? null,
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
    categoryId: categoryIdMap.get(b.categoryId) ?? null,
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
    replaceCollection(userId, "categories", categoryRecords),
    replaceCollection(userId, "accounts", accountRecords),
    replaceCollection(userId, "paymentMethods", paymentMethodRecords),
    replaceCollection(userId, "transactions", transactionRecords),
    replaceCollection(userId, "budgets", budgetRecords),
    replaceCollection(userId, "investments", investmentRecords),
    replaceCollection(userId, "bills", billRecords),
    replaceCollection(userId, "goals", goalRecords),
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
 * folder. Idempotent for an already-initialized workspace — never overwrites existing records.
 * Only migrates Postgres data / seeds default categories the very first time a workspace with
 * no manifest yet is created.
 */
export async function setupWorkspace(userId: string, accessToken: string, rootFolderId: string, accountEmail: string | null): Promise<WorkspaceResult> {
  const dataFolderId = await findOrCreateFolder(accessToken, DATA_FOLDER_NAME, rootFolderId);
  const metadataFolderId = await findOrCreateFolder(accessToken, METADATA_FOLDER_NAME, rootFolderId);

  const existingManifestId = await findFile(accessToken, metadataFolderId, "manifest.json");
  const isFreshWorkspace = !existingManifestId;

  await initializeEmptyWorkspace(accessToken, dataFolderId, metadataFolderId, accountEmail);
  invalidateAllCachesForUser(userId);

  if (!isFreshWorkspace) {
    return { rootFolderId, migrated: false, counts: {} };
  }

  const migration = await migratePostgresDataToDrive(userId);
  if (!migration.migrated) {
    // Genuinely new user with nothing in Postgres either — seed the same default
    // category/account taxonomy the app has always given new users, just in Drive now.
    await Promise.all([
      replaceCollection(userId, "categories", defaultCategoryRecords()),
      replaceCollection(userId, "accounts", defaultAccountRecords()),
    ]);
  }
  invalidateAllCachesForUser(userId);

  return { rootFolderId, migrated: migration.migrated, counts: migration.counts };
}

export { findExistingPennyPilotRoot };
