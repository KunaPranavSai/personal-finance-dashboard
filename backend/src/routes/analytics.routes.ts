import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const [
      txCount,
      categoryBreakdown,
      monthlyTotals,
      paymentMethodBreakdown,
      avgMonthly,
    ] = await Promise.all([
      prisma.transaction.count(),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        _sum: { amount: true },
        _count: true,
        where: { type: "EXPENSE" },
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
        by: ["paymentMethod"],
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        _avg: { amount: true },
      }),
    ]);

    const cats = await prisma.category.findMany({
      where: { id: { in: categoryBreakdown.map((c) => c.categoryId) } },
    });
    const catMap = new Map(cats.map((c) => [c.id, c.name]));

    res.json({
      totalTransactions: txCount,
      averageTransaction: Number(avgMonthly._avg.amount ?? 0),
      categoryBreakdown: categoryBreakdown.map((c) => ({
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
        method: p.paymentMethod ?? "UNKNOWN",
        total: Number(p._sum.amount ?? 0),
        count: p._count,
      })),
    });
  })
);

export default router;
