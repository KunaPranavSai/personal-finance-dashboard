// Local-mode reports — mirrors backend/src/routes/reports.routes.ts's three
// endpoints (monthly/categories/budgets) exactly, computed client-side over
// IndexedDB. Same faithful-mirror pattern as analyticsService.ts.
import { getStorageProvider } from "@/lib/storage";
import type { Transaction, Category, Budget, ReportItem } from "@/types";

type Stored<T> = T & { createdAt: string; updatedAt: string; [k: string]: unknown };

export async function getLocalMonthlyReport(): Promise<{ items: ReportItem[] }> {
  const provider = getStorageProvider();
  const transactions = await provider.list<Stored<Transaction>>("transactions");
  const byMonth = new Map<string, { income: number; expense: number; count: number }>();
  for (const t of transactions) {
    const month = new Date(t.date).toISOString().slice(0, 7);
    const entry = byMonth.get(month) ?? { income: 0, expense: 0, count: 0 };
    entry.count += 1;
    if (t.type === "INCOME") entry.income += Number(t.amount); else entry.expense += Number(t.amount);
    byMonth.set(month, entry);
  }
  return { items: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })) };
}

export async function getLocalCategoryReport(): Promise<{ items: { category: string; total: number; count: number }[] }> {
  const provider = getStorageProvider();
  const [transactions, categories] = await Promise.all([
    provider.list<Stored<Transaction>>("transactions"),
    provider.list<Stored<Category>>("categories"),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, { total: number; count: number }>();
  for (const t of transactions) {
    if (t.type !== "EXPENSE") continue;
    const entry = totals.get(t.categoryId) ?? { total: 0, count: 0 };
    entry.total += Number(t.amount); entry.count += 1;
    totals.set(t.categoryId, entry);
  }
  return {
    items: [...totals.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([id, v]) => ({ category: categoryMap.get(id) ?? "Unknown", total: v.total, count: v.count })),
  };
}

export async function getLocalBudgetReport(): Promise<{ items: { category: string; budgeted: number; actual: number; variance: number }[] }> {
  const provider = getStorageProvider();
  const [budgets, categories, transactions] = await Promise.all([
    provider.list<Stored<Budget>>("budgets"),
    provider.list<Stored<Category>>("categories"),
    provider.list<Stored<Transaction>>("transactions"),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const items = budgets.map((b) => {
    const actual = transactions
      .filter((t) => t.categoryId === b.categoryId && t.type === "EXPENSE")
      .reduce((s, t) => s + Number(t.amount), 0);
    return {
      category: categoryMap.get(b.categoryId) ?? "Unknown",
      budgeted: Number(b.amount),
      actual,
      variance: actual - Number(b.amount),
    };
  });
  return { items };
}
