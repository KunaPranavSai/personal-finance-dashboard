import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const { listCalls, apiGet, data } = vi.hoisted(() => ({ listCalls: [] as string[], apiGet: vi.fn(), data: {} as Record<string, unknown[]> }));
vi.mock("@/lib/storage", () => ({ getStorageProvider: () => ({ list: async (c: string) => (listCalls.push(c), data[c] ?? []) }), getStorageMode: () => "local" }));
vi.mock("@/lib/api", () => {
  class ApiClientError extends Error {
    constructor(public status: number, m = "") {
      super(m);
    }
  }
  return { api: { get: apiGet }, ApiClientError };
});

import { fetchDashboardHome, getLocalCategoryBreakdown, getLocalDashboardSummary, getLocalIncomeExpenseTrend } from "./dashboardService";
import { invalidateFor } from "@/lib/invalidate";
import { ApiClientError } from "@/lib/api";

beforeEach(() => {
  listCalls.length = 0;
  apiGet.mockReset();
  Object.assign(data, {
    transactions: [
      { id: "t1", type: "INCOME", amount: 1000, date: "2026-10-01", categoryId: "pay" },
      { id: "t2", type: "EXPENSE", amount: 250, date: "2026-10-02", categoryId: "food" },
    ],
    categories: [{ id: "food", name: "Food" }, { id: "pay", name: "Pay" }],
  });
});

describe("device-only Home reads", () => {
  it("MEASURED: Home's three local reads share one pass over the six collections (was 9 reads, now 6)", async () => {
    await Promise.all([getLocalDashboardSummary(), getLocalIncomeExpenseTrend(), getLocalCategoryBreakdown()]);
    console.log(`[measure] device-only home load: IndexedDB collection reads = ${listCalls.length} (was 9)`);
    expect(listCalls.length).toBe(6);
  });

  it("a confirmed write starts a fresh read: a pre-write read is never reused", async () => {
    const first = getLocalDashboardSummary();
    invalidateFor(new QueryClient(), "transaction"); // a write was confirmed while `first` is still reading
    const second = getLocalIncomeExpenseTrend();
    await Promise.all([first, second]);
    expect(listCalls.length).toBe(6 + 6);
  });

  it("figures match the trusted formulas", async () => {
    const s = await getLocalDashboardSummary();
    expect(s.kpis).toMatchObject({ totalIncome: 1000, totalExpenses: 250, totalSavings: 750 });
    expect((await getLocalCategoryBreakdown()).items).toEqual([{ category: "Food", total: 250 }]);
  });
});

describe("Drive-mode Home request (fetchDashboardHome)", () => {
  const payload = { summary: { kpis: {} }, trend: { items: [] }, breakdown: { items: [] } };

  it("MEASURED: three concurrent Home queries make ONE HTTP request (was 3)", async () => {
    apiGet.mockResolvedValue(payload);
    const [a, b, c] = await Promise.all([fetchDashboardHome(), fetchDashboardHome(), fetchDashboardHome()]);
    console.log(`[measure] Drive home load: HTTP requests = ${apiGet.mock.calls.length} (was 3)`);
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet).toHaveBeenCalledWith("/api/dashboard/home");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("after a confirmed write the next read is a new request, not the in-flight old one", async () => {
    let release!: (v: unknown) => void;
    apiGet.mockReturnValueOnce(new Promise((r) => (release = r))).mockResolvedValueOnce({ ...payload, fresh: true });
    const stale = fetchDashboardHome();
    invalidateFor(new QueryClient(), "transaction");
    const fresh = await fetchDashboardHome();
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(fresh).toMatchObject({ fresh: true });
    release(payload);
    await stale;
  });

  it("falls back to the three classic endpoints when the server predates /home (frontend deployed first)", async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path === "/api/dashboard/home") throw new ApiClientError(404, "nf");
      return { path };
    });
    await new Promise((r) => setTimeout(r, 0));
    const home = await fetchDashboardHome();
    expect(home).toEqual({ summary: { path: "/api/dashboard/summary" }, trend: { path: "/api/dashboard/trend/income-expense" }, breakdown: { path: "/api/dashboard/breakdown/category" } });
  });

  it("a real failure is surfaced (so the section shows an error + retry), and a retry makes a new request", async () => {
    apiGet.mockRejectedValueOnce(new ApiClientError(500, "boom")).mockResolvedValueOnce(payload);
    await expect(fetchDashboardHome()).rejects.toMatchObject({ status: 500 });
    await expect(fetchDashboardHome()).resolves.toEqual(payload);
    expect(apiGet).toHaveBeenCalledTimes(2);
  });
});
