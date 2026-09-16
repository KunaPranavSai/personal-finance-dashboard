// Local-mode dashboard aggregation — mirrors backend/src/controllers/dashboard.controller.ts's
// formulas exactly (getDashboardSummary/getIncomeExpenseTrend/getCategoryBreakdown), computed
// client-side over IndexedDB collections instead of Drive-stored ones, so the KPI cards, trend
// chart and category breakdown all work identically in both storage modes.
import { getStorageProvider } from "@/lib/storage";
import type { DashboardSummary, Transaction, Category, Budget, Investment, Bill, Goal } from "@/types";

type Stored<T> = T & { createdAt: string; updatedAt: string; [k: string]: unknown };

function monthRange(offset = 0): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  return { start, end };
}

function sumAmount(items: Transaction[], type: "INCOME" | "EXPENSE", from?: Date, to?: Date): number {
  return items
    .filter((t) => t.type === type && (!from || new Date(t.date) >= from) && (!to || new Date(t.date) < to))
    .reduce((s, t) => s + Number(t.amount), 0);
}

async function loadAll() {
  const provider = getStorageProvider();
  const [transactions, categories, budgets, investments, bills, goals] = await Promise.all([
    provider.list<Stored<Transaction>>("transactions"),
    provider.list<Stored<Category>>("categories"),
    provider.list<Stored<Budget>>("budgets"),
    provider.list<Stored<Investment>>("investments"),
    provider.list<Stored<Bill>>("bills"),
    provider.list<Stored<Goal>>("goals"),
  ]);
  return { transactions, categories, budgets, investments, bills, goals };
}

export async function getLocalDashboardSummary(): Promise<DashboardSummary> {
  const { transactions, categories, budgets, investments, bills, goals } = await loadAll();
  const { start: curStart, end: curEnd } = monthRange(0);
  const { start: prevStart, end: prevEnd } = monthRange(-1);

  const totalIncome = sumAmount(transactions, "INCOME");
  const totalExpense = sumAmount(transactions, "EXPENSE");
  const curIncome = sumAmount(transactions, "INCOME", curStart, curEnd);
  const curExpense = sumAmount(transactions, "EXPENSE", curStart, curEnd);
  const prevIncome = sumAmount(transactions, "INCOME", prevStart, prevEnd);
  const prevExpense = sumAmount(transactions, "EXPENSE", prevStart, prevEnd);

  const totalSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? totalSavings / totalIncome : 0;
  const pctChange = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : cur > 0 ? 1 : 0);

  const portfolioValue = investments.reduce((s, i) => s + Number(i.currentValue), 0);
  const netWorth = totalSavings + portfolioValue;

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  let highestCategory: { name: string; total: number } | null = null;
  const expenseByCategory = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "EXPENSE") continue;
    expenseByCategory.set(t.categoryId, (expenseByCategory.get(t.categoryId) ?? 0) + Number(t.amount));
  }
  if (expenseByCategory.size > 0) {
    const [topCategoryId, topTotal] = [...expenseByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    highestCategory = { name: categoryMap.get(topCategoryId) ?? "Unknown", total: topTotal };
  }

  const largestExpense = transactions.filter((t) => t.type === "EXPENSE").sort((a, b) => Number(b.amount) - Number(a.amount))[0];

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const budgetUtilization = totalBudget > 0 ? curExpense / totalBudget : 0;

  const totalContributions = investments.reduce((s, i) => s + Number(i.monthlyContribution), 0);

  const emergencyFund = goals.find((g) => g.name.toLowerCase().includes("emergency"));
  const emergencyFundProgress = emergencyFund
    ? Number(emergencyFund.currentAmount) / Math.max(Number(emergencyFund.targetAmount), 1)
    : 0;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const recentIncome = sumAmount(transactions, "INCOME", thirtyDaysAgo);
  const recentExpense = sumAmount(transactions, "EXPENSE", thirtyDaysAgo);
  const cashFlow = recentIncome - recentExpense;

  const budgetAdherence = 1 - Math.min(budgetUtilization, 1.5) / 1.5;
  const investmentRatio = totalIncome > 0 ? Math.min(portfolioValue / totalIncome, 1) : 0;
  const healthScore = Math.round(
    Math.min(100, Math.max(0,
      Math.min(savingsRate, 0.3) / 0.3 * 30 +
      budgetAdherence * 25 +
      Math.min(emergencyFundProgress, 1) * 25 +
      investmentRatio * 20
    ))
  );

  const dates = transactions.map((t) => new Date(t.date).getTime());
  const spanDays = dates.length > 0 ? Math.max(1, Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000)) : 1;
  const avgDailySpending = totalExpense / spanDays;
  const avgTransactionAmount = transactions.length > 0 ? (totalIncome + totalExpense) / transactions.length : 0;

  const now = new Date();
  const upcomingBills = bills
    .filter((b) => new Date(b.dueDate) >= now)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  return {
    kpis: {
      totalIncome,
      totalExpenses: totalExpense,
      totalSavings,
      netWorth,
      budgetUtilizationPct: budgetUtilization,
      savingsRatePct: savingsRate,
      financialHealthScore: healthScore,
      emergencyFundProgressPct: emergencyFundProgress,
      investmentGrowth: portfolioValue - totalContributions,
      highestSpendingCategory: highestCategory?.name ?? null,
      largestExpense: largestExpense ? Number(largestExpense.amount) : 0,
      avgDailySpending,
      avgTransactionAmount,
      transactionCount: transactions.length,
      cashFlow,
      monthlyBalance: curIncome - curExpense,
      currentMonth: { income: curIncome, expense: curExpense },
      changeVsPrevMonth: {
        income: pctChange(curIncome, prevIncome),
        expense: pctChange(curExpense, prevExpense),
      },
    },
    upcomingBills,
    goalCount: goals.length,
  };
}

export async function getLocalIncomeExpenseTrend(): Promise<{ items: { month: string; type: string; total: string }[] }> {
  const provider = getStorageProvider();
  const transactions = await provider.list<Stored<Transaction>>("transactions");
  const byMonth = new Map<string, { INCOME: number; EXPENSE: number }>();
  for (const t of transactions) {
    const month = new Date(t.date).toISOString().slice(0, 7);
    const entry = byMonth.get(month) ?? { INCOME: 0, EXPENSE: 0 };
    entry[t.type] += Number(t.amount);
    byMonth.set(month, entry);
  }
  const items = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([month, totals]) => [
      { month, type: "INCOME", total: String(totals.INCOME) },
      { month, type: "EXPENSE", total: String(totals.EXPENSE) },
    ]);
  return { items };
}

export async function getLocalCategoryBreakdown(): Promise<{ items: { category: string; total: number }[] }> {
  const provider = getStorageProvider();
  const [transactions, categories] = await Promise.all([
    provider.list<Stored<Transaction>>("transactions"),
    provider.list<Stored<Category>>("categories"),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "EXPENSE") continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + Number(t.amount));
  }
  return { items: [...totals.entries()].map(([categoryId, total]) => ({ category: categoryMap.get(categoryId) ?? "Unknown", total })) };
}
