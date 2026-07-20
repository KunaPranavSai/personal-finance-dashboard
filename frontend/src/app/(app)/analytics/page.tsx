"use client";

import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportPreviewModal } from "@/components/ui/ExportPreviewModal";
import { api } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { useCategories, useAccounts, usePaymentMethods } from "@/lib/reference";
import { AnalyticsSummary } from "@/types";
import { BarChart3, TrendingUp, TrendingDown, Hash, Download, Wallet } from "lucide-react";

const COLORS = ["#0EA5A5", "#1F2A44", "#F1C40F", "#E67E22", "#7D3C98", "#2471A3", "#C0392B", "#1E8449"];

type RangeKey =
  | "today" | "yesterday" | "this-week" | "last-week" | "this-month" | "last-month"
  | "3-months" | "6-months" | "1-year" | "all" | "custom";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this-week", label: "This Week" },
  { value: "last-week", label: "Last Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "3-months", label: "Last 3 Months" },
  { value: "6-months", label: "Last 6 Months" },
  { value: "1-year", label: "Last Year" },
  { value: "custom", label: "Custom Range" },
];

type ChartKind = "line" | "bar" | "area" | "pie" | "donut";

const TREND_CHART_OPTIONS: { value: ChartKind; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "bar", label: "Bar" },
  { value: "area", label: "Area" },
];

const BREAKDOWN_CHART_OPTIONS: { value: ChartKind; label: string }[] = [
  { value: "donut", label: "Donut" },
  { value: "pie", label: "Pie" },
  { value: "bar", label: "Bar" },
];

const METRIC_OPTIONS = [
  { id: "kpis", label: "Key Metrics" },
  { id: "trend", label: "Income vs Expense Trend" },
  { id: "expense-breakdown", label: "Expense by Category" },
  { id: "income-breakdown", label: "Income by Category" },
  { id: "payment-methods", label: "Payment Methods" },
  { id: "monthly-table", label: "Monthly Table" },
] as const;
type MetricId = (typeof METRIC_OPTIONS)[number]["id"];

// Format using local Y-M-D components (not toISOString, which converts to UTC and can
// shift the date backward a full day for timezones ahead of UTC, e.g. IST).
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeRange(range: RangeKey, customFrom: string, customTo: string): { from?: string; to?: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);

  switch (range) {
    case "today":
      return { from: isoDate(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: isoDate(y), to: isoDate(today) };
    }
    case "this-week": {
      const monday = new Date(today);
      const day = (monday.getDay() + 6) % 7;
      monday.setDate(monday.getDate() - day);
      return { from: isoDate(monday) };
    }
    case "last-week": {
      const monday = new Date(today);
      const day = (monday.getDay() + 6) % 7;
      monday.setDate(monday.getDate() - day - 7);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 7);
      return { from: isoDate(monday), to: isoDate(sunday) };
    }
    case "this-month":
      return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)) };
    case "last-month":
      return {
        from: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      };
    case "3-months": {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 3);
      return { from: isoDate(d) };
    }
    case "6-months": {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 6);
      return { from: isoDate(d) };
    }
    case "1-year": {
      const d = new Date(today);
      d.setFullYear(d.getFullYear() - 1);
      return { from: isoDate(d) };
    }
    case "custom":
      return { from: customFrom || undefined, to: customTo || undefined };
    default:
      return {};
  }
}

const selectCls =
  "rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white";

function BreakdownChart({ kind, data, cur }: { kind: ChartKind; data: { name: string; total: number }[]; cur: string }) {
  if (data.length === 0) return <EmptyState icon={BarChart3} title="No data for this selection" />;
  if (kind === "bar") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--foreground)" strokeOpacity={0.1} />
          <XAxis type="number" tickFormatter={(v) => formatCurrency(Number(v), cur)} tick={{ fontSize: 11, fill: "var(--foreground)", fillOpacity: 0.6 }} axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.15 }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "var(--foreground)", fillOpacity: 0.6 }} axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.15 }} tickLine={false} />
          <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} />
          <Bar dataKey="total" radius={[0, 6, 6, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="name"
          innerRadius={kind === "donut" ? 60 : 0}
          outerRadius={95}
          paddingAngle={kind === "donut" ? 2 : 0}
        >
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} />
        <Legend wrapperStyle={{ color: "var(--foreground)", fontSize: 12, opacity: 0.8 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TrendChart({ kind, data, cur }: { kind: ChartKind; data: { month: string; income: number; expense: number }[]; cur: string }) {
  if (data.length === 0) return <EmptyState icon={BarChart3} title="No data for this selection" />;
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--foreground)" strokeOpacity={0.1} />
      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--foreground)", fillOpacity: 0.6 }} axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.15 }} tickLine={false} />
      <YAxis tickFormatter={(v) => formatCurrency(Number(v), cur)} tick={{ fontSize: 11, fill: "var(--foreground)", fillOpacity: 0.6 }} axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.15 }} tickLine={false} width={80} />
      <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} />
      <Legend wrapperStyle={{ color: "var(--foreground)", fontSize: 12, opacity: 0.8 }} />
    </>
  );
  if (kind === "bar") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          {common}
          <Bar dataKey="income" fill="#0EA5A5" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill="#C0392B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (kind === "area") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          {common}
          <Area type="monotone" dataKey="income" stroke="#0EA5A5" fill="#0EA5A5" fillOpacity={0.25} />
          <Area type="monotone" dataKey="expense" stroke="#C0392B" fill="#C0392B" fillOpacity={0.25} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        {common}
        <Line type="monotone" dataKey="income" stroke="#0EA5A5" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="expense" stroke="#C0392B" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface FilteredAnalytics extends AnalyticsSummary {
  totalIncome: number;
  totalExpense: number;
  totalSavings: number;
}

