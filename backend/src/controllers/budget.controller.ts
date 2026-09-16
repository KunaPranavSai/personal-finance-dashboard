import { Request, Response } from "express";
import { safeBody, safeParam, safeQuery } from "../utils/safeRequest";
import { createBudgetSchema, listBudgetsQuerySchema, updateBudgetSchema } from "../schemas/budget.schema";
import { listRecords, createRecord, updateRecord, deleteRecord, getRecord } from "../services/drive/dataService";
import { DriveRecord } from "../services/drive/types";

interface BudgetRecord extends DriveRecord {
  categoryId: string;
  period: "MONTHLY" | "QUARTERLY" | "YEARLY";
  periodKey: string;
  amount: number;
}
interface CategoryRecord extends DriveRecord {
  name: string;
  type: "INCOME" | "EXPENSE";
}
interface TransactionRecord extends DriveRecord {
  date: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  categoryId: string;
}

// Convert a periodKey + period into a date range for matching actual expenses.
function periodToRange(period: "MONTHLY" | "QUARTERLY" | "YEARLY", periodKey: string) {
  if (period === "MONTHLY") {
    const [y, m] = periodKey.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    return { start, end };
  }
  if (period === "QUARTERLY") {
    const [y, q] = periodKey.split("-Q").map(Number);
    const startMonth = (q - 1) * 3;
    const start = new Date(Date.UTC(y, startMonth, 1));
    const end = new Date(Date.UTC(y, startMonth + 3, 1));
    return { start, end };
  }
  const y = Number(periodKey);
  return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)) };
}

function computeStatus(utilization: number): "UNDER_BUDGET" | "NEAR_LIMIT" | "OVER_BUDGET" {
  if (utilization >= 1) return "OVER_BUDGET";
  if (utilization >= 0.85) return "NEAR_LIMIT";
  return "UNDER_BUDGET";
}

export async function listBudgets(req: Request, res: Response) {
  const query = safeQuery(listBudgetsQuerySchema, req);
  const userId = req.auth!.userId;

  const [allBudgets, categories, transactions] = await Promise.all([
    listRecords<BudgetRecord>(userId, "budgets"),
    listRecords<CategoryRecord>(userId, "categories"),
    listRecords<TransactionRecord>(userId, "transactions"),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  let budgets = allBudgets;
  if (query.period) budgets = budgets.filter((b) => b.period === query.period);
  if (query.periodKey) budgets = budgets.filter((b) => b.periodKey === query.periodKey);
  budgets = [...budgets].sort((a, b) => (categoryMap.get(a.categoryId)?.name ?? "").localeCompare(categoryMap.get(b.categoryId)?.name ?? ""));

  const enriched = budgets.map((b) => {
    const { start, end } = periodToRange(b.period, b.periodKey);
    const actual = transactions
      .filter((t) => t.categoryId === b.categoryId && t.type === "EXPENSE" && new Date(t.date) >= start && new Date(t.date) < end)
      .reduce((sum, t) => sum + t.amount, 0);
    const budgetAmount = Number(b.amount);
    const remaining = budgetAmount - actual;
    const utilization = budgetAmount > 0 ? actual / budgetAmount : 0;
    const category = categoryMap.get(b.categoryId) ?? null;
    return {
      ...b,
      category: category ? { id: category.id, name: category.name, type: category.type } : null,
      amount: budgetAmount,
      actual,
      remaining,
      utilizationPct: utilization,
      variance: actual - budgetAmount,
      status: computeStatus(utilization),
    };
  });

  res.json({ items: enriched });
}

export async function createBudget(req: Request, res: Response) {
  const data = safeBody(createBudgetSchema, req);
  const userId = req.auth!.userId;
  const idempotencyKey = req.headers["idempotency-key"];
  const budget = await createRecord<BudgetRecord>(userId, "budgets", data, {
    idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
  });
  const category = await getRecord<CategoryRecord>(userId, "categories", data.categoryId);
  res.status(201).json({ ...budget, category: category ? { id: category.id, name: category.name, type: category.type } : null });
}

export async function updateBudget(req: Request, res: Response) {
  const id = safeParam(req, "id");
  const data = safeBody(updateBudgetSchema, req);
  const userId = req.auth!.userId;
  const existing = await getRecord<BudgetRecord>(userId, "budgets", id);
  if (!existing) { res.status(404).json({ error: "Budget not found" }); return; }
  const budget = await updateRecord<BudgetRecord>(userId, "budgets", id, data);
  const category = await getRecord<CategoryRecord>(userId, "categories", budget.categoryId);
  res.json({ ...budget, category: category ? { id: category.id, name: category.name, type: category.type } : null });
}

export async function deleteBudget(req: Request, res: Response) {
  const id = safeParam(req, "id");
  const deleted = await deleteRecord(req.auth!.userId, "budgets", id);
  if (!deleted) { res.status(404).json({ error: "Budget not found" }); return; }
  res.status(204).send();
}
