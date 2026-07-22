"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Budget } from "@/types";
import { formatCurrency as fmtCurr, formatPercent } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Trash2, Wallet } from "lucide-react";

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
          {items.map((b) => (
            <tr key={b.id} className="border-t border-black/5 dark:border-white/5">
              <td className="px-4 py-3 font-medium text-navy dark:text-white">{b.category.name}</td>
              <td className="px-4 py-3 text-right">{formatINR(b.amount)}</td>
              <td className="px-4 py-3 text-right">{formatINR(b.actual)}</td>
              <td className={`px-4 py-3 text-right ${b.remaining < 0 ? "text-red-600" : "text-navy/70 dark:text-white/70"}`}>
                {formatINR(b.remaining)}
              </td>
              <td className="px-4 py-3">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(b.utilizationPct * 100, 100)}%`,
                      backgroundColor: b.status === "OVER_BUDGET" ? "#C0392B" : b.status === "NEAR_LIMIT" ? "#F1C40F" : "#0EA5A5",
                    }}
                  />
                </div>
                <span className="mt-0.5 block text-xs text-navy/40 dark:text-white/40">{formatPercent(b.utilizationPct)}</span>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
