import { beforeEach, describe, expect, it, vi } from "vitest";

const { reads, data } = vi.hoisted(() => ({
  reads: { calls: [] as string[] },
  data: {} as Record<string, Record<string, unknown>[]>,
}));
vi.mock("../services/drive/dataService", () => ({
  listRecords: async (_user: string, collection: string) => {
    reads.calls.push(collection);
    return data[collection] ?? [];
  },
}));

import { getCategoryBreakdown, getDashboardHome, getDashboardSummary, getIncomeExpenseTrend } from "./dashboard.controller";

const call = async (handler: (req: never, res: never) => Promise<void>, userId = "u1") => {
  let body: unknown;
  await handler({ auth: { userId } } as never, { json: (b: unknown) => (body = b) } as never);
  return JSON.parse(JSON.stringify(body)); // what the client would parse
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T08:00:00Z"));
  reads.calls.length = 0;
  Object.assign(data, {
    categories: [{ id: "food", name: "Food" }, { id: "rent", name: "Rent" }, { id: "pay", name: "Salary" }],
    transactions: [
      { id: "t1", type: "INCOME", amount: 80000, date: "2026-10-01", categoryId: "pay" },
      { id: "t2", type: "EXPENSE", amount: 25000, date: "2026-10-02", categoryId: "rent" },
      { id: "t3", type: "EXPENSE", amount: 4200, date: "2026-10-10", categoryId: "food" },
      { id: "t4", type: "INCOME", amount: 78000, date: "2026-09-01", categoryId: "pay" },
      { id: "t5", type: "EXPENSE", amount: 9100, date: "2026-09-20", categoryId: "food" },
    ],
    budgets: [{ id: "b1", categoryId: "food", amount: 10000 }],
    investments: [{ id: "i1", currentValue: 52000, monthlyContribution: 5000 }],
    bills: [{ id: "bl1", dueDate: "2026-10-20", amount: 1200 }, { id: "bl2", dueDate: "2026-09-01", amount: 900 }],
    goals: [{ id: "g1", name: "Emergency fund", currentAmount: 30000, targetAmount: 60000 }],
  });
});

describe("dashboard aggregation", () => {
  it("/home returns exactly what the three separate endpoints return (no second implementation of the maths)", async () => {
    const home = await call(getDashboardHome);
    expect(home.summary).toEqual(await call(getDashboardSummary));
    expect(home.trend).toEqual(await call(getIncomeExpenseTrend));
    expect(home.breakdown).toEqual(await call(getCategoryBreakdown));
  });

  it("known figures are unchanged by the refactor", async () => {
    const { summary, trend, breakdown } = await call(getDashboardHome);
    expect(summary.kpis).toMatchObject({
      totalIncome: 158000,
      totalExpenses: 38300,
      totalSavings: 119700,
      netWorth: 171700,
      emergencyFundProgressPct: 0.5,
      highestSpendingCategory: "Rent",
      transactionCount: 5,
      currentMonth: { income: 80000, expense: 29200 },
    });
    expect(summary.upcomingBills.map((b: { id: string }) => b.id)).toEqual(["bl1"]);
    expect(trend.items.filter((i: { month: string }) => i.month === "2026-10")).toEqual([
      { month: "2026-10", type: "INCOME", total: "80000" },
      { month: "2026-10", type: "EXPENSE", total: "29200" },
    ]);
    expect(breakdown.items).toEqual([{ category: "Rent", total: 25000 }, { category: "Food", total: 13300 }]);
  });

  it("MEASURED: collection reads per Home load, before vs after", async () => {
    await call(getDashboardSummary);
    await call(getIncomeExpenseTrend);
    await call(getCategoryBreakdown);
    const before = reads.calls.length; // three requests: 6 + 1 + 2 collection reads
    reads.calls.length = 0;
    await call(getDashboardHome);
    const after = reads.calls.length; // one request: each collection read once
    console.log(`[measure] home load: before = 3 requests / ${before} collection reads; after = 1 request / ${after} collection reads`);
    expect(before).toBe(9);
    expect(after).toBe(6);
    expect(new Set(reads.calls).size).toBe(6); // none read twice
  });

  it("an empty workspace yields zeros and empty lists, not errors", async () => {
    for (const k of Object.keys(data)) data[k] = [];
    const { summary, trend, breakdown } = await call(getDashboardHome);
    expect(summary.kpis).toMatchObject({ totalIncome: 0, totalExpenses: 0, netWorth: 0, transactionCount: 0 });
    expect(trend.items).toEqual([]);
    expect(breakdown.items).toEqual([]);
  });

  it("reads are scoped to the requesting user id", async () => {
    const seen: string[] = [];
    const mod = await import("../services/drive/dataService");
    const spy = vi.spyOn(mod, "listRecords").mockImplementation(async (u: string) => {
      seen.push(u);
      return [];
    });
    await call(getDashboardHome, "only-me");
    expect(new Set(seen)).toEqual(new Set(["only-me"]));
    spy.mockRestore();
  });
});
