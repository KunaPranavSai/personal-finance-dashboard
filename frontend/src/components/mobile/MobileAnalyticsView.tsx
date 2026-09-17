"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { getLocalAnalyticsSummary, AnalyticsFilters } from "@/lib/services/analyticsService";
import { getGroupedChartData, getYearToDateChartData, ChartPoint } from "@/lib/services/customChartService";
import { useCategories, useAccounts, usePaymentMethods } from "@/lib/reference";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency, formatCompactCurrency } from "@/lib/format";
import type { AnalyticsSummary } from "@/types";

type BuilderMetric = "income" | "expense" | "savings" | "transactions";
type BuilderSecondary = "none" | "netCashFlow";
type BuilderGrouping = "daily" | "weekly" | "monthly" | "ytd";
interface BuilderConfig {
  primary: BuilderMetric;
  secondary: BuilderSecondary;
  grouping: BuilderGrouping;
}
const BUILDER_STORAGE_KEY = "pfd-analytics-custom-chart";
const DEFAULT_BUILDER_CONFIG: BuilderConfig = { primary: "income", secondary: "netCashFlow", grouping: "monthly" };
const PRIMARY_METRIC_OPTIONS: { value: BuilderMetric; label: string }[] = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expenses" },
  { value: "savings", label: "Savings" },
  { value: "transactions", label: "Transaction Count" },
];
const SECONDARY_METRIC_OPTIONS: { value: BuilderSecondary; label: string }[] = [
  { value: "none", label: "None" },
  { value: "netCashFlow", label: "Cash Flow" },
];
const GROUPING_OPTIONS: { value: BuilderGrouping; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "ytd", label: "Year-to-Date" },
];
const METRIC_LABEL: Record<BuilderMetric, string> = { income: "Income", expense: "Expenses", savings: "Savings", transactions: "Transactions" };

function loadBuilderConfig(): BuilderConfig {
  if (typeof window === "undefined") return DEFAULT_BUILDER_CONFIG;
  try {
    const raw = localStorage.getItem(BUILDER_STORAGE_KEY);
    return raw ? { ...DEFAULT_BUILDER_CONFIG, ...JSON.parse(raw) } : DEFAULT_BUILDER_CONFIG;
  } catch {
    return DEFAULT_BUILDER_CONFIG;
  }
}