export default function AnalyticsPage() {
  const { settings } = useSettingsContext();
  const cur = settings.currency;

  const [range, setRange] = useState<RangeKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [paymentMethodTypeId, setPaymentMethodTypeId] = useState("");
  const [trendChart, setTrendChart] = useState<ChartKind>("line");
  const [breakdownChart, setBreakdownChart] = useState<ChartKind>("donut");
  const [metrics, setMetrics] = useState<Set<MetricId>>(new Set(METRIC_OPTIONS.map((m) => m.id)));
  const [exportOpen, setExportOpen] = useState(false);

  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const { data: paymentMethods } = usePaymentMethods();

  const { from, to } = useMemo(() => computeRange(range, customFrom, customTo), [range, customFrom, customTo]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (categoryId) p.set("categoryId", categoryId);
    if (accountId) p.set("accountId", accountId);
    if (paymentMethodTypeId) p.set("paymentMethodTypeId", paymentMethodTypeId);
    return p.toString();
  }, [from, to, categoryId, accountId, paymentMethodTypeId]);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", params],
    queryFn: () => api.get<FilteredAnalytics>(`/api/analytics/summary${params ? `?${params}` : ""}`),
  });

  const toggleMetric = useCallback((id: MetricId) => {
    setMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expenseData = (data?.categoryBreakdown ?? []).map((c) => ({ name: c.category, total: c.total }));
  const incomeData = (data?.incomeCategoryBreakdown ?? []).map((c) => ({ name: c.category, total: c.total }));
  const paymentData = (data?.paymentMethodBreakdown ?? []).map((p) => ({ name: p.method, total: p.total }));

  return (
    <>
      <Topbar title="Analytics" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        {/* Controls */}
        <Card className="mb-6">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Time Range</label>
                <select value={range} onChange={(e) => setRange(e.target.value as RangeKey)} className={selectCls}>
                  {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {range === "custom" && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">From</label>
                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={selectCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">To</label>
                    <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={selectCls} />
                  </div>
                </>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Category</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls}>
                  <option value="">All Categories</option>
                  {(categories?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Account</label>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectCls}>
                  <option value="">All Accounts</option>
                  {(accounts?.items ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Payment Method</label>
                <select value={paymentMethodTypeId} onChange={(e) => setPaymentMethodTypeId(e.target.value)} className={selectCls}>
                  <option value="">All Methods</option>
                  {(paymentMethods?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => setExportOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-medium text-navy transition-all hover:border-teal/50 dark:border-white/10 dark:text-white"
                >
                  <Download className="h-3.5 w-3.5" /> Export this view
                </button>
              </div>
            </div>

            {/* Metric toggles */}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-black/5 pt-4 dark:border-white/10">
              {METRIC_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggleMetric(m.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                    metrics.has(m.id)
                      ? "bg-teal/10 text-teal ring-1 ring-teal/40"
                      : "bg-black/5 text-navy/50 dark:bg-white/5 dark:text-white/50"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />)}
          </div>
        ) : !data ? (
          <Card><CardContent className="pt-5">
            <EmptyState icon={BarChart3} title="No analytics available" description="Add transaction data to see analytics." />
          </CardContent></Card>
        ) : (
          <>
            {metrics.has("kpis") && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <Card><CardContent className="flex items-center gap-3 pt-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal/10"><Hash className="h-5 w-5 text-teal" /></div>
                  <div><p className="text-xs text-navy/50">Transactions</p><p className="text-lg font-bold text-navy dark:text-white">{data.totalTransactions}</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-3 pt-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
                  <div><p className="text-xs text-navy/50">Income</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(data.totalIncome, cur)}</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-3 pt-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10"><TrendingDown className="h-5 w-5 text-red-500" /></div>
                  <div><p className="text-xs text-navy/50">Expenses</p><p className="text-lg font-bold text-red-500">{formatCurrency(data.totalExpense, cur)}</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-3 pt-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal/10"><Wallet className="h-5 w-5 text-teal" /></div>
                  <div><p className="text-xs text-navy/50">Savings</p><p className={cn("text-lg font-bold", data.totalSavings >= 0 ? "text-navy dark:text-white" : "text-red-500")}>{formatCurrency(data.totalSavings, cur)}</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-3 pt-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal/10"><TrendingUp className="h-5 w-5 text-teal" /></div>
                  <div><p className="text-xs text-navy/50">Avg Transaction</p><p className="text-lg font-bold text-navy dark:text-white">{formatCurrency(data.averageTransaction, cur)}</p></div>
                </CardContent></Card>
                <Card><CardContent className="flex items-center gap-3 pt-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal/10"><BarChart3 className="h-5 w-5 text-teal" /></div>
                  <div><p className="text-xs text-navy/50">Monthly Avg</p><p className="text-lg font-bold text-navy dark:text-white">{formatCurrency(data.averageMonthlyVolume, cur)}</p></div>
                </CardContent></Card>
              </div>
            )}

            {metrics.has("trend") && (
              <Card className="mt-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Income vs Expense Trend</CardTitle>
                  <div className="flex gap-1">
                    {TREND_CHART_OPTIONS.map((o) => (
                      <button key={o.value} onClick={() => setTrendChart(o.value)}
                        className={cn("rounded-lg px-2.5 py-1 text-xs font-medium", trendChart === o.value ? "bg-teal/10 text-teal" : "text-navy/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5")}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <TrendChart kind={trendChart} data={data.monthlyTrend} cur={cur} />
                </CardContent>
              </Card>
            )}

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {metrics.has("expense-breakdown") && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Expense by Category</CardTitle>
                    <div className="flex gap-1">
                      {BREAKDOWN_CHART_OPTIONS.map((o) => (
                        <button key={o.value} onClick={() => setBreakdownChart(o.value)}
                          className={cn("rounded-lg px-2.5 py-1 text-xs font-medium", breakdownChart === o.value ? "bg-teal/10 text-teal" : "text-navy/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5")}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <BreakdownChart kind={breakdownChart} data={expenseData} cur={cur} />
                  </CardContent>
                </Card>
              )}

              {metrics.has("income-breakdown") && (
                <Card>
                  <CardHeader><CardTitle>Income by Category</CardTitle></CardHeader>
                  <CardContent>
                    <BreakdownChart kind={breakdownChart} data={incomeData} cur={cur} />
                  </CardContent>
                </Card>
              )}

              {metrics.has("payment-methods") && (
                <Card>
                  <CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
                  <CardContent>
                    <BreakdownChart kind={breakdownChart} data={paymentData} cur={cur} />
                  </CardContent>
                </Card>
              )}
            </div>

            {metrics.has("monthly-table") && (
              <Card className="mt-6">
                <CardHeader><CardTitle>Monthly Detail</CardTitle></CardHeader>
                <CardContent>
                  {data.monthlyTrend.length === 0 ? (
                    <EmptyState icon={BarChart3} title="No monthly data" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
                            <th className="pb-2 font-medium">Month</th>
                            <th className="pb-2 font-medium">Income</th>
                            <th className="pb-2 font-medium">Expense</th>
                            <th className="pb-2 font-medium">Net</th>
                            <th className="pb-2 font-medium">Transactions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.monthlyTrend.map((m) => (
                            <tr key={m.month} className="border-b border-black/5 dark:border-white/5">
                              <td className="py-2 font-medium text-navy dark:text-white">{m.month}</td>
                              <td className="py-2 text-emerald-600">{formatCurrency(m.income, cur)}</td>
                              <td className="py-2 text-red-500">{formatCurrency(m.expense, cur)}</td>
                              <td className={cn("py-2 font-medium", m.income - m.expense >= 0 ? "text-emerald-600" : "text-red-500")}>{formatCurrency(m.income - m.expense, cur)}</td>
                              <td className="py-2 text-navy/70">{m.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
      <ExportPreviewModal isOpen={exportOpen} onClose={() => setExportOpen(false)} range={{ from, to }} />
    </>
  );
}
