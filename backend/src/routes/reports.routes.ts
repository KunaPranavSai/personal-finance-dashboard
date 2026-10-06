import { Request, Router } from "express";
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
interface BudgetRecord extends DriveRecord {
  categoryId: string;
  amount: number;
  period?: "MONTHLY" | "QUARTERLY" | "YEARLY";
  periodKey?: string;
}

const router = Router();

/** Optional ?from=&to=&categoryId=&accountId=&paymentMethodTypeId= (dates are YYYY-MM-DD, both ends inclusive). */
function filterOf(req: Request) {
  const q = (k: string) => (req.query[k] ? String(req.query[k]) : undefined);
  const from = q("from") ? new Date(`${q("from")!.slice(0, 10)}T00:00:00.000Z`) : undefined;
  const to = q("to") ? new Date(`${q("to")!.slice(0, 10)}T23:59:59.999Z`) : undefined;
  const categoryId = q("categoryId"), accountId = q("accountId"), paymentMethodTypeId = q("paymentMethodTypeId");
  return {
    from: from && !isNaN(from.getTime()) ? from : undefined,
    to: to && !isNaN(to.getTime()) ? to : undefined,
    match: (t: TransactionRecord) => {
      const d = new Date(t.date);
      if (from && !isNaN(from.getTime()) && d < from) return false;
      if (to && !isNaN(to.getTime()) && d > to) return false;
      if (categoryId && t.categoryId !== categoryId) return false;
      if (accountId && t.accountId !== accountId) return false;
      if (paymentMethodTypeId && t.paymentMethodTypeId !== paymentMethodTypeId) return false;
      return true;
    },
  };
}

/** The [start, end] a budget covers, from its period + key ("2026-07", "2026-Q2", "2026"). */
function budgetWindow(b: BudgetRecord): { start: Date; end: Date } | null {
  const key = b.periodKey ?? "";
  let m = /^(\d{4})-(\d{2})$/.exec(key);
  if (m) { const y = +m[1], mo = +m[2] - 1; return { start: new Date(Date.UTC(y, mo, 1)), end: new Date(Date.UTC(y, mo + 1, 0, 23, 59, 59, 999)) }; }
  m = /^(\d{4})-Q([1-4])$/.exec(key);
  if (m) { const y = +m[1], q = +m[2] - 1; return { start: new Date(Date.UTC(y, q * 3, 1)), end: new Date(Date.UTC(y, q * 3 + 3, 0, 23, 59, 59, 999)) }; }
  m = /^(\d{4})$/.exec(key);
  if (m) { const y = +m[1]; return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)) }; }
  return null;
}

router.get(
  "/monthly",
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const f = filterOf(req);
    const transactions = (await listRecords<TransactionRecord>(userId, "transactions")).filter(f.match);

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
    const f = filterOf(req);
    const [all, categories] = await Promise.all([
      listRecords<TransactionRecord>(userId, "transactions"),
      listRecords<CategoryRecord>(userId, "categories"),
    ]);
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const totals = new Map<string, { total: number; count: number }>();
    for (const t of all.filter(f.match)) {
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

// Budget vs Actual: each budget is compared with spending inside ITS OWN period (not lifetime spending).
// With ?from/&to only budgets whose period overlaps that range are listed. variance = budgeted - actual,
// so a positive variance means under budget and a negative one means over.
router.get(
  "/budgets",
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const f = filterOf(req);
    const [budgets, categories, transactions] = await Promise.all([
      listRecords<BudgetRecord>(userId, "budgets"),
      listRecords<CategoryRecord>(userId, "categories"),
      listRecords<TransactionRecord>(userId, "transactions"),
    ]);
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const items = budgets.flatMap((b) => {
      const win = budgetWindow(b);
      if (win && ((f.from && win.end < f.from) || (f.to && win.start > f.to))) return [];
      const actual = transactions
        .filter((t) => t.categoryId === b.categoryId && t.type === "EXPENSE" && (!win || (new Date(t.date) >= win.start && new Date(t.date) <= win.end)))
        .reduce((s, t) => s + t.amount, 0);
      const budgeted = Number(b.amount);
      return [{ category: categoryMap.get(b.categoryId) ?? "Unknown", period: b.periodKey ?? null, budgeted, actual, variance: budgeted - actual }];
    });

    res.json({ items });
  })
);

export default router;
