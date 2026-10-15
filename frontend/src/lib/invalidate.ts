import type { QueryClient } from "@tanstack/react-query";

/**
 * One explicit dependency map for "what must refresh after a confirmed financial write".
 * Replaces ~15 hand-rolled invalidation lists that each covered a different subset
 * (e.g. desktop transaction delete left the trend, breakdown, budgets, Activity and Capital stale).
 * Keys are first-element prefixes of the react-query keys. Nothing here is "invalidate everything".
 */
export type FinancialKind = "transaction" | "bill" | "goal" | "investment" | "budget";

/** Every kind appears in the Home summary, the Activity feed and Capital. */
const COMMON = ["dashboard-summary", "activity-feed", "capital-summary"];

const OWN: Record<FinancialKind, string[]> = {
  transaction: ["transactions", "income-expense-trend", "category-breakdown", "budgets", "savings", "smart-history", "kpi-detail-transactions", "hero-recent-transactions"],
  bill: ["bills"],
  goal: ["goals", "savings"],
  investment: ["investments", "hero-investments"],
  budget: ["budgets"],
};

/** Derived, expensive views: marked stale (refetched on next visit), never refetched eagerly. */
const DERIVED_PREFIXES = ["analytics", "reports-", "custom-chart"];

export function keysFor(...kinds: FinancialKind[]): Set<string> {
  return new Set([...COMMON, ...kinds.flatMap((k) => OWN[k])]);
}

export function isDerivedKey(first: unknown): boolean {
  const k = String(first);
  return DERIVED_PREFIXES.some((p) => k.startsWith(p));
}

/**
 * Bumped by every confirmed financial write. In-flight read de-duplication (dashboardService) only shares a request
 * made in the same epoch, so a refetch triggered by a write can never be answered by a read that started before it.
 */
let epoch = 0;
export const financialEpoch = () => epoch;

/** Call after the write is CONFIRMED by storage (onSuccess), never before. */
export function invalidateFor(qc: QueryClient, ...kinds: FinancialKind[]) {
  epoch++;
  const keys = keysFor(...kinds);
  void qc.invalidateQueries({ predicate: (q) => keys.has(String(q.queryKey[0])), refetchType: "all" });
  if (kinds.includes("transaction") || kinds.includes("bill") || kinds.includes("investment") || kinds.includes("goal")) {
    void qc.invalidateQueries({ predicate: (q) => isDerivedKey(q.queryKey[0]), refetchType: "none" });
  }
}

/** Unified surfaces (Activity feed, restore) can't know which type changed. */
export const ALL_KINDS: FinancialKind[] = ["transaction", "bill", "goal", "investment", "budget"];
