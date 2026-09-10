import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { listRecords } from "../services/drive/dataService";
import { DriveRecord } from "../services/drive/types";

interface TransactionRecord extends DriveRecord {
  date: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
}

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const transactions = await listRecords<TransactionRecord>(userId, "transactions");

    let totalIncome = 0;
    let totalExpense = 0;
    const byMonth = new Map<string, { income: number; expense: number }>();
    for (const t of transactions) {
      if (t.type === "INCOME") totalIncome += t.amount; else totalExpense += t.amount;
      const month = new Date(t.date).toISOString().slice(0, 7);
      const entry = byMonth.get(month) ?? { income: 0, expense: 0 };
      if (t.type === "INCOME") entry.income += t.amount; else entry.expense += t.amount;
      byMonth.set(month, entry);
    }
    const totalSavings = totalIncome - totalExpense;

    const monthlyTrend = [...byMonth.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 12)
      .map(([month, v]) => ({ month, income: v.income, expense: v.expense, savings: v.income - v.expense }));

    res.json({
      totalIncome,
      totalExpenses: totalExpense,
      totalSavings,
      savingsRate: totalIncome > 0 ? totalSavings / totalIncome : 0,
      monthlyTrend,
    });
  })
);

export default router;
