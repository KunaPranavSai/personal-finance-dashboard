import { listAllCollections, getRecord } from "../drive/dataService";
import { DriveRecord } from "../drive/types";

export interface ExportData {
  profile: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  transactions: Record<string, unknown>[];
  budgets: Record<string, unknown>[];
  investments: Record<string, unknown>[];
  bills: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  accounts: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  analytics: Record<string, unknown> | null;
  dashboard: Record<string, unknown> | null;
}

export interface ExportDateRange {
  from?: Date;
  to?: Date;
}

interface TransactionRecord extends DriveRecord {
  date: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  categoryId: string;
  accountId?: string | null;
  paymentMethodTypeId?: string | null;
  merchant?: string | null;
  notes?: string | null;
}
interface CategoryRecord extends DriveRecord {
  name: string;
  type: "INCOME" | "EXPENSE";
  subcategories: { id: string; name: string }[];
}
interface AccountRecord extends DriveRecord { name: string }
interface PaymentMethodRecord extends DriveRecord { name: string }
interface BudgetRecord extends DriveRecord { categoryId: string; period: string; periodKey: string; amount: number }
interface InvestmentRecord extends DriveRecord { instrument: string; category: string; currentValue: number; monthlyContribution: number; annualReturnPct: number }
interface BillRecord extends DriveRecord { name: string; type: string; dueDate: string; amount: number; paidAmount: number; autoPay: boolean; notes?: string | null }
interface GoalRecord extends DriveRecord { name: string; category: string; targetAmount: number; currentAmount: number; monthlyContribution: number }

/** Reads a user's full Penny Pilot workspace from their Google Drive and assembles the same
 * shape the CSV/Excel/JSON/PDF exporters and (formerly) the Postgres-backup feature both
 * already expected — those consumers need no changes since this is a drop-in replacement for
 * what used to be a Prisma-backed aggregator. */
export async function fetchAllExportData(userId: string, range?: ExportDateRange): Promise<ExportData> {
  const [collections, profileRecord, settingsRecord] = await Promise.all([
    listAllCollections(userId),
    getRecord(userId, "settings", "app_profile"),
    getRecord(userId, "settings", "app_settings"),
  ]);

  const categories = collections.categories as CategoryRecord[];
  const accounts = collections.accounts as AccountRecord[];
  const paymentMethods = collections.paymentMethods as PaymentMethodRecord[];
  const budgets = collections.budgets as BudgetRecord[];
  const investments = collections.investments as InvestmentRecord[];
  const bills = collections.bills as BillRecord[];
  const goals = collections.goals as GoalRecord[];

  let transactions = collections.transactions as TransactionRecord[];
  if (range?.from) transactions = transactions.filter((t) => new Date(t.date) >= range.from!);
  if (range?.to) transactions = transactions.filter((t) => new Date(t.date) <= range.to!);
  transactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10000);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const paymentMethodMap = new Map(paymentMethods.map((p) => [p.id, p]));

  const totalIncome = transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const portfolioValue = investments.reduce((s, i) => s + Number(i.currentValue), 0);

  const expenseByCategory = new Map<string, { total: number; count: number }>();
  for (const t of transactions) {
    if (t.type !== "EXPENSE") continue;
    const entry = expenseByCategory.get(t.categoryId) ?? { total: 0, count: 0 };
    entry.total += t.amount; entry.count += 1;
    expenseByCategory.set(t.categoryId, entry);
  }

  return {
    profile: (profileRecord as Record<string, unknown> | null) ?? null,
    settings: (settingsRecord as Record<string, unknown> | null) ?? null,
    transactions: transactions.map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amount: Number(t.amount),
      type: t.type,
      category: categoryMap.has(t.categoryId) ? { id: t.categoryId, name: categoryMap.get(t.categoryId)!.name, type: categoryMap.get(t.categoryId)!.type } : null,
      account: t.accountId && accountMap.has(t.accountId) ? { id: t.accountId, name: accountMap.get(t.accountId)!.name } : null,
      merchant: t.merchant ?? null,
      paymentMethod: t.paymentMethodTypeId ? paymentMethodMap.get(t.paymentMethodTypeId)?.name ?? null : null,
      notes: t.notes ?? null,
    })),
    budgets: budgets.map((b) => ({
      id: b.id,
      category: categoryMap.has(b.categoryId) ? { id: b.categoryId, name: categoryMap.get(b.categoryId)!.name } : null,
      period: b.period,
      periodKey: b.periodKey,
      amount: Number(b.amount),
      actual: 0,
      remaining: 0,
      status: "UNDER_BUDGET",
    })),
    investments: investments.map((inv) => ({
      id: inv.id,
      instrument: inv.instrument,
      category: inv.category,
      currentValue: Number(inv.currentValue),
      monthlyContribution: Number(inv.monthlyContribution),
      annualReturnPct: Number(inv.annualReturnPct),
    })),
    bills: bills.map((b) => ({
      id: b.id,
      name: b.name,
      type: b.type,
      dueDate: b.dueDate,
      amount: Number(b.amount),
      paidAmount: Number(b.paidAmount),
      autoPay: b.autoPay,
      notes: b.notes ?? null,
    })),
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      targetAmount: Number(g.targetAmount),
      currentAmount: Number(g.currentAmount),
      monthlyContribution: Number(g.monthlyContribution),
    })),
    accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name })),
    })),
    analytics: {
      totalIncome,
      totalExpenses,
      totalSavings: totalIncome - totalExpenses,
      categoryBreakdown: [...expenseByCategory.entries()].map(([id, v]) => ({
        category: categoryMap.get(id)?.name ?? id,
        total: v.total,
        count: v.count,
      })),
    },
    dashboard: {
      kpis: {
        totalIncome,
        totalExpenses,
        totalSavings: totalIncome - totalExpenses,
        cashFlow: totalIncome - totalExpenses,
        netWorth: totalIncome - totalExpenses + portfolioValue,
        portfolioValue,
        transactionCount: transactions.length,
      },
    },
  };
}
