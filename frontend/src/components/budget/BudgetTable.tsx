"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Budget } from "@/types";
import { formatCurrency as fmtCurr, formatPercent } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
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
    queryFn: () => api.get<{ items: Budget[] }>(`/api/budgets?period=MONTHLY&periodKey=${periodKey}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/budgets/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });

  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
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
    <div className="overflow-x-auto rounded-xl2 border border-black/5 dark:border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-black/[0.02] text-xs font-semibold uppercase text-navy/50 dark:bg-white/5 dark:text-white/50">
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
            <tr key={b.id} className="border-t border-black/5 dark:border-white/5">
              <td className="px-4 py-3 font-medium text-navy dark:text-white">{b.category.name}</td>
              <td className="px-4 py-3 text-right">{formatINR(b.amount)}</td>
              <td className="px-4 py-3 text-right">{formatINR(b.actual)}</td>
              <td className={`px-4 py-3 text-right ${b.remaining < 0 ? "text-red-600" : "text-navy/70 dark:text-white/70"}`}>
                {formatINR(b.remaining)}
              </td>
              <td className="px-4 py-3">
                <div className="h-2.5 w-32 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500",
                      tier === "safe" && "bg-gradient-to-r from-cyan-400 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
                      tier === "warning" && "bg-gradient-to-r from-amber-400 to-amber-600 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
                      tier === "critical" && "animate-pulse bg-gradient-to-r from-rose-500 to-rose-700 shadow-[0_0_10px_rgba(244,63,94,0.6)]"
                    )}
                    style={{ width: `${Math.min(b.utilizationPct * 100, 100)}%` }}
                  />
                </div>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-navy/40 dark:text-white/40">
                  {formatPercent(b.utilizationPct)}
                  {tier === "critical" && <AlertTriangle className="h-3 w-3 text-rose-500" />}
                </span>
              </td>
              <td className="px-4 py-3">
                <Badge tone={statusTone[b.status]}>{statusLabel[b.status]}</Badge>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => { if (confirm("Delete this budget?")) deleteMutation.mutate(b.id); }}
                  className="rounded p-1.5 text-navy/40 hover:bg-red-50 hover:text-red-600"
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
