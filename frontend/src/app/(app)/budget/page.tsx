"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { BudgetTable } from "@/components/budget/BudgetTable";
import { BudgetFormModal } from "@/components/budget/BudgetFormModal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Plus } from "lucide-react";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { BudgetFormSheet } from "@/components/mobile/BudgetFormSheet";
import { ConfirmSheet } from "@/components/mobile/ConfirmSheet";
import { useIsMobile } from "@/lib/DeviceContext";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { listLocalBudgets, deleteLocalBudget } from "@/lib/services/budgetsService";
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

export default function BudgetPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const periodKey = currentPeriodKey();
  const isMobile = useIsMobile();
  const { settings } = useSettingsContext();
  const f = (v: number) => formatCurrency(v, settings.currency);
  const queryClient = useQueryClient();

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["budgets", periodKey],
    queryFn: () =>
      getStorageMode() === "local"
        ? listLocalBudgets({ period: "MONTHLY", periodKey })
        : api.get<{ items: Budget[] }>(`/api/budgets?period=MONTHLY&periodKey=${periodKey}`),
    enabled: isMobile,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => (getStorageMode() === "local" ? deleteLocalBudget(id) : api.delete(`/api/budgets/${id}`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setDeleteTarget(null);
    },
  });

  if (isMobile) {
    const items = data?.items ?? [];
    return (
      <MobileShell title="Budgets">
        <div className="ppm-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>Budgets</h2>
            <p>{periodKey} · Monthly</p>
          </div>
          <button type="button" className="ppm-link-btn" onClick={() => setMobileSheetOpen(true)}>+ Add</button>
        </div>

        {isLoading && <LoadingCard lines={4} />}
        {isError && !isLoading && <ErrorCard onRetry={() => refetch()} />}
        {!isLoading && !isError && items.length === 0 && (
          <EmptyCard icon="◧" title="No budgets set for this month" subtitle="Tap + Add to set a budget for a category." />
        )}

        {!isLoading && !isError && items.map((b) => {
          const pct = Math.min(100, Math.round((b.utilizationPct ?? 0) * 100));
          return (
            <div className="ppm-card ppm-budget-card" key={b.id}>
              <div className="ppm-budget-head">
                <span className="name">{b.category?.name ?? "Uncategorized"}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`ppm-status ${STATUS_CLASS[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                  <button type="button" className="ppm-row-action" aria-label={`Delete ${b.category?.name ?? "budget"}`} onClick={() => setDeleteTarget(b)}>🗑</button>
                </div>
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

        <BudgetFormSheet open={mobileSheetOpen} onClose={() => setMobileSheetOpen(false)} periodKey={periodKey} />
        <ConfirmSheet
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          title="Delete budget"
          message={`Delete the budget for "${deleteTarget?.category?.name ?? "this category"}"?`}
          isPending={deleteMutation.isPending}
          errorMessage={deleteMutation.isError ? (deleteMutation.error as Error)?.message : null}
        />
      </MobileShell>
    );
  }

  return (
    <>
      <Topbar title="Budget Planner" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-navy/50 dark:text-white/50">
            Monthly budgets for {periodKey}. Actuals are calculated live from your transactions.
          </p>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Set Budget
          </Button>
        </div>

        <Card>
          <CardContent className="pt-5">
            <BudgetTable periodKey={periodKey} />
          </CardContent>
        </Card>
      </main>

      <BudgetFormModal open={modalOpen} onClose={() => setModalOpen(false)} periodKey={periodKey} />
    </>
  );
}
