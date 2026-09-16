"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { GoalFormSheet } from "@/components/mobile/GoalFormSheet";
import { ConfirmSheet } from "@/components/mobile/ConfirmSheet";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Goal } from "@/types";

type Stored<T> = T & { createdAt: string; updatedAt: string; [k: string]: unknown };

/** Mobile "Goals" screen — full CRUD against /api/goals or the Local-Only
 * StorageProvider, branching exactly like the desktop goals page. Progress
 * (currentAmount / targetAmount) is computed client-side, same as desktop. */
export default function MobileGoalsPage() {
  const { settings } = useSettingsContext();
  const f = (v: number) => formatCurrency(v, settings.currency);
  const queryClient = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["goals"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getStorageProvider().list<Stored<Goal>>("goals").then((items) => ({ items }))
        : api.get<{ items: Goal[] }>("/api/goals"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (getStorageMode() === "local") {
        const outcome = await getStorageProvider().remove("goals", id);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return;
      }
      await api.delete(`/api/goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setDeleteTarget(null);
    },
  });

  const items = data?.items ?? [];

  return (
    <MobileShell title="Goals">
      <div className="ppm-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Goals</h2>
          <p>{items.length} active</p>
        </div>
        <button type="button" className="ppm-link-btn" onClick={() => { setEditing(null); setSheetOpen(true); }}>+ Add</button>
      </div>

      {isLoading && <LoadingCard lines={4} />}
      {isError && !isLoading && <ErrorCard onRetry={() => refetch()} />}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyCard icon="🎯" title="No goals yet" subtitle="Tap + Add to start a savings goal." />
      )}

      {!isLoading && !isError && items.map((g) => {
        const pct = g.targetAmount > 0 ? Math.min(1, g.currentAmount / g.targetAmount) : 0;
        return (
          <div className="ppm-card ppm-budget-card" key={g.id}>
            <div className="ppm-budget-head">
              <span className="name">🎯 {g.name}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="ppm-link-btn" onClick={() => { setEditing(g); setSheetOpen(true); }}>Edit</button>
                <button type="button" className="ppm-link-btn" style={{ color: "var(--ppm-critical)" }} onClick={() => setDeleteTarget(g)}>Delete</button>
              </div>
            </div>
            <div className="ppm-bar-track">
              <div className="ppm-bar-fill" style={{ width: `${pct * 100}%`, background: "var(--ppm-accent)" }} />
            </div>
            <div className="ppm-budget-nums">
              <span>{formatPercent(pct)} complete</span>
              <span>{f(g.currentAmount)} of {f(g.targetAmount)}</span>
            </div>
            {g.monthlyContribution > 0 && (
              <div className="ppm-meta" style={{ marginTop: 6 }}>Contributing {f(g.monthlyContribution)}/month · {g.category}</div>
            )}
          </div>
        );
      })}

      <GoalFormSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditing(null); }} editing={editing} />
      <ConfirmSheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete goal"
        message={`Delete "${deleteTarget?.name}"? This can't be undone.`}
        isPending={deleteMutation.isPending}
        errorMessage={deleteMutation.isError ? (deleteMutation.error as Error)?.message : null}
      />
    </MobileShell>
  );
}
