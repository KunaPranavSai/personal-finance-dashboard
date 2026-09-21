"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { AddTransactionSheet } from "@/components/mobile/AddTransactionSheet";
import { ConfirmSheet } from "@/components/mobile/ConfirmSheet";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { listLocalTransactions, deleteLocalTransaction } from "@/lib/services/transactionsService";
import { useCategories, useAccounts, usePaymentMethods } from "@/lib/reference";
import { useSettingsContext } from "@/lib/SettingsContext";
import { Receipt, Wallet, SlidersHorizontal, Trash2 } from "lucide-react";
import { formatCurrency, formatDateIN } from "@/lib/format";
import type { Transaction, PaginatedResponse, EntryType } from "@/types";

type SortBy = "date" | "amount" | "description";
type SortDir = "asc" | "desc";
interface AdvancedFilters {
  categoryId: string;
  accountId: string;
  paymentMethodTypeId: string;
  dateFrom: string;
  dateTo: string;
  sortBy: SortBy;
  sortDir: SortDir;
}
const EMPTY_FILTERS: AdvancedFilters = { categoryId: "", accountId: "", paymentMethodTypeId: "", dateFrom: "", dateTo: "", sortBy: "date", sortDir: "desc" };

const FILTERS: { value: "" | EntryType; label: string }[] = [
  { value: "", label: "All" },
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expense" },
];

/**
 * Mobile "Activity" view — a single filtered view over the same
 * /api/transactions collection the desktop Transactions/Expenses/Income
 * routes each read (one Transaction model with an EntryType, not three
 * separate entities). Shared by /transactions, /expenses and /income's
 * mobile branch, each passing the type their route implies.
 */
