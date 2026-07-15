import { prisma } from "../../lib/prisma";

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

export async function fetchAllExportData(): Promise<ExportData> {
  const [profileRow, settingsRow, transactions, budgets, investments, bills, goals, accounts, categories] =
    await Promise.all([
      prisma.appProfile.findUnique({ where: { id: "singleton" } }),
      prisma.appSettings.findUnique({ where: { id: "singleton" } }),
      prisma.transaction.findMany({
        include: { category: true, account: true },
        orderBy: { date: "desc" },
        take: 10000,
      }),
      prisma.budget.findMany({ include: { category: true } }),
      prisma.investment.findMany(),
      prisma.bill.findMany({ orderBy: { dueDate: "asc" } }),
      prisma.goal.findMany(),
      prisma.account.findMany({ orderBy: { name: "asc" } }),
      prisma.category.findMany({ include: { subcategories: true }, orderBy: { name: "asc" } }),
    ]);

  const totalIncome = Number(
    (await prisma.transaction.aggregate({ where: { type: "INCOME" }, _sum: { amount: true } }))._sum.amount ?? 0
  );
  const totalExpenses = Number(
    (await prisma.transaction.aggregate({ where: { type: "EXPENSE" }, _sum: { amount: true } }))._sum.amount ?? 0
  );

  const portfolioValue = investments.reduce((s, i) => s + Number(i.currentValue), 0);

  const categoriesMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const expenseByCategory = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { type: "EXPENSE" },
    _sum: { amount: true },
    _count: true,
  });

  return {
    profile: (profileRow?.data ?? null) as Record<string, unknown> | null,
    settings: (settingsRow?.data ?? null) as Record<string, unknown> | null,
    transactions: transactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      description: t.description,
      amount: Number(t.amount),
      type: t.type,
      category: t.category ? { id: t.category.id, name: t.category.name, type: t.category.type } : null,
      account: t.account ? { id: t.account.id, name: t.account.name } : null,
      merchant: t.merchant,
      paymentMethod: t.paymentMethod,
      notes: t.notes,
    })),
    budgets: budgets.map((b) => ({
      id: b.id,
      category: b.category ? { id: b.category.id, name: b.category.name } : null,
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
      dueDate: b.dueDate.toISOString(),
      amount: Number(b.amount),
      paidAmount: Number(b.paidAmount),
      autoPay: b.autoPay,
      notes: b.notes,
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
      categoryBreakdown: expenseByCategory.map((c) => ({
        category: categoriesMap[c.categoryId] ?? c.categoryId,
        total: Number(c._sum.amount ?? 0),
        count: c._count,
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
