// Local-mode reports — mirrors backend/src/routes/reports.routes.ts's three
// endpoints (monthly/categories/budgets) exactly, computed client-side over
// IndexedDB. Same faithful-mirror pattern as analyticsService.ts.
import { getStorageProvider } from "@/lib/storage";
import type { Transaction, Category, Budget, ReportItem } from "@/types";
import type { ReportRange } from "@/lib/reportRange";

// Same inclusive day-range semantics as the server (transaction dates are stored as the chosen day).
const inRange = (date: string, r?: ReportRange) => { const d = date.slice(0, 10); return (!r?.from || d >= r.from) && (!r?.to || d <= r.to); };
const pad = (n: number) => String(n).padStart(2, "0");

function budgetWindow(key: string): { start: string; end: string } | null {
  let m = /^(\d{4})-(\d{2})$/.exec(key);
  if (m) return { start: `${m[1]}-${m[2]}-01`, end: `${m[1]}-${m[2]}-${pad(new Date(+m[1], +m[2], 0).getDate())}` };
  m = /^(\d{4})-Q([1-4])$/.exec(key);
  if (m) { const q = +m[2]; return { start: `${m[1]}-${pad((q - 1) * 3 + 1)}-01`, end: `${m[1]}-${pad(q * 3)}-${pad(new Date(+m[1], q * 3, 0).getDate())}` }; }
  m = /^(\d{4})$/.exec(key);
  if (m) return { start: `${m[1]}-01-01`, end: `${m[1]}-12-31` };
  return null;
}

type Stored<T> = T & { createdAt: string; updatedAt: string; [k: string]: unknown };

export async function getLocalMonthlyReport(range?: ReportRange): Promise<{ items: ReportItem[] }> {
  const provider = getStorageProvider();
  const transactions = await provider.list<Stored<Transaction>>("transactions");
  const byMonth = new Map<string, { income: number; expense: number; count: number }>();
  for (const t of transactions.filter((x) => inRange(x.date, range))) {
    const month = new Date(t.date).toISOString().slice(0, 7);
    const entry = byMonth.get(month) ?? { income: 0, expense: 0, count: 0 };
    entry.count += 1;
    if (t.type === "INCOME") entry.income += Number(t.amount); else entry.expense += Number(t.amount);
    byMonth.set(month, entry);
  }
  return { items: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })) };
}

export async function getLocalCategoryReport(range?: ReportRange): Promise<{ items: { category: string; total: number; count: number }[] }> {
  const provider = getStorageProvider();
  const [transactions, categories] = await Promise.all([
    provider.list<Stored<Transaction>>("transactions"),
    provider.list<Stored<Category>>("categories"),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, { total: number; count: number }>();
  for (const t of transactions.filter((x) => inRange(x.date, range))) {
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

export async function getLocalBudgetReport(range?: ReportRange): Promise<{ items: { category: string; period?: string | null; budgeted: number; actual: number; variance: number }[] }> {
  const provider = getStorageProvider();
  const [budgets, categories, transactions] = await Promise.all([
    provider.list<Stored<Budget>>("budgets"),
    provider.list<Stored<Category>>("categories"),
    provider.list<Stored<Transaction>>("transactions"),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const items = budgets.flatMap((b) => {
    const key = String((b as unknown as { periodKey?: string }).periodKey ?? "");
    const win = budgetWindow(key);
    if (win && ((range?.from && win.end < range.from) || (range?.to && win.start > range.to))) return [];
    const actual = transactions
      .filter((t) => t.categoryId === b.categoryId && t.type === "EXPENSE" && (!win || (t.date.slice(0, 10) >= win.start && t.date.slice(0, 10) <= win.end)))
      .reduce((s, t) => s + Number(t.amount), 0);
    const budgeted = Number(b.amount);
    // variance = budgeted - actual: positive = under budget, negative = over (matches the server).
    return [{ category: categoryMap.get(b.categoryId) ?? "Unknown", period: key || null, budgeted, actual, variance: budgeted - actual }];
  });
  return { items };
}
