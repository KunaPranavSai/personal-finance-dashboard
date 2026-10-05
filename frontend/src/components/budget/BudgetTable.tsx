"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { listLocalBudgets, deleteLocalBudget } from "@/lib/services/budgetsService";
import { Budget } from "@/types";
import { formatCurrency as fmtCurr, formatPercent } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { Badge } from "../ui/PpBadge";
import { EmptyState } from "../ui/EmptyState";
import { usePpToast } from "../ui/PpToast";
import { usePpConfirm } from "../ui/PpConfirm";
import { Trash2, Wallet, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/format";

/** Tiered glow styling for the progress bar fill, per the Midnight Cockpit
 * spec: 0-70% safe (cyan-emerald), 71-90% warning (amber), 91%+ critical
 * (pulsing rose + alert badge) — independent of the backend's own
 * UNDER/NEAR/OVER status enum, since that flips at different thresholds. */
function progressTier(pct: number): "safe" | "warning" | "critical" {
  const p = pct * 100;
  if (p > 90) return "critical";
  if (p > 70) return "warning";
  return "safe";
}

const statusTone: Record<Budget["status"], "green" | "yellow" | "red"> = {
  UNDER_BUDGET: "green",
  NEAR_LIMIT: "yellow",
  OVER_BUDGET: "red",
};

const statusLabel: Record<Budget["status"], string> = {
  UNDER_BUDGET: "Under Budget",
  NEAR_LIMIT: "Near Limit",
  OVER_BUDGET: "Over Budget",
};

export function BudgetTable({ periodKey }: { periodKey: string }) {
  const { settings } = useSettingsContext();
  const cur = settings.currency;
  const formatINR = (v: number) => fmtCurr(v, cur);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["budgets", periodKey],
    queryFn: () =>
      getStorageMode() === "local"
        ? listLocalBudgets({ period: "MONTHLY", periodKey })
        : api.get<{ items: Budget[] }>(`/api/budgets?period=MONTHLY&periodKey=${periodKey}`),
  });

  const ppToast = usePpToast();
  const confirmDialog = usePpConfirm();
  const deleteMutation = useMutation({
    mutationFn: (id: string) => (getStorageMode() === "local" ? deleteLocalBudget(id) : api.delete(`/api/budgets/${id}`)),
    onMutate: () => ({ handle: ppToast.start("Removing budget…") }),
    onSuccess: (_data, _id, context) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"], refetchType: "all" });
      context?.handle.success("Budget deleted");
    },
    onError: (_err, _id, context) => {
      context?.handle.error("Couldn't delete budget — try again");
    },
  });

  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-pp-surface-2" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Create Your First Budget"
        description="Set a monthly spending limit per category to start tracking budget adherence."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl2 border border-pp-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-black/[0.02] text-xs font-semibold uppercase text-pp-text-dim ">
          <tr>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3 text-right">Budget</th>
            <th className="px-4 py-3 text-right">Actual</th>
            <th className="px-4 py-3 text-right">Remaining</th>
            <th className="px-4 py-3">Progress</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((b) => {
            const tier = progressTier(b.utilizationPct);
            return (
            <tr key={b.id} className="border-t border-pp-border dark:border-white/5">
              <td className="px-4 py-3 font-medium text-pp-text">{b.category?.name ?? "Uncategorized"}</td>
              <td className="px-4 py-3 text-right">{formatINR(b.amount)}</td>
              <td className="px-4 py-3 text-right">{formatINR(b.actual)}</td>
              <td className={`px-4 py-3 text-right ${b.remaining < 0 ? "text-vulcanico" : "text-pp-text-dim"}`}>
                {formatINR(b.remaining)}
              </td>
              <td className="px-4 py-3">
                <div className="h-2.5 w-32 overflow-hidden rounded-full bg-pp-surface-2 dark:bg-white/10">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500",
                      tier === "safe" && "bg-gradient-to-r from-tiffany to-mantis shadow-[0_0_8px_rgba(89,199,73,0.5)]",
                      tier === "warning" && "bg-gradient-to-r from-turmeric to-turmeric shadow-[0_0_8px_rgba(245,158,11,0.5)]",
                      tier === "critical" && "animate-pulse bg-gradient-to-r from-vulcanico to-vulcanico shadow-[0_0_10px_rgba(244,63,94,0.6)]"
                    )}
                    style={{ width: `${Math.min(b.utilizationPct * 100, 100)}%` }}
                  />
                </div>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-pp-text-dim">
                  {formatPercent(b.utilizationPct)}
                  {tier === "critical" && <AlertTriangle className="h-3 w-3 text-vulcanico" />}
                </span>
              </td>
              <td className="px-4 py-3">
                <Badge tone={statusTone[b.status]}>{statusLabel[b.status]}</Badge>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={async () => { if (await confirmDialog({ message: "Delete this budget?" })) deleteMutation.mutate(b.id); }}
                  className="rounded p-1.5 text-pp-text-dim hover:bg-vulcanico/10 hover:text-vulcanico"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
