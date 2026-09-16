// Local-mode analytics — mirrors backend/src/routes/analytics.routes.ts's
// `/summary` formula exactly (filters, category/payment-method/monthly
// breakdowns), computed client-side over IndexedDB collections instead of
// Drive-stored ones, so Analytics works identically in both storage modes.
// Same "faithful mirror" pattern as dashboardService.ts/budgetsService.ts —
// there's no shared runtime between the Node backend and the browser, so
// "shared aggregation" here means provably-identical logic, not literally
// shared bytes; both sides are ported line-for-line from the same source.
import { getStorageProvider } from "@/lib/storage";
import type { Transaction, Category, PaymentMethodType, AnalyticsSummary } from "@/types";

type Stored<T> = T & { createdAt: string; updatedAt: string; [k: string]: unknown };

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  categoryId?: string;
  accountId?: string;
  paymentMethodTypeId?: string;
}

export interface FilteredAnalyticsResult extends AnalyticsSummary {
  totalIncome: number;
  totalExpense: number;
  totalSavings: number;
}

export async function getLocalAnalyticsSummary(filters: AnalyticsFilters): Promise<FilteredAnalyticsResult> {
  const provider = getStorageProvider();
  const [allTransactions, categories, paymentMethods] = await Promise.all([
    provider.list<Stored<Transaction>>("transactions"),
    provider.list<Stored<Category>>("categories"),
    provider.list<Stored<PaymentMethodType>>("paymentMethods"),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const paymentMethodMap = new Map(paymentMethods.map((p) => [p.id, p.name]));

  const validFrom = filters.from ? new Date(filters.from) : undefined;
  const validTo = filters.to ? new Date(filters.to) : undefined;

  const items = allTransactions.filter((t) => {
    if (validFrom && !isNaN(validFrom.getTime()) && new Date(t.date) < validFrom) return false;
    if (validTo && !isNaN(validTo.getTime()) && new Date(t.date) > validTo) return false;
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
    if (filters.accountId && t.accountId !== filters.accountId) return false;
    if (filters.paymentMethodTypeId && t.paymentMethodTypeId !== filters.paymentMethodTypeId) return false;
    return true;
  });

  const expenseByCategory = new Map<string, { total: number; count: number }>();
  const incomeByCategory = new Map<string, { total: number; count: number }>();
  const byMonth = new Map<string, { income: number; expense: number; count: number }>();
  const byPaymentMethod = new Map<string, { total: number; count: number }>();
  let totalIncome = 0;
  let totalExpense = 0;

  for (const t of items) {
    const amount = Number(t.amount);
    const month = new Date(t.date).toISOString().slice(0, 7);
    const monthEntry = byMonth.get(month) ?? { income: 0, expense: 0, count: 0 };
    monthEntry.count += 1;
    if (t.type === "INCOME") {
      monthEntry.income += amount;
      totalIncome += amount;
      const entry = incomeByCategory.get(t.categoryId) ?? { total: 0, count: 0 };
      entry.total += amount; entry.count += 1;
      incomeByCategory.set(t.categoryId, entry);
    } else {
      monthEntry.expense += amount;
      totalExpense += amount;
      const entry = expenseByCategory.get(t.categoryId) ?? { total: 0, count: 0 };
      entry.total += amount; entry.count += 1;
      expenseByCategory.set(t.categoryId, entry);
    }
    byMonth.set(month, monthEntry);

    const pmKey = t.paymentMethodTypeId ?? "UNKNOWN";
    const pmEntry = byPaymentMethod.get(pmKey) ?? { total: 0, count: 0 };
    pmEntry.total += amount; pmEntry.count += 1;
    byPaymentMethod.set(pmKey, pmEntry);
  }

  const monthlyTrend = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));
  const monthlyAverage = monthlyTrend.length > 0 ? monthlyTrend.reduce((s, m) => s + m.income + m.expense, 0) / monthlyTrend.length : 0;

  return {
    totalTransactions: items.length,
    averageTransaction: items.length > 0 ? (totalIncome + totalExpense) / items.length : 0,
    averageMonthlyVolume: monthlyAverage,
    totalIncome,
    totalExpense,
    totalSavings: totalIncome - totalExpense,
    categoryBreakdown: [...expenseByCategory.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([id, v]) => ({ category: categoryMap.get(id) ?? "Unknown", total: v.total, count: v.count })),
    incomeCategoryBreakdown: [...incomeByCategory.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([id, v]) => ({ category: categoryMap.get(id) ?? "Unknown", total: v.total, count: v.count })),
    monthlyTrend,
    paymentMethodBreakdown: [...byPaymentMethod.entries()].map(([id, v]) => ({
      method: id !== "UNKNOWN" ? paymentMethodMap.get(id) ?? "Unknown" : "UNKNOWN",
      total: v.total,
      count: v.count,
    })),
  };
}
