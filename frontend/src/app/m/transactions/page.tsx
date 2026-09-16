"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { AddTransactionSheet } from "@/components/mobile/AddTransactionSheet";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { listLocalTransactions } from "@/lib/services/transactionsService";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency, formatDateIN } from "@/lib/format";
import type { Transaction, PaginatedResponse, EntryType } from "@/types";

const FILTERS: { value: "" | EntryType; label: string }[] = [
  { value: "", label: "All" },
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expense" },
];

/**
 * Mobile "Activity" tab — a single filtered view over the same /api/transactions
 * collection the desktop Transactions/Expenses/Income pages each read (per
 * PENNY_PILOT_BACKEND_UI_UX_DESIGN_SPEC.md §5: one Transaction model with an
 * EntryType, not three separate entities). Search + type filter here cover
 * what those three desktop pages provide; sorting/pagination/date-range and
 * account/payment-method/tag filters remain desktop-only for now (see the
 * implementation report's Known Limitations).
 */
export default function MobileTransactionsPage() {
  return (
    <Suspense>
      <MobileTransactionsContent />
    </Suspense>
  );
}

/**
 * The middleware rewrite from /expenses and /income carries an initial
 * ?type=EXPENSE|INCOME so those desktop routes' implied filter isn't lost
 * on the way into the combined mobile Activity view — read once, not
 * re-synced on further client-side filter clicks.
 */
function MobileTransactionsContent() {
  const { settings } = useSettingsContext();
  const f = (v: number) => formatCurrency(v, settings.currency);
  const searchParams = useSearchParams();
  const impliedType = searchParams.get("type");
  const [type, setType] = useState<"" | EntryType>(impliedType === "INCOME" || impliedType === "EXPENSE" ? impliedType : "");
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["transactions", "activity", type, search],
    queryFn: () =>
      getStorageMode() === "local"
        ? listLocalTransactions({ page: 1, pageSize: 50, type, search: search || undefined })
        : api.get<PaginatedResponse<Transaction>>(
            `/api/transactions?page=1&pageSize=50&sortBy=date&sortDir=desc${type ? `&type=${type}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`
          ),
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
      </div>

      {isLoading && (
        <div className="ppm-stack">
          <LoadingCard lines={5} />
        </div>
      )}

      {isError && !isLoading && <ErrorCard onRetry={() => refetch()} />}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyCard icon="🧾" title="No transactions found" subtitle={search || type ? "Try a different search or filter." : "Tap the ＋ Add button on Home to log your first transaction."} />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="ppm-card">
          {items.map((t) => (
            <div className="ppm-txn-row" key={t.id}>
              <div className="ppm-ic" aria-hidden="true">{t.type === "INCOME" ? "💰" : "🧾"}</div>
              <div className="ppm-info">
                <div className="ppm-name">{t.description}</div>
                <div className="ppm-meta">{formatDateIN(t.date)} · {t.category?.name ?? "Uncategorized"}</div>
              </div>
              <div className={`ppm-amt ${t.type === "INCOME" ? "pos" : "neg"}`}>
                {t.type === "INCOME" ? "+" : "-"}{f(t.amount)}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="ppm-qa-btn primary"
        style={{ position: "fixed", right: 16, bottom: "calc(76px + env(safe-area-inset-bottom, 0px))", width: 56, height: 56, borderRadius: "50%", padding: 0, fontSize: "1.4rem", boxShadow: "var(--ppm-shadow)", zIndex: 15 }}
        aria-label="Add transaction"
        onClick={() => setSheetOpen(true)}
      >
        ＋
      </button>

      <AddTransactionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </MobileShell>
  );
}
