import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { ALL_KINDS, invalidateFor, isDerivedKey, keysFor } from "./invalidate";

describe("financial invalidation map", () => {
  it("a transaction change refreshes every view derived from transactions", () => {
    const k = keysFor("transaction");
    for (const key of ["transactions", "dashboard-summary", "income-expense-trend", "category-breakdown", "budgets", "activity-feed", "capital-summary"]) {
      expect(k.has(key), key).toBe(true);
    }
  });

  it("does not invalidate everything: a bill change leaves transactions/trend/breakdown alone", () => {
    const k = keysFor("bill");
    expect(k.has("bills")).toBe(true);
    for (const key of ["transactions", "income-expense-trend", "category-breakdown", "goals", "investments"]) expect(k.has(key), key).toBe(false);
  });

  it("every kind reaches Home, Activity and Capital", () => {
    for (const kind of ALL_KINDS) for (const key of ["dashboard-summary", "activity-feed", "capital-summary"]) expect(keysFor(kind).has(key), `${kind}:${key}`).toBe(true);
  });

  it("recognises derived (expensive) report views", () => {
    expect(isDerivedKey("analytics")).toBe(true);
    expect(isDerivedKey("reports-monthly")).toBe(true);
    expect(isDerivedKey("transactions")).toBe(false);
  });

  it("marks matching queries stale and leaves unrelated ones fresh", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });
    const seed = ["dashboard-summary", "income-expense-trend", "bills", "notifications", "settings"];
    for (const key of seed) qc.setQueryData([key], { ok: true });
    invalidateFor(qc, "transaction");
    const stale = (key: string) => qc.getQueryState([key])!.isInvalidated;
    expect(stale("dashboard-summary")).toBe(true);
    expect(stale("income-expense-trend")).toBe(true);
    expect(stale("bills")).toBe(false);
    expect(stale("notifications")).toBe(false);
    expect(stale("settings")).toBe(false);
  });

  it("derived views are marked stale without an eager refetch", () => {
    const qc = new QueryClient();
    qc.setQueryData(["reports-monthly", 1], []);
    const spy = vi.spyOn(qc, "invalidateQueries");
    invalidateFor(qc, "transaction");
    expect(spy.mock.calls.some(([f]) => f?.refetchType === "none")).toBe(true);
    expect(qc.getQueryState(["reports-monthly", 1])!.isInvalidated).toBe(true);
  });
});
