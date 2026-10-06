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
import Link from "next/link";
import { useRef } from "react";
import { TrendingUp, Sparkles, SlidersHorizontal, FileText } from "lucide-react";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency, formatCompactCurrency } from "@/lib/format";
import type { AnalyticsSummary } from "@/types";

type BuilderMetric = "income" | "expense" | "savings" | "transactions";
type BuilderSecondary = "none" | "netCashFlow";
type BuilderGrouping = "daily" | "weekly" | "monthly" | "ytd";
type BuilderViz = "bars" | "line" | "donut";
interface BuilderConfig {
  primary: BuilderMetric;
  secondary: BuilderSecondary;
  grouping: BuilderGrouping;
  viz: BuilderViz;
}
// Own key: the desktop builder stores a different shape under the old key.
const BUILDER_STORAGE_KEY = "pfd-analytics-custom-chart-mobile";
const DEFAULT_BUILDER_CONFIG: BuilderConfig = { primary: "income", secondary: "netCashFlow", grouping: "monthly", viz: "bars" };
const VIZ_OPTIONS: { value: BuilderViz; label: string }[] = [{ value: "bars", label: "Bars" }, { value: "line", label: "Line" }, { value: "donut", label: "Donut" }];
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
    const saved = raw ? JSON.parse(raw) : {};
    const pick = <T extends string>(v: unknown, allowed: T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
    // Validate every field so a stale/edited value can never produce NaN bars.
    return {
      primary: pick(saved.primary, PRIMARY_METRIC_OPTIONS.map((o) => o.value), DEFAULT_BUILDER_CONFIG.primary),
      secondary: pick(saved.secondary, SECONDARY_METRIC_OPTIONS.map((o) => o.value), DEFAULT_BUILDER_CONFIG.secondary),
      grouping: pick(saved.grouping, GROUPING_OPTIONS.map((o) => o.value), DEFAULT_BUILDER_CONFIG.grouping),
      viz: pick(saved.viz, VIZ_OPTIONS.map((o) => o.value), DEFAULT_BUILDER_CONFIG.viz),
    };
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
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const configLoaded = useRef(false);
  useEffect(() => { setBuilderConfig(loadBuilderConfig()); configLoaded.current = true; }, []);
  useEffect(() => {
    if (!configLoaded.current) return; // never overwrite the saved choice with the defaults before it is read
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
      <div className="ppm-head-row">
        <h2>Analytics</h2>
        <button type="button" className={`ppm-chip${activeExtraFilters > 0 ? " on" : ""}`} onClick={() => setFilterSheetOpen(true)} aria-label="Filters">
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span className="ppm-filter-label">Filters{activeExtraFilters > 0 ? ` (${activeExtraFilters})` : ""}</span>
        </button>
      </div>

      {/* "Custom" is pinned outside the scrolling chip row so it is always visible. */}
      <div role="tablist" aria-label="Date range" style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
        <div className="ppm-filters" style={{ flex: 1, minWidth: 0, margin: 0, padding: 0 }}>
          {RANGES.filter((r) => r.value !== "custom").map((r) => (
            <button key={r.value} type="button" role="tab" aria-selected={range === r.value} className={`ppm-chip${range === r.value ? " on" : ""}`} onClick={() => setRange(r.value)}>
              {r.label}
            </button>
          ))}
        </div>
        <button type="button" role="tab" aria-selected={range === "custom"} className={`ppm-chip${range === "custom" ? " on" : ""}`} style={{ flex: "none" }} onClick={() => setRange("custom")}>
          Custom…
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
        <EmptyCard icon={<TrendingUp size={22} />} title="No transactions in this range" subtitle="Try a wider date range or add some transactions." />
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

      {!isLoading && !isError && (
        <button type="button" className="ppm-chip" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} onClick={() => setBuilderOpen(true)}><Sparkles size={14} style={{display:"inline",verticalAlign:"-2px",marginRight:4}} />Custom Chart</button>
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

        <div className="ppm-field">
          <label>Chart type</label>
          <div className="ppm-filters" style={{ margin: 0 }}>
            {VIZ_OPTIONS.map((o) => (
              <button key={o.value} type="button" className={`ppm-chip${builderConfig.viz === o.value ? " on" : ""}`} onClick={() => setBuilderConfig((c) => ({ ...c, viz: o.value }))}>{o.label}</button>
            ))}
          </div>
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
      <Link href="/reports" className="ppm-card ppm-cap-card" style={{ marginTop: 14 }}>
        <div className="ppm-cap-head"><div className="ppm-ic" aria-hidden="true"><FileText size={20} /></div><div className="ppm-name">Reports</div><span className="ppm-chev" aria-hidden="true">›</span></div>
        <div className="ppm-meta">View and explore your financial reports, or export them</div>
      </Link>
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
  const val = (r: ChartPoint) => Number(r[builderConfig.primary]) || 0;
  // Savings and Cash Flow are the same number, so the secondary series is skipped when Savings is primary.
  const showSecondary = builderConfig.secondary === "netCashFlow" && builderConfig.primary !== "savings";

  return (
    <div className="ppm-card" style={{ marginTop: 12, background: "var(--ppm-surface-2)" }}>
      {builderConfig.viz === "line" && <LineViz rows={rows} val={val} second={showSecondary ? (r) => r.netCashFlow : undefined} />}
      {builderConfig.viz === "donut" && <DonutViz rows={rows} val={val} f={(v) => (builderConfig.primary === "transactions" ? String(v) : f(v))} />}
      {builderConfig.viz === "bars" && rows.map((r) => (
        <div key={r.bucket} style={{ marginBottom: 10 }}>
          <div className="ppm-cf-row" style={{ marginBottom: 4 }}>
            <span>{r.bucket}</span>
            <span>
              {builderConfig.primary === "transactions" ? r.transactions : f(r[builderConfig.primary])}
              {showSecondary && ` · Cash Flow: ${f(r.netCashFlow)}`}
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

/** Tiny SVG line chart (no chart library): primary series solid, optional secondary dashed. */
function LineViz({ rows, val, second }: { rows: ChartPoint[]; val: (r: ChartPoint) => number; second?: (r: ChartPoint) => number }) {
  const W = 300, H = 140, P = 12;
  const a = rows.map(val), b = second ? rows.map(second) : [];
  const all = [...a, ...b, 0];
  const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
  const x = (i: number) => (rows.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (rows.length - 1));
  const y = (v: number) => H - P - ((v - lo) / span) * (H - 2 * P);
  const path = (xs: number[]) => xs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Line chart">
        <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} stroke="var(--ppm-border)" />
        {b.length > 0 && <path d={path(b)} fill="none" stroke="var(--ppm-text-dim)" strokeWidth="2" strokeDasharray="4 3" />}
        <path d={path(a)} fill="none" stroke="var(--ppm-accent)" strokeWidth="2.5" />
        {a.map((v, i) => <circle key={rows[i].bucket} cx={x(i)} cy={y(v)} r="3" fill="var(--ppm-accent)" />)}
      </svg>
      <div className="ppm-cf-row"><span>{rows[0].bucket}</span><span>{rows[rows.length - 1].bucket}</span></div>
    </div>
  );
}

const DONUT_COLORS = ["var(--ppm-accent)", "var(--ppm-positive)", "var(--ppm-critical)", "#f59e0b", "#8b5cf6", "#06b6d4", "var(--ppm-text-dim)"];

/** Share of the primary metric per bucket (negative values count as 0; the 6 biggest are shown, the rest grouped). */
function DonutViz({ rows, val, f }: { rows: ChartPoint[]; val: (r: ChartPoint) => number; f: (v: number) => string }) {
  const items = rows.map((r) => ({ label: r.bucket, v: Math.max(0, val(r)) })).filter((i) => i.v > 0).sort((p, q) => q.v - p.v);
  const top = items.slice(0, 6);
  const rest = items.slice(6).reduce((s, i) => s + i.v, 0);
  if (rest > 0) top.push({ label: "Other", v: rest });
  const total = top.reduce((s, i) => s + i.v, 0);
  if (total === 0) return <p style={{ fontSize: 12, color: "var(--ppm-text-dim)" }}>Nothing positive to show for this selection.</p>;
  const R = 50, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div>
      <svg viewBox="0 0 140 140" width="160" height="160" role="img" aria-label="Donut chart" style={{ display: "block", margin: "0 auto" }}>
        <g transform="rotate(-90 70 70)">
          {top.map((i, k) => { const len = (i.v / total) * C; const el = <circle key={i.label} cx="70" cy="70" r={R} fill="none" stroke={DONUT_COLORS[k % DONUT_COLORS.length]} strokeWidth="22" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />; off += len; return el; })}
        </g>
      </svg>
      {top.map((i, k) => (
        <div key={i.label} className="ppm-cf-row" style={{ marginTop: 4 }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, marginRight: 6, background: DONUT_COLORS[k % DONUT_COLORS.length] }} />{i.label}</span>
          <span>{f(i.v)} · {Math.round((i.v / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}
