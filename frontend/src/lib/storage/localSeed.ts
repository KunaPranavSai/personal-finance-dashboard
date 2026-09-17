// Seeds the same default categories/accounts that a brand-new Google Drive
// workspace gets (see backend/src/services/drive/init.ts) into local
// IndexedDB the first time a user activates "This Device Only" mode, so the
// transaction form isn't empty on first use. Idempotent: only writes when
// the collection is currently empty, so re-activating local mode (or
// calling this more than once) never overwrites a user's own edits.
import { idbGetAll, idbPut } from "./localDb";
import type { Category, Account } from "@/types";

const EXPENSE_CATEGORIES: Record<string, string[]> = {
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

const INCOME_CATEGORIES: Record<string, string[]> = {
  Salary: ["Base Salary", "Bonus"],
  Freelancing: ["Freelance Project"],
  "Business Income": ["Side Business"],
  Interest: ["Savings Interest", "FD Interest"],
  Dividends: ["Stock Dividends"],
  "Rental Income": ["Property Rent"],
  Refunds: ["Tax Refund", "Purchase Refund"],
  "Other Income": ["Gifts", "Other"],
};

const DEFAULT_ACCOUNT_NAMES = ["Bank Account", "Credit Card", "Wallet", "Cash", "Savings Account"];

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function seedLocalDefaultsIfEmpty(): Promise<void> {
  const now = new Date().toISOString();

  const existingCategories = await idbGetAll<Category>("categories");
  if (existingCategories.length === 0) {
    const records: Category[] = [];
    for (const [source, type] of [[EXPENSE_CATEGORIES, "EXPENSE"], [INCOME_CATEGORIES, "INCOME"]] as const) {
      for (const [name, subs] of Object.entries(source)) {
        records.push({
          id: newId(),
          name,
          type,
          subcategories: subs.map((s) => ({ id: newId(), name: s, categoryId: "" })),
          createdAt: now,
          updatedAt: now,
        } as unknown as Category);
      }
    }
    for (const record of records) await idbPut("categories", record);
  }

  const existingAccounts = await idbGetAll<Account>("accounts");
  if (existingAccounts.length === 0) {
    for (const name of DEFAULT_ACCOUNT_NAMES) {
      await idbPut("accounts", { id: newId(), name, createdAt: now, updatedAt: now });
    }
  }
}
