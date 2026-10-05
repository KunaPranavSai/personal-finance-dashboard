"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Receipt, PieChart, TrendingUp, Target, PiggyBank, SlidersHorizontal, Trash2, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { deleteLocalTransaction } from "@/lib/services/transactionsService";
import { buildLedger, queryLedger, LEDGER_TYPES, type LedgerItem, type LedgerType } from "@/lib/ledger";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency } from "@/lib/format";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import { ConfirmSheet } from "@/components/mobile/ConfirmSheet";
import { AddTransactionSheet } from "@/components/mobile/AddTransactionSheet";
import { BillFormSheet } from "@/components/mobile/BillFormSheet";
import { GoalFormSheet } from "@/components/mobile/GoalFormSheet";
import { InvestmentFormSheet } from "@/components/mobile/InvestmentFormSheet";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import type { Transaction, Bill, Goal, Investment } from "@/types";

const PAGE = 20;
const TYPE_META: Record<LedgerType, { label: string; icon: LucideIcon }> = {
  income: { label: "Income", icon: ArrowDownLeft },
  expense: { label: "Expense", icon: ArrowUpRight },
  bill: { label: "Bills & EMI", icon: Receipt },
  budget: { label: "Monthly Budget", icon: PieChart },
  investment: { label: "Investments", icon: TrendingUp },
  goal: { label: "Goals", icon: Target },
  saving: { label: "Savings", icon: PiggyBank },
};
// Collection + REST path per ledger type (used by delete). "saving" has no stored records yet.
const SOURCE: Record<LedgerType, { collection: "transactions" | "bills" | "budgets" | "investments" | "goals" | null; path: string }> = {
  income: { collection: "transactions", path: "transactions" },
  expense: { collection: "transactions", path: "transactions" },
  bill: { collection: "bills", path: "bills" },
  budget: { collection: "budgets", path: "budgets" },
  investment: { collection: "investments", path: "investments" },
  goal: { collection: "goals", path: "goals" },
  saving: { collection: null, path: "" },
};

interface Filters { types: LedgerType[]; from: string; to: string; min: string; max: string }
const EMPTY: Filters = { types: [], from: "", to: "", min: "", max: "" };

async function fetchPage(filters: Filters, cursor: string | null) {
  const query = {
    types: filters.types,
    from: filters.from || undefined,
    to: filters.to || undefined,
    min: filters.min ? Number(filters.min) : undefined,
    max: filters.max ? Number(filters.max) : undefined,
    limit: PAGE,
    cursor,
  };
  if (getStorageMode() === "local") {
    const p = getStorageProvider();
    const [transactions, bills, budgets, investments, goals, categories] = await Promise.all(
      (["transactions", "bills", "budgets", "investments", "goals", "categories"] as const).map((c) => p.list(c))
    );
    return queryLedger(buildLedger({ transactions, bills, budgets, investments, goals, categories }), query);
  }
  const qs = new URLSearchParams({ limit: String(PAGE) });
  if (filters.types.length) qs.set("types", filters.types.join(","));
  if (filters.from) qs.set("from", filters.from);
  if (filters.to) qs.set("to", filters.to);
  if (filters.min) qs.set("min", filters.min);
  if (filters.max) qs.set("max", filters.max);
  if (cursor) qs.set("cursor", cursor);
  return api.get<{ items: LedgerItem[]; nextCursor: string | null }>(`/api/activity/feed?${qs}`);
}

