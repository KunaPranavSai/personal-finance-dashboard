import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { safeBody, safeParam, safeQuery } from "../utils/safeRequest";
import { createBudgetSchema, listBudgetsQuerySchema, updateBudgetSchema } from "../schemas/budget.schema";

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

  const budgets = await prisma.budget.findMany({
    where: { ...(query.period && { period: query.period }), ...(query.periodKey && { periodKey: query.periodKey }) },
    include: { category: true },
    orderBy: { category: { name: "asc" } },
  });

  const enriched = await Promise.all(
    budgets.map(async (b: Prisma.BudgetGetPayload<{ include: { category: true } }>) => {
      const { start, end } = periodToRange(b.period, b.periodKey);
      const agg = await prisma.transaction.aggregate({
        where: { categoryId: b.categoryId, type: "EXPENSE", date: { gte: start, lt: end } },
        _sum: { amount: true },
      });
      const actual = Number(agg._sum.amount ?? 0);
      const budgetAmount = Number(b.amount);
      const remaining = budgetAmount - actual;
      const utilization = budgetAmount > 0 ? actual / budgetAmount : 0;
      return {
        ...b,
        amount: budgetAmount,
        actual,
        remaining,
        utilizationPct: utilization,
        variance: actual - budgetAmount,
        status: computeStatus(utilization),
      };
    })
  );

  res.json({ items: enriched });
}

export async function createBudget(req: Request, res: Response) {
  const data = safeBody(createBudgetSchema, req);
  const budget = await prisma.budget.create({
    data: { categoryId: data.categoryId, period: data.period, periodKey: data.periodKey, amount: data.amount },
    include: { category: true },
  });
  res.status(201).json(budget);
}

export async function updateBudget(req: Request, res: Response) {
  const id = safeParam(req, "id");
  const data = safeBody(updateBudgetSchema, req);
  const budget = await prisma.budget.update({
    where: { id },
    data,
    include: { category: true },
  });
  res.json(budget);
}

export async function deleteBudget(req: Request, res: Response) {
  const id = safeParam(req, "id");
  await prisma.budget.delete({ where: { id } });
  res.status(204).send();
}
