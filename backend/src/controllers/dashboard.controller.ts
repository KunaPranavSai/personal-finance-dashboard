import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  return { start, end };
}

export async function getDashboardSummary(_req: Request, res: Response) {
  const { start: curStart, end: curEnd } = monthRange(0);
  const { start: prevStart, end: prevEnd } = monthRange(-1);

  const [
    totalIncomeAgg, totalExpenseAgg,
    curIncomeAgg, curExpenseAgg,
    prevIncomeAgg, prevExpenseAgg,
    txCount, largestExpense, allExpenseTx, budgets, investments, upcomingBills, goals,
  ] = await Promise.all([
    prisma.transaction.aggregate({ where: { type: "INCOME" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: "EXPENSE" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: "INCOME", date: { gte: curStart, lt: curEnd } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: "EXPENSE", date: { gte: curStart, lt: curEnd } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: "INCOME", date: { gte: prevStart, lt: prevEnd } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: "EXPENSE", date: { gte: prevStart, lt: prevEnd } }, _sum: { amount: true } }),
    prisma.transaction.count(),
    prisma.transaction.findFirst({ where: { type: "EXPENSE" }, orderBy: { amount: "desc" }, include: { category: true } }),
    prisma.transaction.groupBy({ by: ["categoryId"], where: { type: "EXPENSE" }, _sum: { amount: true } }),
    prisma.budget.findMany({ include: { category: true } }),
    prisma.investment.findMany(),
    prisma.bill.findMany({ where: { dueDate: { gte: new Date() } }, orderBy: { dueDate: "asc" }, take: 5 }),
    prisma.goal.findMany(),
  ]);

  const totalIncome = Number(totalIncomeAgg._sum.amount ?? 0);
  const totalExpense = Number(totalExpenseAgg._sum.amount ?? 0);
  const curIncome = Number(curIncomeAgg._sum.amount ?? 0);
  const curExpense = Number(curExpenseAgg._sum.amount ?? 0);
  const prevIncome = Number(prevIncomeAgg._sum.amount ?? 0);
  const prevExpense = Number(prevExpenseAgg._sum.amount ?? 0);

  const totalSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? totalSavings / totalIncome : 0;
  const pctChange = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : cur > 0 ? 1 : 0);

  const portfolioValue = investments.reduce((s, i) => s + Number(i.currentValue), 0);
  const netWorth = totalSavings + portfolioValue;

  let highestCategory: { name: string; total: number } | null = null;
  if (allExpenseTx.length > 0) {
    const catIdMap = new Map<string, string>();
    const cats = await prisma.category.findMany({ where: { id: { in: allExpenseTx.map((c) => c.categoryId) } } });
    cats.forEach((c) => catIdMap.set(c.id, c.name));
    const top = [...allExpenseTx].sort((a, b) => Number(b._sum.amount) - Number(a._sum.amount))[0];
    highestCategory = top ? { name: catIdMap.get(top.categoryId) ?? "Unknown", total: Number(top._sum.amount) } : null;
  }

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalBudgetActual = curExpense; // simplification: current-month actual vs monthly budgets
  const budgetUtilization = totalBudget > 0 ? totalBudgetActual / totalBudget : 0;

  const totalContributions = investments.reduce((s, i) => s + Number(i.monthlyContribution), 0);

  const emergencyFund = goals.find((g) => g.name.toLowerCase().includes("emergency"));
  const emergencyFundProgress = emergencyFund
    ? Number(emergencyFund.currentAmount) / Math.max(Number(emergencyFund.targetAmount), 1)
    : 0;

  // Calculate cash flow: income - expenses in trailing 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const [recentIncomeAgg, recentExpenseAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: "INCOME", date: { gte: thirtyDaysAgo } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "EXPENSE", date: { gte: thirtyDaysAgo } },
      _sum: { amount: true },
    }),
  ]);
  const cashFlow = Number(recentIncomeAgg._sum.amount ?? 0) - Number(recentExpenseAgg._sum.amount ?? 0);

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

  const daysSpan = await prisma.transaction.aggregate({ _min: { date: true }, _max: { date: true } });
  const minDate = daysSpan._min.date;
  const maxDate = daysSpan._max.date;
  const spanDays = minDate && maxDate ? Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / 86400000)) : 1;
  const avgDailySpending = totalExpense / spanDays;
  const avgTransactionAmount = txCount > 0 ? (totalIncome + totalExpense) / txCount : 0;

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
      transactionCount: txCount,
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

export async function getIncomeExpenseTrend(_req: Request, res: Response) {
  const rows = await prisma.$queryRaw<
    { month: string; type: string; total: string }[]
  >`
    SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') as month, "type", SUM("amount")::text as total
    FROM "Transaction"
    GROUP BY 1, 2
    ORDER BY 1 ASC
  `;
  res.json({ items: rows });
}

export async function getCategoryBreakdown(_req: Request, res: Response) {
  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { type: "EXPENSE" },
    _sum: { amount: true },
  });
  const cats = await prisma.category.findMany({ where: { id: { in: rows.map((r) => r.categoryId) } } });
  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  res.json({
    items: rows.map((r) => ({
      category: catMap.get(r.categoryId) ?? "Unknown",
      total: Number(r._sum.amount ?? 0),
    })),
  });
}
