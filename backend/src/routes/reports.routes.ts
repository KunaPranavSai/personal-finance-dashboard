import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get(
  "/monthly",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.$queryRaw<
      { month: string; income: string; expense: string; count: string }[]
    >`
      SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') as month,
             SUM(CASE WHEN "type" = 'INCOME' THEN "amount" ELSE 0 END)::text as income,
             SUM(CASE WHEN "type" = 'EXPENSE' THEN "amount" ELSE 0 END)::text as expense,
             COUNT(*)::text as count
      FROM "Transaction"
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    res.json({ items: rows.map((r) => ({ ...r, income: Number(r.income), expense: Number(r.expense), count: Number(r.count) })) });
  })
);

router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const expenses = await prisma.transaction.groupBy({
      by: ["categoryId"],
      _sum: { amount: true },
      _count: true,
      where: { type: "EXPENSE" },
      orderBy: { _sum: { amount: "desc" } },
    });
    const cats = await prisma.category.findMany({
      where: { id: { in: expenses.map((e) => e.categoryId) } },
    });
    const catMap = new Map(cats.map((c) => [c.id, c.name]));
    res.json({
      items: expenses.map((e) => ({
        category: catMap.get(e.categoryId) ?? "Unknown",
        total: Number(e._sum.amount ?? 0),
        count: e._count,
      })),
    });
  })
);

router.get(
  "/budgets",
  asyncHandler(async (_req, res) => {
    const budgets = await prisma.budget.findMany({ include: { category: true } });
    const enriched = await Promise.all(
      budgets.map(async (b) => {
        const agg = await prisma.transaction.aggregate({
          where: { categoryId: b.categoryId, type: "EXPENSE" },
          _sum: { amount: true },
        });
        const actual = Number(agg._sum.amount ?? 0);
        return {
          category: b.category.name,
          budgeted: Number(b.amount),
          actual,
          variance: actual - Number(b.amount),
        };
      })
    );
    res.json({ items: enriched });
  })
);

export default router;