const dayKey = (iso: string) => iso.slice(0, 10);
const dayLabel = (iso: string) => new Date(`${dayKey(iso)}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

/** Unified chronological ledger: 20 at a time, "Load more" appends, filters on the right, scrollable type rail. */
export function ActivityFeed() {
  const router = useRouter();
  const qc = useQueryClient();
  const { settings } = useSettingsContext();
  const money = (v: number) => formatCurrency(v, settings.currency);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<LedgerItem | null>(null);
  const [deleting, setDeleting] = useState<LedgerItem | null>(null);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["activity-feed", filters],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchPage(filters, pageParam),
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const groups = useMemo(() => {
    const out: { day: string; rows: LedgerItem[] }[] = [];
    for (const it of items) {
      const d = dayKey(it.occurredAt);
      if (out[out.length - 1]?.day === d) out[out.length - 1].rows.push(it);
      else out.push({ day: d, rows: [it] });
    }
    return out;
  }, [items]);

  const del = useMutation({
    mutationFn: async (it: LedgerItem) => {
      const src = SOURCE[it.type];
      if (!src.collection) return;
      if (getStorageMode() === "local") {
        if (src.collection === "transactions") return deleteLocalTransaction(it.sourceId);
        const r = await getStorageProvider().remove(src.collection, it.sourceId);
        if (r.status !== "success") throw new Error(r.message);
        return;
      }
      await api.delete(`/api/${src.path}/${it.sourceId}`);
    },
    onSuccess: () => {
      for (const k of ["activity-feed", "transactions", "bills", "budgets", "investments", "goals", "dashboard-summary"]) qc.invalidateQueries({ queryKey: [k] });
      setDeleting(null);
    },
  });

  const activeCount = (filters.from ? 1 : 0) + (filters.to ? 1 : 0) + (filters.min ? 1 : 0) + (filters.max ? 1 : 0) + (filters.types.length > 1 ? 1 : 0);
  const railType = filters.types.length === 1 ? filters.types[0] : null;
  const isAll = filters.types.length === 0;
  const open = (it: LedgerItem) => {
    if (it.type === "budget") router.push("/budget");
    else if (it.type !== "saving") setEditing(it);
  };
  const closeEdit = () => { setEditing(null); qc.invalidateQueries({ queryKey: ["activity-feed"] }); };
  const kind = editing?.type;

  return (
    <>
      <div className="ppm-head-row">
        <h2>Activity</h2>
        <button type="button" className={`ppm-chip${activeCount ? " on" : ""}`} onClick={() => { setDraft(filters); setSheet(true); }} aria-label="Filters">
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span className="ppm-filter-label">Filters{activeCount ? ` (${activeCount})` : ""}</span>
        </button>
      </div>

      <div className="ppm-filters" role="tablist" aria-label="Activity type">
        <button type="button" role="tab" aria-selected={isAll} className={`ppm-chip${isAll ? " on" : ""}`} onClick={() => setFilters({ ...filters, types: [] })}>All</button>
        {LEDGER_TYPES.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={railType === t} className={`ppm-chip${railType === t ? " on" : ""}`} onClick={() => setFilters({ ...filters, types: [t] })}>
            {TYPE_META[t].label}
          </button>
        ))}
      </div>

      {isLoading && <LoadingCard lines={5} />}
      {isError && !isLoading && <ErrorCard onRetry={() => refetch()} />}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyCard icon={<Receipt size={22} />} title="No activity found" subtitle={!isAll || activeCount ? "Try a different filter." : "Add an income or expense to get started."} />
      )}

      {groups.map((g) => (
        <section key={g.day} aria-label={dayLabel(g.rows[0].occurredAt)}>
          <div className="ppm-section-label ppm-day">{dayLabel(g.rows[0].occurredAt)}</div>
          <div className="ppm-card">
            {g.rows.map((it) => {
              const Icon = TYPE_META[it.type].icon;
              const sign = it.type === "income" ? "+" : it.type === "expense" ? "-" : "";
              return (
                <div className="ppm-txn-row" key={it.id} role="button" tabIndex={0} onClick={() => open(it)} onKeyDown={(e) => e.key === "Enter" && open(it)}>
                  <div className="ppm-ic" aria-hidden="true"><Icon size={18} /></div>
                  <div className="ppm-info">
                    <div className="ppm-name">{it.title}</div>
                    <div className="ppm-meta">{TYPE_META[it.type].label} · {timeLabel(it.occurredAt)}</div>
                  </div>
                  <div className={`ppm-amt ${it.type === "income" ? "pos" : it.type === "expense" ? "neg" : ""}`}>{sign}{money(it.amount)}</div>
                  {SOURCE[it.type].collection && (
                    <button type="button" aria-label={`Delete ${it.title}`} className="ppm-row-action" onClick={(e) => { e.stopPropagation(); setDeleting(it); }}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {hasNextPage && (
        <button type="button" className="ppm-load-more" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}

      <MobileSheet open={sheet} onClose={() => setSheet(false)} title="Filter Activity">
        <div className="ppm-field">
          <label>Activity type</label>
          <div className="ppm-checks">
            {LEDGER_TYPES.map((t) => (
              <label key={t} className="ppm-check">
                <input
                  type="checkbox"
                  checked={draft.types.includes(t)}
                  onChange={(e) => setDraft({ ...draft, types: e.target.checked ? [...draft.types, t] : draft.types.filter((x) => x !== t) })}
                />
                {TYPE_META[t].label}
              </label>
            ))}
          </div>
        </div>
        <div className="ppm-field-row">
          <div className="ppm-field"><label htmlFor="act-from">From</label><input id="act-from" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></div>
          <div className="ppm-field"><label htmlFor="act-to">To</label><input id="act-to" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></div>
        </div>
        <div className="ppm-field-row">
          <div className="ppm-field"><label htmlFor="act-min">Minimum</label><input id="act-min" inputMode="decimal" placeholder="Min amount" value={draft.min} onChange={(e) => setDraft({ ...draft, min: e.target.value.replace(/[^0-9.]/g, "") })} /></div>
          <div className="ppm-field"><label htmlFor="act-max">Maximum</label><input id="act-max" inputMode="decimal" placeholder="Max amount" value={draft.max} onChange={(e) => setDraft({ ...draft, max: e.target.value.replace(/[^0-9.]/g, "") })} /></div>
        </div>
        <div className="ppm-sheet-actions">
          <button type="button" className="ppm-sheet-submit" onClick={() => { setFilters(draft); setSheet(false); }}>Apply Filters</button>
          <button type="button" className="ppm-sheet-cancel" onClick={() => { setDraft(EMPTY); setFilters(EMPTY); setSheet(false); }}>Reset</button>
        </div>
      </MobileSheet>

      <AddTransactionSheet open={kind === "income" || kind === "expense"} onClose={closeEdit} editing={kind === "income" || kind === "expense" ? (editing!.record as unknown as Transaction) : null} />
      <BillFormSheet open={kind === "bill"} onClose={closeEdit} editing={kind === "bill" ? (editing!.record as unknown as Bill) : null} />
      <GoalFormSheet open={kind === "goal"} onClose={closeEdit} editing={kind === "goal" ? (editing!.record as unknown as Goal) : null} />
      <InvestmentFormSheet open={kind === "investment"} onClose={closeEdit} editing={kind === "investment" ? (editing!.record as unknown as Investment) : null} />
      <ConfirmSheet
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting)}
        title="Delete record"
        message={`Delete "${deleting?.title}"? This cannot be undone.`}
        isPending={del.isPending}
        errorMessage={del.isError ? (del.error as Error)?.message : null}
      />
    </>
  );
}
