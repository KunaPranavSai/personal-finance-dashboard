import { Request, Response } from "express";
import { listRecords } from "../services/drive/dataService";
import { DriveRecord } from "../services/drive/types";

interface TransactionRecord extends DriveRecord {
  date: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  categoryId: string;
}
interface CategoryRecord extends DriveRecord {
  name: string;
}
interface BudgetRecord extends DriveRecord {
  categoryId: string;
  amount: number;
}
interface InvestmentRecord extends DriveRecord {
  currentValue: number;
  monthlyContribution: number;
}
interface BillRecord extends DriveRecord {
  dueDate: string;
}
interface GoalRecord extends DriveRecord {
  name: string;
  currentAmount: number;
  targetAmount: number;
}

function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  return { start, end };
}

function sumAmount(items: TransactionRecord[], type: "INCOME" | "EXPENSE", from?: Date, to?: Date): number {
  return items
    .filter((t) => t.type === type && (!from || new Date(t.date) >= from) && (!to || new Date(t.date) < to))
    .reduce((s, t) => s + t.amount, 0);
}

export async function getDashboardSummary(req: Request, res: Response) {
  const userId = req.auth!.userId;
  const { start: curStart, end: curEnd } = monthRange(0);
  const { start: prevStart, end: prevEnd } = monthRange(-1);

  const [transactions, categories, budgets, investments, bills, goals] = await Promise.all([
    listRecords<TransactionRecord>(userId, "transactions"),
    listRecords<CategoryRecord>(userId, "categories"),
    listRecords<BudgetRecord>(userId, "budgets"),
    listRecords<InvestmentRecord>(userId, "investments"),
    listRecords<BillRecord>(userId, "bills"),
    listRecords<GoalRecord>(userId, "goals"),
  ]);

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
    expenseByCategory.set(t.categoryId, (expenseByCategory.get(t.categoryId) ?? 0) + t.amount);
  }
  if (expenseByCategory.size > 0) {
    const [topCategoryId, topTotal] = [...expenseByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    highestCategory = { name: categoryMap.get(topCategoryId) ?? "Unknown", total: topTotal };
  }

  const largestExpense = transactions.filter((t) => t.type === "EXPENSE").sort((a, b) => b.amount - a.amount)[0];

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalBudgetActual = curExpense; // simplification: current-month actual vs monthly budgets
  const budgetUtilization = totalBudget > 0 ? totalBudgetActual / totalBudget : 0;

  const totalContributions = investments.reduce((s, i) => s + Number(i.monthlyContribution), 0);

  const emergencyFund = goals.find((g) => g.name.toLowerCase().includes("emergency"));
  const emergencyFundProgress = emergencyFund
    ? Number(emergencyFund.currentAmount) / Math.max(Number(emergencyFund.targetAmount), 1)
    : 0;

  // Cash flow: income - expenses in trailing 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const recentIncome = sumAmount(transactions, "INCOME", thirtyDaysAgo);
  const recentExpense = sumAmount(transactions, "EXPENSE", thirtyDaysAgo);
  const cashFlow = recentIncome - recentExpense;

  // Financial Health Score (0-100), weighted like the workbook version
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

  res.json({
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
  });
}

export async function getIncomeExpenseTrend(req: Request, res: Response) {
  const userId = req.auth!.userId;
  const transactions = await listRecords<TransactionRecord>(userId, "transactions");

  const byMonth = new Map<string, { INCOME: number; EXPENSE: number }>();
  for (const t of transactions) {
    const month = new Date(t.date).toISOString().slice(0, 7); // "YYYY-MM"
    const entry = byMonth.get(month) ?? { INCOME: 0, EXPENSE: 0 };
    entry[t.type] += t.amount;
    byMonth.set(month, entry);
  }

  const items = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([month, totals]) => [
      { month, type: "INCOME", total: String(totals.INCOME) },
      { month, type: "EXPENSE", total: String(totals.EXPENSE) },
    ]);

  res.json({ items });
}

export async function getCategoryBreakdown(req: Request, res: Response) {
  const userId = req.auth!.userId;
  const [transactions, categories] = await Promise.all([
    listRecords<TransactionRecord>(userId, "transactions"),
    listRecords<CategoryRecord>(userId, "categories"),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "EXPENSE") continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }

  res.json({
    items: [...totals.entries()].map(([categoryId, total]) => ({
      category: categoryMap.get(categoryId) ?? "Unknown",
      total,
    })),
  });
}
