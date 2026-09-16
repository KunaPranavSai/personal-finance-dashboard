"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { InvestmentFormSheet } from "@/components/mobile/InvestmentFormSheet";
import { ConfirmSheet } from "@/components/mobile/ConfirmSheet";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Investment } from "@/types";

type Stored<T> = T & { [key: string]: unknown };

const DOT_COLORS = ["var(--ppm-positive)", "var(--ppm-warning)", "var(--ppm-critical)", "var(--ppm-accent)"];

/**
 * Mobile "Invest" tab — full CRUD against the real /api/investments
 * endpoints (or the Local-Only StorageProvider), matching the desktop
 * Investments page's own field set and validation exactly.
 */
export default function MobileInvestmentsPage() {
  const { settings } = useSettingsContext();
  const f = (v: number) => formatCurrency(v, settings.currency);
  const queryClient = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["investments"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getStorageProvider().list<Stored<Investment>>("investments").then((items) => ({ items }))
        : api.get<{ items: Investment[] }>("/api/investments"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (getStorageMode() === "local") {
        const outcome = await getStorageProvider().remove("investments", id);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return;
      }
      await api.delete(`/api/investments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setDeleteTarget(null);
    },
  });

  const items = data?.items ?? [];
  const currentValue = items.reduce((s, i) => s + Number(i.currentValue), 0);
  const investedValue = items.reduce((s, i) => s + Number(i.investedAmount), 0);
  const gainPct = investedValue > 0 ? (currentValue - investedValue) / investedValue : 0;

  return (
    <MobileShell title="Investments">
      <div className="ppm-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Investments</h2>
          <p>Portfolio overview</p>
        </div>
        <button type="button" className="ppm-link-btn" onClick={() => { setEditing(null); setSheetOpen(true); }}>+ Add</button>
      </div>

      {isLoading && (
        <div className="ppm-stack">
          <LoadingCard lines={1} />
          <LoadingCard lines={4} />
        </div>
      )}

      {isError && !isLoading && <ErrorCard onRetry={() => refetch()} />}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyCard icon="↗" title="No investments tracked yet" subtitle="Tap + Add to track a holding." />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <>
          <div className="ppm-card">
            <div className="ppm-section-label">Current Value</div>
            <div className="ppm-figure" style={{ justifyContent: "space-between" }}>
              {f(currentValue)}
              <span className={`ppm-delta${gainPct < 0 ? " down" : ""}`}>{gainPct >= 0 ? "+" : ""}{formatPercent(gainPct)} {gainPct >= 0 ? "↗" : "↘"}</span>
            </div>
          </div>

          <div className="ppm-card" style={{ marginTop: 14 }}>
            <div className="ppm-section-label">Holdings</div>
            {items.map((inv, i) => {
              const gain = Number(inv.currentValue) - Number(inv.investedAmount);
              const gainPctOne = Number(inv.investedAmount) > 0 ? gain / Number(inv.investedAmount) : 0;
              return (
                <div className="ppm-hold-row" key={inv.id} onClick={() => { setEditing(inv); setSheetOpen(true); }} style={{ cursor: "pointer" }}>
                  <div className="ppm-hold-dot" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
                  <div className="ppm-info">
                    <div className="ppm-name">{inv.instrument}</div>
                    <div className="ppm-meta">{inv.category}{inv.platform ? ` · ${inv.platform}` : ""}</div>
                  </div>
                  <div className="ppm-amt">
                    {f(Number(inv.currentValue))}
                    <span className="ppm-hold-ret" style={{ color: gain >= 0 ? "var(--ppm-positive)" : "var(--ppm-critical)" }}>
                      {gain >= 0 ? "+" : ""}{formatPercent(gainPctOne)}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${inv.instrument}`}
                    className="ppm-row-action"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(inv); }}
                  >
                    🗑
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <InvestmentFormSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditing(null); }} editing={editing} />
      <ConfirmSheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete investment"
        message={`Delete "${deleteTarget?.instrument}"? This can't be undone.`}
        isPending={deleteMutation.isPending}
        errorMessage={deleteMutation.isError ? (deleteMutation.error as Error)?.message : null}
      />
    </MobileShell>
  );
}
