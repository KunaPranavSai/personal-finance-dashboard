// Local-mode savings summary — mirrors backend/src/routes/savings.routes.ts's
// formula exactly (income/expense totals, savings rate, last-12-months trend
// sorted newest-first), computed client-side over IndexedDB transactions
// instead of Drive-stored ones. Same "faithful mirror" pattern as
// analyticsService.ts/dashboardService.ts.
import { getStorageProvider } from "@/lib/storage";
import type { Transaction, SavingsSummary } from "@/types";

type Stored<T> = T & { createdAt: string; updatedAt: string; [k: string]: unknown };

export async function getLocalSavingsSummary(): Promise<SavingsSummary> {
  const transactions = await getStorageProvider().list<Stored<Transaction>>("transactions");

  let totalIncome = 0;
  let totalExpenses = 0;
  const byMonth = new Map<string, { income: number; expense: number }>();

  for (const t of transactions) {
    const amount = Number(t.amount);
    if (t.type === "INCOME") totalIncome += amount; else totalExpenses += amount;
    const month = new Date(t.date).toISOString().slice(0, 7);
    const entry = byMonth.get(month) ?? { income: 0, expense: 0 };
    if (t.type === "INCOME") entry.income += amount; else entry.expense += amount;
    byMonth.set(month, entry);
  }
  const totalSavings = totalIncome - totalExpenses;

  const monthlyTrend = [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)
    .map(([month, v]) => ({ month, income: v.income, expense: v.expense, savings: v.income - v.expense }));

  return {
    totalIncome,
    totalExpenses,
    totalSavings,
    savingsRate: totalIncome > 0 ? totalSavings / totalIncome : 0,
    monthlyTrend,
  };
}
