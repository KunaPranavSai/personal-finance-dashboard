"use client";

import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { listLocalBudgets } from "@/lib/services/budgetsService";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency } from "@/lib/format";
import type { Budget } from "@/types";

function currentPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<Budget["status"], string> = {
  UNDER_BUDGET: "Under budget",
  NEAR_LIMIT: "Near limit",
  OVER_BUDGET: "Over budget",
};
const STATUS_CLASS: Record<Budget["status"], string> = {
  UNDER_BUDGET: "under",
  NEAR_LIMIT: "near",
  OVER_BUDGET: "over",
};
const STATUS_COLOR: Record<Budget["status"], string> = {
  UNDER_BUDGET: "var(--ppm-positive)",
  NEAR_LIMIT: "var(--ppm-warning)",
  OVER_BUDGET: "var(--ppm-critical)",
};

/**
 * Mobile "Budget" tab. `BudgetStatus` (UNDER_BUDGET/NEAR_LIMIT/OVER_BUDGET) is
 * derived, not stored — the same enrichment the desktop BudgetTable/backend
 * budget.controller.ts already compute — so the status pill here always
 * matches the desktop page for the same period. Creating/editing a budget
 * (BudgetFormModal on desktop) is not yet reproduced here; see the
 * implementation report.
 */
export default function MobileBudgetPage() {
  const { settings } = useSettingsContext();
  const f = (v: number) => formatCurrency(v, settings.currency);
  const periodKey = currentPeriodKey();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["budgets", periodKey],
    queryFn: () =>
      getStorageMode() === "local"
        ? listLocalBudgets({ period: "MONTHLY", periodKey })
        : api.get<{ items: Budget[] }>(`/api/budgets?period=MONTHLY&periodKey=${periodKey}`),
  });

  const items = data?.items ?? [];

  return (
    <MobileShell title="Budgets">
      <div className="ppm-page-title">
        <h2>Budgets</h2>
        <p>{periodKey} · Monthly</p>
      </div>

      {isLoading && <LoadingCard lines={4} />}
      {isError && !isLoading && <ErrorCard onRetry={() => refetch()} />}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyCard icon="◧" title="No budgets set for this month" subtitle="Create a budget from Settings on desktop to see it tracked here." />
      )}

      {!isLoading && !isError && items.map((b) => {
        const pct = Math.min(100, Math.round((b.utilizationPct ?? 0) * 100));
        return (
          <div className="ppm-card ppm-budget-card" key={b.id}>
            <div className="ppm-budget-head">
              <span className="name">{b.category?.name ?? "Uncategorized"}</span>
              <span className={`ppm-status ${STATUS_CLASS[b.status]}`}>{STATUS_LABEL[b.status]}</span>
            </div>
            <div className="ppm-bar-track">
              <div className="ppm-bar-fill" style={{ width: `${pct}%`, background: STATUS_COLOR[b.status] }} />
            </div>
            <div className="ppm-budget-nums">
              <span>{f(b.actual)} spent</span>
              <span>of {f(b.amount)}</span>
            </div>
          </div>
        );
      })}
    </MobileShell>
  );
}
