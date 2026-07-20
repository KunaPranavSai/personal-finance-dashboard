import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const [totalIncomeAgg, totalExpenseAgg, monthlyAgg] = await Promise.all([
      prisma.transaction.aggregate({ where: { userId, type: "INCOME" }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId, type: "EXPENSE" }, _sum: { amount: true } }),
      prisma.$queryRaw<
        { month: string; income: string; expense: string }[]
      >`
        SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') as month,
               SUM(CASE WHEN "type" = 'INCOME' THEN "amount" ELSE 0 END)::text as income,
               SUM(CASE WHEN "type" = 'EXPENSE' THEN "amount" ELSE 0 END)::text as expense
        FROM "Transaction"
        WHERE "userId" = ${userId}
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 12
      `,
    ]);

    const totalIncome = Number(totalIncomeAgg._sum.amount ?? 0);
    const totalExpense = Number(totalExpenseAgg._sum.amount ?? 0);
    const totalSavings = totalIncome - totalExpense;

    res.json({
      totalIncome,
      totalExpenses: totalExpense,
      totalSavings,
      savingsRate: totalIncome > 0 ? totalSavings / totalIncome : 0,
      monthlyTrend: monthlyAgg.map((r) => ({
        month: r.month,
        income: Number(r.income),
        expense: Number(r.expense),
        savings: Number(r.income) - Number(r.expense),
      })),
    });
  })
);

export default router;
