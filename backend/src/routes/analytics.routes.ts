import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    // Optional filters: from/to (ISO dates), categoryId, accountId, paymentMethodTypeId
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
    const accountId = req.query.accountId ? String(req.query.accountId) : undefined;
    const paymentMethodTypeId = req.query.paymentMethodTypeId ? String(req.query.paymentMethodTypeId) : undefined;

    const validFrom = from && !isNaN(from.getTime()) ? from : undefined;
    const validTo = to && !isNaN(to.getTime()) ? to : undefined;

    const where: Prisma.TransactionWhereInput = {
      ...((validFrom || validTo) && {
        date: { ...(validFrom && { gte: validFrom }), ...(validTo && { lte: validTo }) },
      }),
      ...(categoryId && { categoryId }),
      ...(accountId && { accountId }),
      ...(paymentMethodTypeId && { paymentMethodTypeId }),
    };

    // The raw monthly-trend query needs the same filters expressed as SQL conditions.
    const conditions: Prisma.Sql[] = [];
    if (validFrom) conditions.push(Prisma.sql`"date" >= ${validFrom}`);
    if (validTo) conditions.push(Prisma.sql`"date" <= ${validTo}`);
    if (categoryId) conditions.push(Prisma.sql`"categoryId" = ${categoryId}`);
    if (accountId) conditions.push(Prisma.sql`"accountId" = ${accountId}`);
    if (paymentMethodTypeId) conditions.push(Prisma.sql`"paymentMethodTypeId" = ${paymentMethodTypeId}`);
    const whereSql = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

    const [
      txCount,
      expenseCategoryBreakdown,
      incomeCategoryBreakdown,
      monthlyTotals,
      paymentMethodBreakdown,
      overallAvg,
      totals,
    ] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        _sum: { amount: true },
        _count: true,
        where: { ...where, type: "EXPENSE" },
        orderBy: { _sum: { amount: "desc" } },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        _sum: { amount: true },
        _count: true,
        where: { ...where, type: "INCOME" },
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
        ${whereSql}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.transaction.groupBy({
        by: ["paymentMethodTypeId"],
        _sum: { amount: true },
        _count: true,
        where,
      }),
      prisma.transaction.aggregate({ _avg: { amount: true }, where }),
      Promise.all([
        prisma.transaction.aggregate({ where: { ...where, type: "INCOME" }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { ...where, type: "EXPENSE" }, _sum: { amount: true } }),
      ]),
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

    const totalIncome = Number(totals[0]._sum.amount ?? 0);
    const totalExpense = Number(totals[1]._sum.amount ?? 0);

    res.json({
      totalTransactions: txCount,
      averageTransaction: Number(overallAvg._avg.amount ?? 0),
      averageMonthlyVolume: monthlyAverage,
      totalIncome,
      totalExpense,
      totalSavings: totalIncome - totalExpense,
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
