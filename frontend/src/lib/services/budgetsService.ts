// Local-mode budget data access — mirrors backend/src/controllers/budget.controller.ts's
// enrichment formula exactly (actual/remaining/utilizationPct/status), computed
// client-side over IndexedDB transactions instead of Drive-stored ones.
import { getStorageProvider } from "@/lib/storage";
import type { Budget, Category, Transaction } from "@/types";

type BudgetPeriod = "MONTHLY" | "QUARTERLY" | "YEARLY";

function periodToRange(period: BudgetPeriod, periodKey: string): { start: Date; end: Date } {
  if (period === "MONTHLY") {
    const [y, m] = periodKey.split("-").map(Number);
    return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
  }
  if (period === "QUARTERLY") {
    const [y, q] = periodKey.split("-Q").map(Number);
    const startMonth = (q - 1) * 3;
    return { start: new Date(Date.UTC(y, startMonth, 1)), end: new Date(Date.UTC(y, startMonth + 3, 1)) };
  }
  const y = Number(periodKey);
  return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)) };
}

function computeStatus(utilization: number): Budget["status"] {
  if (utilization >= 1) return "OVER_BUDGET";
  if (utilization >= 0.85) return "NEAR_LIMIT";
  return "UNDER_BUDGET";
}

export async function listLocalBudgets(params: { period?: BudgetPeriod; periodKey?: string }): Promise<{ items: Budget[] }> {
  const provider = getStorageProvider();
  const [allBudgets, categories, transactions] = await Promise.all([
    provider.list<Budget & { createdAt: string; updatedAt: string; [k: string]: unknown }>("budgets"),
    provider.list<Category & { createdAt: string; updatedAt: string; [k: string]: unknown }>("categories"),
    provider.list<Transaction & { createdAt: string; updatedAt: string; [k: string]: unknown }>("transactions"),
  ]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  let budgets = allBudgets;
  if (params.period) budgets = budgets.filter((b) => b.period === params.period);
  if (params.periodKey) budgets = budgets.filter((b) => b.periodKey === params.periodKey);
  budgets = [...budgets].sort((a, b) => (categoryById.get(a.categoryId)?.name ?? "").localeCompare(categoryById.get(b.categoryId)?.name ?? ""));

  const items: Budget[] = budgets.map((b) => {
    const { start, end } = periodToRange(b.period, b.periodKey);
    const actual = transactions
      .filter((t) => t.categoryId === b.categoryId && t.type === "EXPENSE" && new Date(t.date) >= start && new Date(t.date) < end)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const budgetAmount = Number(b.amount);
    const remaining = budgetAmount - actual;
    const utilization = budgetAmount > 0 ? actual / budgetAmount : 0;
    const category = categoryById.get(b.categoryId) ?? null;
    return {
      ...b,
      category: category ? { id: category.id, name: category.name, type: category.type, subcategories: category.subcategories } : null,
      amount: budgetAmount,
      actual,
      remaining,
      utilizationPct: utilization,
      variance: actual - budgetAmount,
      status: computeStatus(utilization),
    };
  });

  return { items };
}

export async function createLocalBudget(data: Record<string, unknown>): Promise<Budget> {
  const provider = getStorageProvider();
  const outcome = await provider.create<Budget & { createdAt: string; updatedAt: string; [k: string]: unknown }>("budgets", data as never);
  if (outcome.status !== "success") throw new Error(outcome.message);
  return outcome.data;
}

export async function deleteLocalBudget(id: string): Promise<void> {
  const provider = getStorageProvider();
  const outcome = await provider.remove("budgets", id);
  if (outcome.status !== "success") throw new Error(outcome.message);
}