type RangeKey = "this-month" | "last-3" | "ytd" | "all" | "custom";
const RANGES: { value: RangeKey; label: string }[] = [
  { value: "this-month", label: "This Month" },
  { value: "last-3", label: "Last 3 Months" },
  { value: "ytd", label: "Year to Date" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom…" },
];

function computeRange(range: RangeKey, custom: { from: string; to: string }): { from?: string; to?: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (range === "all") return {};
  if (range === "custom") return { from: custom.from || undefined, to: custom.to || undefined };
  if (range === "this-month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  if (range === "last-3") return { from: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: iso(now) };
  return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
}

/**
 * Mobile "Analytics" screen, reached from More → Financial Modules.
 * Reproduces the real /api/analytics/summary (or Local-Only equivalent)
 * with preset + custom date ranges and category/account/payment-method
 * filters, same metrics and same filter params the desktop page's chart
 * panels are built from. The desktop's Recharts visualizations are not
 * reproduced — bars/lists carry the same real numbers instead, kept
 * intentionally simple per the brief's "no unnecessary dependencies"
 * guidance.
 */
export function MobileAnalyticsView() {
  const { settings } = useSettingsContext();
  const f = (v: number) => formatCurrency(v, settings.currency);
  const [range, setRange] = useState<RangeKey>("this-month");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderConfig, setBuilderConfig] = useState<BuilderConfig>(DEFAULT_BUILDER_CONFIG);
  useEffect(() => { setBuilderConfig(loadBuilderConfig()); }, []);
  useEffect(() => {
    try { localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(builderConfig)); } catch { /* ignore */ }
  }, [builderConfig]);
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [paymentMethodTypeId, setPaymentMethodTypeId] = useState("");
  const { data: categoriesData } = useCategories();
  const { data: accountsData } = useAccounts();
  const { data: paymentMethodsData } = usePaymentMethods();
  const { from, to } = useMemo(() => computeRange(range, customRange), [range, customRange]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics", from, to, categoryId, accountId, paymentMethodTypeId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (categoryId) params.set("categoryId", categoryId);
      if (accountId) params.set("accountId", accountId);
      if (paymentMethodTypeId) params.set("paymentMethodTypeId", paymentMethodTypeId);
      const qs = params.toString();
      return getStorageMode() === "local"
        ? getLocalAnalyticsSummary({ from, to, categoryId, accountId, paymentMethodTypeId })
        : api.get<AnalyticsSummary>(`/api/analytics/summary${qs ? `?${qs}` : ""}`);
    },
  });

  const activeExtraFilters = [categoryId, accountId, paymentMethodTypeId].filter(Boolean).length;

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
        <button type="button" className={`ppm-chip${activeExtraFilters > 0 ? " on" : ""}`} onClick={() => setFilterSheetOpen(true)}>
          ⚙ Filters{activeExtraFilters > 0 ? ` (${activeExtraFilters})` : ""}
        </button>
      </div>

      {range === "custom" && (
        <div className="ppm-field-row" style={{ marginBottom: 12 }}>
          <div className="ppm-field">
            <label htmlFor="ppm-an-from">From</label>
            <input id="ppm-an-from" type="date" value={customRange.from} onChange={(e) => setCustomRange((r) => ({ ...r, from: e.target.value }))} />
          </div>
          <div className="ppm-field">
            <label htmlFor="ppm-an-to">To</label>
            <input id="ppm-an-to" type="date" value={customRange.to} onChange={(e) => setCustomRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
        </div>
      )}

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

      {!isLoading && !isError && data && data.monthlyTrend.length > 0 && (
        <button type="button" className="ppm-qa-btn" style={{ width: "100%", marginTop: 4 }} onClick={() => setBuilderOpen(true)}>✨ Custom Chart</button>
      )}

      <MobileSheet open={builderOpen} onClose={() => setBuilderOpen(false)} title="Custom Chart">
        <div className="ppm-field">
          <label htmlFor="ppm-cb-primary">Primary Metric</label>
          <select id="ppm-cb-primary" value={builderConfig.primary} onChange={(e) => setBuilderConfig((c) => ({ ...c, primary: e.target.value as BuilderMetric }))}>
            {PRIMARY_METRIC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-cb-secondary">Secondary Metric</label>
          <select id="ppm-cb-secondary" value={builderConfig.secondary} onChange={(e) => setBuilderConfig((c) => ({ ...c, secondary: e.target.value as BuilderSecondary }))}>
            {SECONDARY_METRIC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-cb-grouping">Time Grouping</label>
          <select id="ppm-cb-grouping" value={builderConfig.grouping} onChange={(e) => setBuilderConfig((c) => ({ ...c, grouping: e.target.value as BuilderGrouping }))}>
            {GROUPING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <CustomChartRows builderConfig={builderConfig} trend={data?.monthlyTrend ?? []} filters={{ from, to, categoryId, accountId, paymentMethodTypeId }} f={f} />

        <div className="ppm-sheet-actions">
          <button type="button" className="ppm-sheet-cancel" onClick={() => setBuilderOpen(false)}>Done</button>
        </div>
      </MobileSheet>

      <MobileSheet open={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} title="Filter Analytics">
        <div className="ppm-field">
          <label htmlFor="ppm-an-category">Category</label>
          <select id="ppm-an-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {(categoriesData?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-an-account">Wallet / Account</label>
          <select id="ppm-an-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">All wallets</option>
            {(accountsData?.items ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-an-pm">Money Source</label>
          <select id="ppm-an-pm" value={paymentMethodTypeId} onChange={(e) => setPaymentMethodTypeId(e.target.value)}>
            <option value="">All money sources</option>
            {(paymentMethodsData?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="ppm-sheet-actions">
          <button type="button" className="ppm-sheet-submit" onClick={() => setFilterSheetOpen(false)}>Apply</button>
          <button type="button" className="ppm-sheet-cancel" onClick={() => { setCategoryId(""); setAccountId(""); setPaymentMethodTypeId(""); setFilterSheetOpen(false); }}>Clear All</button>
        </div>
      </MobileSheet>
    </MobileShell>
  );
}

/** Renders the Custom Chart's data rows for whichever grouping is selected —
 * Monthly/Year-to-Date come straight from the page's own monthly trend,
 * Daily/Weekly re-fetch real transactions and bucket them (see
 * lib/services/customChartService.ts), same real-data rule as desktop. */
function CustomChartRows({
  builderConfig,
  trend,
  filters,
  f,
}: {
  builderConfig: BuilderConfig;
  trend: { month: string; income: number; expense: number; count: number }[];
  filters: AnalyticsFilters;
  f: (v: number) => string;
}) {
  const { data: groupedData, isLoading: groupedLoading } = useQuery({
    queryKey: ["custom-chart-grouped-mobile", builderConfig.grouping, filters],
    queryFn: () => getGroupedChartData(filters, builderConfig.grouping as "daily" | "weekly"),
    enabled: builderConfig.grouping === "daily" || builderConfig.grouping === "weekly",
  });

  const monthlyRows: ChartPoint[] = trend.map((m) => ({
    bucket: m.month,
    income: m.income,
    expense: m.expense,
    savings: m.income - m.expense,
    transactions: m.count,
    netCashFlow: m.income - m.expense,
  }));

  const rows: ChartPoint[] =
    builderConfig.grouping === "monthly" ? monthlyRows
    : builderConfig.grouping === "ytd" ? getYearToDateChartData(trend)
    : groupedData ?? [];

  if ((builderConfig.grouping === "daily" || builderConfig.grouping === "weekly") && groupedLoading) {
    return <div className="ppm-card" style={{ marginTop: 12, background: "var(--ppm-surface-2)" }}><LoadingCard lines={4} /></div>;
  }

  if (rows.length === 0) {
    return (
      <div className="ppm-card" style={{ marginTop: 12, background: "var(--ppm-surface-2)" }}>
        <p style={{ fontSize: 12, color: "var(--ppm-text-dim)" }}>No data for this selection.</p>
      </div>
    );
  }

  const maxVal = Math.max(1, ...rows.map((r) => Math.abs(r[builderConfig.primary])));

  return (
    <div className="ppm-card" style={{ marginTop: 12, background: "var(--ppm-surface-2)" }}>
      {rows.map((r) => (
        <div key={r.bucket} style={{ marginBottom: 10 }}>
          <div className="ppm-cf-row" style={{ marginBottom: 4 }}>
            <span>{r.bucket}</span>
            <span>
              {builderConfig.primary === "transactions" ? r.transactions : f(r[builderConfig.primary])}
              {builderConfig.secondary === "netCashFlow" && ` · Cash Flow: ${f(r.netCashFlow)}`}
            </span>
          </div>
          <div className="ppm-bar-track">
            <div className="ppm-bar-fill" style={{ width: `${(Math.abs(r[builderConfig.primary]) / maxVal) * 100}%`, background: "var(--ppm-accent)" }} />
          </div>
        </div>
      ))}
      <p style={{ fontSize: 11, color: "var(--ppm-text-dim)", marginTop: 8 }}>Plotting {METRIC_LABEL[builderConfig.primary]} by {builderConfig.grouping === "ytd" ? "month (cumulative)" : builderConfig.grouping}. Your selections are saved automatically.</p>
    </div>
  );
}
