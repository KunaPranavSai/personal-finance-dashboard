import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
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

const router = Router();

router.get(
  "/monthly",
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const transactions = await listRecords<TransactionRecord>(userId, "transactions");

    const byMonth = new Map<string, { income: number; expense: number; count: number }>();
    for (const t of transactions) {
      const month = new Date(t.date).toISOString().slice(0, 7);
      const entry = byMonth.get(month) ?? { income: 0, expense: 0, count: 0 };
      entry.count += 1;
      if (t.type === "INCOME") entry.income += t.amount; else entry.expense += t.amount;
      byMonth.set(month, entry);
    }

    res.json({ items: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })) });
  })
);

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const [transactions, categories] = await Promise.all([
      listRecords<TransactionRecord>(userId, "transactions"),
      listRecords<CategoryRecord>(userId, "categories"),
    ]);
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const totals = new Map<string, { total: number; count: number }>();
    for (const t of transactions) {
      if (t.type !== "EXPENSE") continue;
      const entry = totals.get(t.categoryId) ?? { total: 0, count: 0 };
      entry.total += t.amount; entry.count += 1;
      totals.set(t.categoryId, entry);
    }

    res.json({
      items: [...totals.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([id, v]) => ({ category: categoryMap.get(id) ?? "Unknown", total: v.total, count: v.count })),
    });
  })
);

router.get(
  "/budgets",
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const [budgets, categories, transactions] = await Promise.all([
      listRecords<BudgetRecord>(userId, "budgets"),
      listRecords<CategoryRecord>(userId, "categories"),
      listRecords<TransactionRecord>(userId, "transactions"),
    ]);
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const items = budgets.map((b) => {
      const actual = transactions
        .filter((t) => t.categoryId === b.categoryId && t.type === "EXPENSE")
        .reduce((s, t) => s + t.amount, 0);
      return {
        category: categoryMap.get(b.categoryId) ?? "Unknown",
        budgeted: Number(b.amount),
        actual,
        variance: actual - Number(b.amount),
      };
    });

    res.json({ items });
  })
);

export default router;
