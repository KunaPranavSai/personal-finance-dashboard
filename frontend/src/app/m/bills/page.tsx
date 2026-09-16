"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { BillFormSheet } from "@/components/mobile/BillFormSheet";
import { ConfirmSheet } from "@/components/mobile/ConfirmSheet";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency, formatDateIN } from "@/lib/format";
import type { Bill } from "@/types";

type BillState = "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "UNPAID";

/** Payment state is derived client-side exactly as the design spec documents
 * (paidAmount vs amount vs dueDate) — Bill has no stored status field. */
function billState(b: Bill): BillState {
  const overdue = new Date(b.dueDate) < new Date(new Date().toDateString()) && b.paidAmount < b.amount;
  if (overdue) return "OVERDUE";
  if (b.paidAmount >= b.amount && b.amount > 0) return "PAID";
  if (b.paidAmount > 0) return "PARTIALLY_PAID";
  return "UNPAID";
}
const STATE_LABEL: Record<BillState, string> = { PAID: "Paid", PARTIALLY_PAID: "Partially paid", OVERDUE: "Overdue", UNPAID: "Unpaid" };
const STATE_CLASS: Record<BillState, string> = { PAID: "under", PARTIALLY_PAID: "near", OVERDUE: "over", UNPAID: "near" };

/**
 * Mobile "Bills & EMIs" screen, reached from More → Financial Modules.
 * Reproduces the desktop bills page's full CRUD, branching on
 * getStorageMode() exactly like the desktop page does — Drive-backed
 * /api/bills in Drive mode, StorageProvider("bills") in Local-Only mode.
 */
type Stored<T> = T & { createdAt: string; updatedAt: string; [k: string]: unknown };
export default function MobileBillsPage() {
  const { settings } = useSettingsContext();
  const f = (v: number) => formatCurrency(v, settings.currency);
  const queryClient = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["bills"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getStorageProvider().list<Stored<Bill>>("bills").then((items) => ({ items }))
        : api.get<{ items: Bill[] }>("/api/bills"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (getStorageMode() === "local") {
        const outcome = await getStorageProvider().remove("bills", id);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return;
      }
      await api.delete(`/api/bills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      setDeleteTarget(null);
    },
  });

  const items = [...(data?.items ?? [])].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <MobileShell title="Bills & EMIs">
      <div className="ppm-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Bills &amp; EMIs</h2>
          <p>{items.length} tracked</p>
        </div>
        <button type="button" className="ppm-link-btn" onClick={() => { setEditing(null); setSheetOpen(true); }}>+ Add</button>
      </div>

      {isLoading && <LoadingCard lines={4} />}
      {isError && !isLoading && <ErrorCard onRetry={() => refetch()} />}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyCard icon="🧾" title="No bills yet" subtitle="Tap + Add to track a bill, EMI, subscription or rent payment." />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="ppm-card">
          {items.map((b) => {
            const state = billState(b);
            return (
              <div className="ppm-list-item" key={b.id} onClick={() => { setEditing(b); setSheetOpen(true); }}>
                <div className="ppm-ic" aria-hidden="true">{b.autoPay ? "🔁" : "🧾"}</div>
                <div className="ppm-info">
                  <div className="ppm-name">{b.name}</div>
                  <div className="ppm-meta">{b.type} · Due {formatDateIN(b.dueDate)}</div>
                </div>
                <div className="ppm-amt">
                  {f(b.amount)}
                  <span className={`ppm-status ${STATE_CLASS[state]}`} style={{ display: "inline-block", marginTop: 3 }}>{STATE_LABEL[state]}</span>
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${b.name}`}
                  className="ppm-chev"
                  style={{ fontSize: "1.1rem", padding: "6px 4px" }}
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(b); }}
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      )}

      <BillFormSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditing(null); }} editing={editing} />
      <ConfirmSheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete bill"
        message={`Delete "${deleteTarget?.name}"? This can't be undone.`}
        isPending={deleteMutation.isPending}
        errorMessage={deleteMutation.isError ? (deleteMutation.error as Error)?.message : null}
      />
    </MobileShell>
  );
}