export function MobileTransactionsView({ initialType = "" }: { initialType?: "" | EntryType }) {
  const searchParams = useSearchParams();
  const initialSearch = searchParams?.get("search") || "";
  const { settings } = useSettingsContext();
  const f = (v: number) => formatCurrency(v, settings.currency);
  const [type, setType] = useState<"" | EntryType>(initialType);
  const [search, setSearch] = useState(initialSearch);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { data: categoriesData } = useCategories();
  const { data: accountsData } = useAccounts();
  const { data: paymentMethodsData } = usePaymentMethods();

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && !(k === "sortBy" && v === "date") && !(k === "sortDir" && v === "desc")).length;

  const filterKey = JSON.stringify({ type, search, filters });
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    if (page !== 1) setPage(1);
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["transactions", "activity", type, search, filters, page],
    queryFn: () =>
      getStorageMode() === "local"
        ? listLocalTransactions({
            page, pageSize: 20, type, search: search || undefined,
          })
        : api.get<PaginatedResponse<Transaction>>(
            `/api/transactions?page=${page}&pageSize=20&sortBy=${filters.sortBy}&sortDir=${filters.sortDir}` +
              (type ? `&type=${type}` : "") +
              (search ? `&search=${encodeURIComponent(search)}` : "") +
              (filters.categoryId ? `&categoryId=${filters.categoryId}` : "") +
              (filters.accountId ? `&accountId=${filters.accountId}` : "") +
              (filters.paymentMethodTypeId ? `&paymentMethodTypeId=${filters.paymentMethodTypeId}` : "") +
              (filters.dateFrom ? `&dateFrom=${filters.dateFrom}` : "") +
              (filters.dateTo ? `&dateTo=${filters.dateTo}` : "")
          ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => (getStorageMode() === "local" ? deleteLocalTransaction(id) : api.delete(`/api/transactions/${id}`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["income-expense-trend"] });
      queryClient.invalidateQueries({ queryKey: ["category-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      setDeleteTarget(null);
    },
  });

  const items = data?.items ?? [];

  return (
    <MobileShell title="Activity">
      <div className="ppm-page-title">
        <h2>Activity</h2>
        <p>Every income &amp; expense, one place</p>
      </div>

      <div className="ppm-searchbar">
        <span aria-hidden="true">⌕</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search description, merchant, notes…"
          aria-label="Search transactions"
        />
      </div>

      <div className="ppm-filters" role="tablist" aria-label="Filter by type">
        {FILTERS.map((chip) => (
          <button
            key={chip.value || "all"}
            type="button"
            role="tab"
            aria-selected={type === chip.value}
            className={`ppm-chip${type === chip.value ? " on" : ""}`}
            onClick={() => setType(chip.value)}
          >
            {chip.label}
          </button>
        ))}
        <button
          type="button"
          className={`ppm-chip${activeFilterCount > 0 ? " on" : ""}`}
          onClick={() => { setDraftFilters(filters); setFilterSheetOpen(true); }}
        >
          <SlidersHorizontal size={13} style={{display:"inline",verticalAlign:"-2px",marginRight:4}} />Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
      </div>

      {isLoading && (
        <div className="ppm-stack">
          <LoadingCard lines={5} />
        </div>
      )}

      {isError && !isLoading && <ErrorCard onRetry={() => refetch()} />}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyCard icon={<Receipt size={22} />} title="No transactions found" subtitle={search || type ? "Try a different search or filter." : "Tap the ＋ Add button on Home to log your first transaction."} />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="ppm-card">
          {items.map((t) => (
            <div className="ppm-txn-row" key={t.id} onClick={() => { setEditing(t); setSheetOpen(true); }}>
              <div className="ppm-ic" aria-hidden="true">{t.type === "INCOME" ? <Wallet size={18} /> : <Receipt size={18} />}</div>
              <div className="ppm-info">
                <div className="ppm-name">{t.description}</div>
                <div className="ppm-meta">{formatDateIN(t.date)} · {t.category?.name ?? "Uncategorized"}</div>
              </div>
              <div className={`ppm-amt ${t.type === "INCOME" ? "pos" : "neg"}`}>
                {t.type === "INCOME" ? "+" : "-"}{f(t.amount)}
              </div>
              <button
                type="button"
                aria-label={`Delete ${t.description}`}
                className="ppm-row-action"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !isError && data && data.pagination.totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, padding: "0 2px" }}>
          <button type="button" className="ppm-link-btn" disabled={page <= 1} style={page <= 1 ? { opacity: .4 } : undefined} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
          <span style={{ fontSize: 12, color: "var(--ppm-text-dim)" }}>Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} total</span>
          <button type="button" className="ppm-link-btn" disabled={page >= data.pagination.totalPages} style={page >= data.pagination.totalPages ? { opacity: .4 } : undefined} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}

      <MobileSheet open={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} title="Filter Activity">
        <div className="ppm-field-row">
          <div className="ppm-field">
            <label htmlFor="ppm-filter-from">From</label>
            <input id="ppm-filter-from" type="date" value={draftFilters.dateFrom} onChange={(e) => setDraftFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div className="ppm-field">
            <label htmlFor="ppm-filter-to">To</label>
            <input id="ppm-filter-to" type="date" value={draftFilters.dateTo} onChange={(e) => setDraftFilters((f) => ({ ...f, dateTo: e.target.value }))} />
          </div>
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-filter-category">Category</label>
          <select id="ppm-filter-category" value={draftFilters.categoryId} onChange={(e) => setDraftFilters((f) => ({ ...f, categoryId: e.target.value }))}>
            <option value="">All categories</option>
            {(categoriesData?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-filter-account">Wallet / Account</label>
          <select id="ppm-filter-account" value={draftFilters.accountId} onChange={(e) => setDraftFilters((f) => ({ ...f, accountId: e.target.value }))}>
            <option value="">All wallets</option>
            {(accountsData?.items ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-filter-pm">Money Source</label>
          <select id="ppm-filter-pm" value={draftFilters.paymentMethodTypeId} onChange={(e) => setDraftFilters((f) => ({ ...f, paymentMethodTypeId: e.target.value }))}>
            <option value="">All money sources</option>
            {(paymentMethodsData?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="ppm-field-row">
          <div className="ppm-field">
            <label htmlFor="ppm-filter-sortby">Sort By</label>
            <select id="ppm-filter-sortby" value={draftFilters.sortBy} onChange={(e) => setDraftFilters((f) => ({ ...f, sortBy: e.target.value as SortBy }))}>
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="description">Description</option>
            </select>
          </div>
          <div className="ppm-field">
            <label htmlFor="ppm-filter-sortdir">Order</label>
            <select id="ppm-filter-sortdir" value={draftFilters.sortDir} onChange={(e) => setDraftFilters((f) => ({ ...f, sortDir: e.target.value as SortDir }))}>
              <option value="desc">Newest / Highest first</option>
              <option value="asc">Oldest / Lowest first</option>
            </select>
          </div>
        </div>
        <div className="ppm-sheet-actions">
          <button type="button" className="ppm-sheet-submit" onClick={() => { setFilters(draftFilters); setFilterSheetOpen(false); }}>Apply Filters</button>
          <button type="button" className="ppm-sheet-cancel" onClick={() => { setDraftFilters(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setFilterSheetOpen(false); }}>Clear All</button>
        </div>
      </MobileSheet>

      <AddTransactionSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditing(null); }} editing={editing} />
      <ConfirmSheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete transaction"
        message={`Delete "${deleteTarget?.description}"? This can't be undone.`}
        isPending={deleteMutation.isPending}
        errorMessage={deleteMutation.isError ? (deleteMutation.error as Error)?.message : null}
      />
    </MobileShell>
  );
}
