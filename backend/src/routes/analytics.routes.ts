import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const [
      txCount,
      expenseCategoryBreakdown,
      incomeCategoryBreakdown,
      monthlyTotals,
      paymentMethodBreakdown,
      overallAvg,
    ] = await Promise.all([
      prisma.transaction.count(),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        _sum: { amount: true },
        _count: true,
        where: { type: "EXPENSE" },
        orderBy: { _sum: { amount: "desc" } },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        _sum: { amount: true },
        _count: true,
        where: { type: "INCOME" },
        orderBy: { _sum: { amount: "desc" } },
      }),
      prisma.$queryRaw<
        { month: string; income: string; expense: string; count: string }[]
      >`
        SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') as month,
               SUM(CASE WHEN "type" = 'INCOME' THEN "amount" ELSE 0 END)::text as income,
               SUM(CASE WHEN "type" = 'EXPENSE' THEN "amount" ELSE 0 END)::text as expense,
               COUNT(*)::text as count
        FROM "Transaction"
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.transaction.groupBy({
        by: ["paymentMethodTypeId"],
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        _avg: { amount: true },
      }),
    ]);

    const catIds = [
      ...expenseCategoryBreakdown.map((c) => c.categoryId),
      ...incomeCategoryBreakdown.map((c) => c.categoryId),
    ];
    const cats = await prisma.category.findMany({ where: { id: { in: catIds } } });
    const catMap = new Map(cats.map((c) => [c.id, c.name]));

    const paymentMethodIds = paymentMethodBreakdown
      .map((p) => p.paymentMethodTypeId)
      .filter((id): id is string => id !== null);
    const paymentMethods = await prisma.paymentMethodType.findMany({ where: { id: { in: paymentMethodIds } } });
    const paymentMethodMap = new Map(paymentMethods.map((p) => [p.id, p.name]));

    // True monthly average: average of each month's total transaction volume, not a flat all-time average.
    const monthlyAverage =
      monthlyTotals.length > 0
        ? monthlyTotals.reduce((sum, m) => sum + Number(m.income) + Number(m.expense), 0) / monthlyTotals.length
        : 0;

    res.json({
      totalTransactions: txCount,
      averageTransaction: Number(overallAvg._avg.amount ?? 0),
      averageMonthlyVolume: monthlyAverage,
      categoryBreakdown: expenseCategoryBreakdown.map((c) => ({
        category: catMap.get(c.categoryId) ?? "Unknown",
        total: Number(c._sum.amount ?? 0),
        count: c._count,
      })),
      incomeCategoryBreakdown: incomeCategoryBreakdown.map((c) => ({
        category: catMap.get(c.categoryId) ?? "Unknown",
        total: Number(c._sum.amount ?? 0),
        count: c._count,
      })),
      monthlyTrend: monthlyTotals.map((r) => ({
        month: r.month,
        income: Number(r.income),
        expense: Number(r.expense),
        count: Number(r.count),
      })),
      paymentMethodBreakdown: paymentMethodBreakdown.map((p) => ({
        method: p.paymentMethodTypeId ? paymentMethodMap.get(p.paymentMethodTypeId) ?? "Unknown" : "UNKNOWN",
        total: Number(p._sum.amount ?? 0),
        count: p._count,
      })),
    });
  })
);

export default router;
