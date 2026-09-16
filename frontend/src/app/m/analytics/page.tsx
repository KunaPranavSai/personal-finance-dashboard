"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { getLocalAnalyticsSummary } from "@/lib/services/analyticsService";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency, formatCompactCurrency } from "@/lib/format";
import type { AnalyticsSummary } from "@/types";

type RangeKey = "this-month" | "last-3" | "ytd" | "all";
const RANGES: { value: RangeKey; label: string }[] = [
  { value: "this-month", label: "This Month" },
  { value: "last-3", label: "Last 3 Months" },
  { value: "ytd", label: "Year to Date" },
  { value: "all", label: "All Time" },
];

function computeRange(range: RangeKey): { from?: string; to?: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (range === "all") return {};
  if (range === "this-month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  if (range === "last-3") return { from: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: iso(now) };
  return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
}

/**
 * Mobile "Analytics" screen, reached from More → Financial Modules.
 * Reproduces the real /api/analytics/summary (or Local-Only equivalent)
 * with a date-range filter, same metrics the desktop page's chart panels
 * are built from (category/payment-method breakdown, monthly trend, average
 * transaction size). Category/account/payment-method dropdown filters and
 * the desktop's Recharts visualizations are not reproduced — bars/lists
 * carry the same numbers instead, kept intentionally simple per the brief's
 * "no unnecessary dependencies" guidance; see the implementation report.
 */
export default function MobileAnalyticsPage() {
  const { settings } = useSettingsContext();
  const f = (v: number) => formatCurrency(v, settings.currency);
  const [range, setRange] = useState<RangeKey>("this-month");
  const { from, to } = useMemo(() => computeRange(range), [range]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics", from, to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      return getStorageMode() === "local"
        ? getLocalAnalyticsSummary({ from, to })
        : api.get<AnalyticsSummary>(`/api/analytics/summary${qs ? `?${qs}` : ""}`);
    },
  });

  const maxCategory = Math.max(1, ...(data?.categoryBreakdown ?? []).map((c) => c.total));
  const maxPaymentMethod = Math.max(1, ...(data?.paymentMethodBreakdown ?? []).map((p) => p.total));

  return (
    <MobileShell title="Analytics">
      <div className="ppm-page-title">
        <h2>Analytics</h2>
        <p>Spending patterns over time</p>
      </div>

      <div className="ppm-filters" role="tablist">
        {RANGES.map((r) => (
          <button key={r.value} type="button" role="tab" aria-selected={range === r.value} className={`ppm-chip${range === r.value ? " on" : ""}`} onClick={() => setRange(r.value)}>
            {r.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="ppm-stack"><LoadingCard lines={2} /><LoadingCard lines={4} /></div>}
      {isError && !isLoading && <ErrorCard onRetry={() => refetch()} />}

      {!isLoading && !isError && data && data.totalTransactions === 0 && (
        <EmptyCard icon="📈" title="No transactions in this range" subtitle="Try a wider date range or add some transactions." />
      )}

      {!isLoading && !isError && data && data.totalTransactions > 0 && (
        <div className="ppm-stack">
          <div className="ppm-card">
            <div className="ppm-cat-row">
              <div className="ppm-info"><div className="ppm-name">Transactions</div></div>
              <div className="ppm-amt">{data.totalTransactions}</div>
            </div>
            <div className="ppm-cat-row">
              <div className="ppm-info"><div className="ppm-name">Average Transaction</div></div>
              <div className="ppm-amt">{f(data.averageTransaction)}</div>
            </div>
            <div className="ppm-cat-row">
              <div className="ppm-info"><div className="ppm-name">Average Monthly Volume</div></div>
              <div className="ppm-amt">{f(data.averageMonthlyVolume)}</div>
            </div>
          </div>

          <div className="ppm-card">
            <div className="ppm-section-label">Expense by Category</div>
            {data.categoryBreakdown.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>No expense categories in range.</p>
            ) : data.categoryBreakdown.map((c) => (
              <div key={c.category} style={{ marginBottom: 10 }}>
                <div className="ppm-cf-row" style={{ marginBottom: 4 }}>
                  <span>{c.category}</span>
                  <span>{formatCompactCurrency(c.total, settings.currency)} · {c.count}</span>
                </div>
                <div className="ppm-bar-track"><div className="ppm-bar-fill" style={{ width: `${(c.total / maxCategory) * 100}%`, background: "var(--ppm-accent)" }} /></div>
              </div>
            ))}
          </div>

          <div className="ppm-card">
            <div className="ppm-section-label">By Money Source</div>
            {data.paymentMethodBreakdown.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>No money sources tagged in range.</p>
            ) : data.paymentMethodBreakdown.map((p) => (
              <div key={p.method} style={{ marginBottom: 10 }}>
                <div className="ppm-cf-row" style={{ marginBottom: 4 }}>
                  <span>{p.method}</span>
                  <span>{formatCompactCurrency(p.total, settings.currency)} · {p.count}</span>
                </div>
                <div className="ppm-bar-track"><div className="ppm-bar-fill" style={{ width: `${(p.total / maxPaymentMethod) * 100}%`, background: "var(--ppm-warning)" }} /></div>
              </div>
            ))}
          </div>

          <div className="ppm-card">
            <div className="ppm-section-label">Monthly Trend</div>
            {data.monthlyTrend.map((m) => (
              <div className="ppm-cat-row" key={m.month}>
                <div className="ppm-info"><div className="ppm-name">{m.month}</div><div className="ppm-meta">{m.count} transactions</div></div>
                <div className="ppm-amt">
                  <span className="pos" style={{ color: "var(--ppm-positive)" }}>{formatCompactCurrency(m.income, settings.currency)}</span>
                  {" / "}
                  <span style={{ color: "var(--ppm-critical)" }}>{formatCompactCurrency(m.expense, settings.currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </MobileShell>
  );
}
