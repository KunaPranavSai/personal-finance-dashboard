import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { listRecords } from "../services/drive/dataService";
import { DriveRecord } from "../services/drive/types";

interface TransactionRecord extends DriveRecord {
  date: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  categoryId: string;
  accountId?: string | null;
  paymentMethodTypeId?: string | null;
}
interface CategoryRecord extends DriveRecord {
  name: string;
}
interface PaymentMethodRecord extends DriveRecord {
  name: string;
}

const router = Router();

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
    const accountId = req.query.accountId ? String(req.query.accountId) : undefined;
    const paymentMethodTypeId = req.query.paymentMethodTypeId ? String(req.query.paymentMethodTypeId) : undefined;

    const validFrom = from && !isNaN(from.getTime()) ? from : undefined;
    const validTo = to && !isNaN(to.getTime()) ? to : undefined;

    const [allTransactions, categories, paymentMethods] = await Promise.all([
      listRecords<TransactionRecord>(userId, "transactions"),
      listRecords<CategoryRecord>(userId, "categories"),
      listRecords<PaymentMethodRecord>(userId, "paymentMethods"),
    ]);
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const paymentMethodMap = new Map(paymentMethods.map((p) => [p.id, p.name]));

    const items = allTransactions.filter((t) => {
      if (validFrom && new Date(t.date) < validFrom) return false;
      if (validTo && new Date(t.date) > validTo) return false;
      if (categoryId && t.categoryId !== categoryId) return false;
      if (accountId && t.accountId !== accountId) return false;
      if (paymentMethodTypeId && t.paymentMethodTypeId !== paymentMethodTypeId) return false;
      return true;
    });

    const expenseByCategory = new Map<string, { total: number; count: number }>();
    const incomeByCategory = new Map<string, { total: number; count: number }>();
    const byMonth = new Map<string, { income: number; expense: number; count: number }>();
    const byPaymentMethod = new Map<string, { total: number; count: number }>();
    let totalIncome = 0;
    let totalExpense = 0;

    for (const t of items) {
      const month = new Date(t.date).toISOString().slice(0, 7);
      const monthEntry = byMonth.get(month) ?? { income: 0, expense: 0, count: 0 };
      monthEntry.count += 1;
      if (t.type === "INCOME") {
        monthEntry.income += t.amount;
        totalIncome += t.amount;
        const entry = incomeByCategory.get(t.categoryId) ?? { total: 0, count: 0 };
        entry.total += t.amount; entry.count += 1;
        incomeByCategory.set(t.categoryId, entry);
      } else {
        monthEntry.expense += t.amount;
        totalExpense += t.amount;
        const entry = expenseByCategory.get(t.categoryId) ?? { total: 0, count: 0 };
        entry.total += t.amount; entry.count += 1;
        expenseByCategory.set(t.categoryId, entry);
      }
      byMonth.set(month, monthEntry);

      const pmKey = t.paymentMethodTypeId ?? "UNKNOWN";
      const pmEntry = byPaymentMethod.get(pmKey) ?? { total: 0, count: 0 };
      pmEntry.total += t.amount; pmEntry.count += 1;
      byPaymentMethod.set(pmKey, pmEntry);
    }

    const monthlyTrend = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));
    const monthlyAverage = monthlyTrend.length > 0 ? monthlyTrend.reduce((s, m) => s + m.income + m.expense, 0) / monthlyTrend.length : 0;

    res.json({
      totalTransactions: items.length,
      averageTransaction: items.length > 0 ? (totalIncome + totalExpense) / items.length : 0,
      averageMonthlyVolume: monthlyAverage,
      totalIncome,
      totalExpense,
      totalSavings: totalIncome - totalExpense,
      categoryBreakdown: [...expenseByCategory.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([id, v]) => ({ category: categoryMap.get(id) ?? "Unknown", total: v.total, count: v.count })),
      incomeCategoryBreakdown: [...incomeByCategory.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([id, v]) => ({ category: categoryMap.get(id) ?? "Unknown", total: v.total, count: v.count })),
      monthlyTrend,
      paymentMethodBreakdown: [...byPaymentMethod.entries()].map(([id, v]) => ({
        method: id !== "UNKNOWN" ? paymentMethodMap.get(id) ?? "Unknown" : "UNKNOWN",
        total: v.total,
        count: v.count,
      })),
    });
  })
);

export default router;
