"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Transaction, PaginatedResponse } from "@/types";
import { formatCurrency as fmtCurr, formatDateIN } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Pencil, Trash2, Search, ArrowLeftRight } from "lucide-react";

export function TransactionsTable({
  onEdit,
  fixedType,
}: {
  onEdit: (tx: Transaction) => void;
  fixedType?: "INCOME" | "EXPENSE";
}) {
  const { settings } = useSettingsContext();
  const cur = settings.currency;
  const formatINR = (v: number) => fmtCurr(v, cur);
  const searchParams = useSearchParams();
  const initialSearch = searchParams?.get("search") || "";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initialSearch);
  const [typeFilter, setTypeFilter] = useState<"" | "INCOME" | "EXPENSE">("");
  const type = fixedType ?? typeFilter;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", { page, search, type }],
    queryFn: () =>
      api.get<PaginatedResponse<Transaction>>(
        `/api/transactions?page=${page}&pageSize=20${search ? `&search=${encodeURIComponent(search)}` : ""}${type ? `&type=${type}` : ""}`
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const items = data?.items ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
          <Search className="h-4 w-4 text-navy/40" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search description, merchant, notes…"
            className="w-56 bg-transparent outline-none placeholder:text-navy/30"
          />
        </div>
        {!fixedType && (
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as any); setPage(1); }}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white"
          >
            <option value="">All Types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={fixedType === "INCOME" ? "No Income Yet" : fixedType === "EXPENSE" ? "No Expenses Yet" : "No Transactions Yet"}
          description={
            fixedType === "INCOME"
              ? "Add your first income entry to start tracking what you earn."
              : fixedType === "EXPENSE"
              ? "Add your first expense to start tracking what you spend."
              : "Add your first transaction to start tracking your income and expenses."
          }
        />
      ) : (
        <>
          {/* Desktop / tablet: full table */}
          <div className="hidden overflow-x-auto rounded-xl2 border border-black/5 dark:border-white/10 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.02] text-xs font-semibold uppercase text-navy/50 dark:bg-white/5 dark:text-white/50">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((tx) => (
                  <tr key={tx.id} className="border-t border-black/5 dark:border-white/5">
                    <td className="px-4 py-3 text-navy/70 dark:text-white/70">{formatDateIN(tx.date)}</td>
                    <td className="px-4 py-3 font-medium text-navy dark:text-white">
                      {tx.description}
                      {tx.merchant && <span className="ml-2 text-xs text-navy/40">· {tx.merchant}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="teal">{tx.category?.name}</Badge>
                    </td>
                    <td className="px-4 py-3 text-navy/60 dark:text-white/60">{tx.paymentMethodType?.name ?? "—"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${tx.type === "INCOME" ? "text-emerald-600" : "text-red-600"}`}>
                      {tx.type === "INCOME" ? "+" : "-"}{formatINR(tx.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => onEdit(tx)} className="rounded p-1.5 text-navy/40 hover:bg-black/5 hover:text-navy dark:hover:bg-white/10">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm("Delete this transaction?")) deleteMutation.mutate(tx.id); }}
                          className="rounded p-1.5 text-navy/40 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: compact card list, same data as the table with no horizontal scroll */}
          <div className="flex flex-col gap-2 md:hidden">
            {items.map((tx) => (
              <div key={tx.id} className="rounded-xl2 border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-navy-dark">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy dark:text-white">{tx.description}</p>
                    {tx.merchant && <p className="truncate text-xs text-navy/40 dark:text-white/40">{tx.merchant}</p>}
                  </div>
                  <p className={`shrink-0 text-sm font-semibold ${tx.type === "INCOME" ? "text-emerald-600" : "text-red-600"}`}>
                    {tx.type === "INCOME" ? "+" : "-"}{formatINR(tx.amount)}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Badge tone="teal">{tx.category?.name}</Badge>
                    <span className="text-xs text-navy/40 dark:text-white/40">{formatDateIN(tx.date)}</span>
                    {tx.paymentMethodType?.name && (
                      <span className="text-xs text-navy/40 dark:text-white/40">· {tx.paymentMethodType.name}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => onEdit(tx)} className="rounded p-1.5 text-navy/40 hover:bg-black/5 hover:text-navy dark:hover:bg-white/10" aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm("Delete this transaction?")) deleteMutation.mutate(tx.id); }}
                      className="rounded p-1.5 text-navy/40 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {data && data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-navy/60 dark:text-white/60">
          <span>
            Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} transactions
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="ghost" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
