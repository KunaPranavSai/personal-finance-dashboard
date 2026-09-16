"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { getLocalMonthlyReport, getLocalCategoryReport, getLocalBudgetReport } from "@/lib/services/reportsService";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency } from "@/lib/format";
import type { ReportItem } from "@/types";

type Tab = "monthly" | "categories" | "budgets";
const TABS: { id: Tab; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "categories", label: "Categories" },
  { id: "budgets", label: "Budget vs Actual" },
];

/** Client-side CSV export — same approach as the desktop reports page, no
 * server round-trip or new dependency. */
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Mobile "Reports" screen, reached from More → Financial Modules. Covers the
 * three real report types (Monthly, Category, Budget vs Actual) from
 * /api/reports/* (or Local-Only equivalents) with the exact same CSV export
 * columns as desktop's "Export Raw Ledger (CSV)" button (which itself only
 * exports the monthly rollup — there is no separate transaction-level ledger
 * export anywhere in the app). Desktop's "Flight Summary (PDF)" is just
 * `window.print()` — that works identically on mobile browsers (they open
 * the native print/share-to-PDF sheet), so the same real report data is
 * printed here directly via the `.ppm-print-summary` print stylesheet in
 * mobile.css, entirely inside the mobile UI.
 */
export function MobileReportsView() {
  const { settings } = useSettingsContext();
  const f = (v: number) => formatCurrency(v, settings.currency);
  const [tab, setTab] = useState<Tab>("monthly");

  const { data: monthly, isLoading: loadingMonthly, isError: errorMonthly, refetch: refetchMonthly } = useQuery({
    queryKey: ["reports-monthly"],
    queryFn: () => (getStorageMode() === "local" ? getLocalMonthlyReport() : api.get<{ items: ReportItem[] }>("/api/reports/monthly")),
    enabled: tab === "monthly",
  });

  const { data: categories, isLoading: loadingCategories, isError: errorCategories, refetch: refetchCategories } = useQuery({
    queryKey: ["reports-categories"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getLocalCategoryReport()
        : api.get<{ items: { category: string; total: number; count: number }[] }>("/api/reports/categories"),
    enabled: tab === "categories",
  });

  const { data: budgets, isLoading: loadingBudgets, isError: errorBudgets, refetch: refetchBudgets } = useQuery({
    queryKey: ["reports-budgets"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getLocalBudgetReport()
        : api.get<{ items: { category: string; budgeted: number; actual: number; variance: number }[] }>("/api/reports/budgets"),
    enabled: tab === "budgets",
  });

  const exportMonthlyCsv = () => {
    if (!monthly?.items) return;
    downloadCsv("penny-pilot-monthly-report.csv", [
      ["Month", "Income", "Expense", "Net Savings", "Transactions"],
      ...monthly.items.map((m) => [m.month, m.income, m.expense, m.income - m.expense, m.count]),
    ]);
  };

  return (
    <MobileShell title="Reports">
      <div className="ppm-page-title">
        <h2>Reports</h2>
        <p>Monthly, category &amp; budget performance</p>
      </div>

      <div className="ppm-filters" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`ppm-chip${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "monthly" && (
        <>
          {loadingMonthly && <LoadingCard lines={4} />}
          {errorMonthly && !loadingMonthly && <ErrorCard onRetry={() => refetchMonthly()} />}
          {!loadingMonthly && !errorMonthly && (monthly?.items?.length ?? 0) === 0 && <EmptyCard icon="📄" title="No monthly data" subtitle="Add transactions to see monthly reports." />}
          {!loadingMonthly && !errorMonthly && (monthly?.items?.length ?? 0) > 0 && (
            <>
              <div className="ppm-card ppm-print-summary">
                {monthly!.items.map((m) => (
                  <div className="ppm-cat-row" key={m.month}>
                    <div className="ppm-info"><div className="ppm-name">{m.month}</div><div className="ppm-meta">{m.count} transactions</div></div>
                    <div className="ppm-amt">
                      <span style={{ color: "var(--ppm-positive)" }}>{f(m.income)}</span>
                      <span className="sub" style={{ color: "var(--ppm-critical)" }}>-{f(m.expense)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" className="ppm-qa-btn" style={{ flex: 1 }} onClick={exportMonthlyCsv}>⬇ Export CSV</button>
                <button type="button" className="ppm-qa-btn" style={{ flex: 1 }} onClick={() => window.print()}>🖨 Print / Save PDF</button>
              </div>
            </>
          )}
        </>
      )}

      {tab === "categories" && (
        <>
          {loadingCategories && <LoadingCard lines={4} />}
          {errorCategories && !loadingCategories && <ErrorCard onRetry={() => refetchCategories()} />}
          {!loadingCategories && !errorCategories && (categories?.items?.length ?? 0) === 0 && <EmptyCard icon="📄" title="No category data" subtitle="Add expense transactions to see this report." />}
          {!loadingCategories && !errorCategories && (categories?.items?.length ?? 0) > 0 && (
            <div className="ppm-card">
              {categories!.items.map((c) => (
                <div className="ppm-cat-row" key={c.category}>
                  <div className="ppm-info"><div className="ppm-name">{c.category}</div><div className="ppm-meta">{c.count} transactions</div></div>
                  <div className="ppm-amt">{f(c.total)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "budgets" && (
        <>
          {loadingBudgets && <LoadingCard lines={4} />}
          {errorBudgets && !loadingBudgets && <ErrorCard onRetry={() => refetchBudgets()} />}
          {!loadingBudgets && !errorBudgets && (budgets?.items?.length ?? 0) === 0 && <EmptyCard icon="📄" title="No budget data" subtitle="Set budgets to compare against actual spending." />}
          {!loadingBudgets && !errorBudgets && (budgets?.items?.length ?? 0) > 0 && (
            <div className="ppm-card">
              {budgets!.items.map((b) => (
                <div className="ppm-cat-row" key={b.category}>
                  <div className="ppm-info">
                    <div className="ppm-name">{b.category}</div>
                    <div className="ppm-meta">Budgeted {f(b.budgeted)}</div>
                  </div>
                  <div className={`ppm-amt ${b.variance >= 0 ? "pos" : "neg"}`}>
                    {f(b.actual)}
                    <span className="sub">{b.variance >= 0 ? "under" : "over"} by {f(Math.abs(b.variance))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </MobileShell>
  );
}
