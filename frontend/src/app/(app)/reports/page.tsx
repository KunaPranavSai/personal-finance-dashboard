"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Topbar } from "@/components/layout/AppTopbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/PpCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { getLocalMonthlyReport, getLocalCategoryReport, getLocalBudgetReport } from "@/lib/services/reportsService";
import { formatCurrency } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { ReportItem } from "@/types";
import { CustomExportSheet } from "@/components/reports/CustomExportSheet";
import { FileText, Download, TrendingUp, TrendingDown, Printer } from "lucide-react";
import { cn } from "@/lib/format";
import { useIsMobile } from "@/lib/DeviceContext";
import { MobileReportsView } from "@/components/mobile/MobileReportsView";

function DeltaBadge({ label, pct }: { label: string; pct: number | null }) {
  if (pct === null || !Number.isFinite(pct)) return null;
  const positive = pct >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        positive ? "bg-mantis/10 text-mantis dark:text-mantis" : "bg-vulcanico/10 text-vulcanico dark:text-vulcanico"
      )}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}{pct.toFixed(1)}% {label}
    </span>
  );
}

export default function ReportsPage() {
  const [exportOpen, setExportOpen] = useState(false);
  const { settings } = useSettingsContext();
  const cur = settings.currency;
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<"monthly" | "categories" | "budgets">("monthly");

  const { data: monthly, isLoading: loadingMonthly } = useQuery({
    queryKey: ["reports-monthly"],
    queryFn: () => (getStorageMode() === "local" ? getLocalMonthlyReport() : api.get<{ items: ReportItem[] }>("/api/reports/monthly")),
    enabled: tab === "monthly",
  });

  // Executive summary + MoM/YoY deltas, derived from the same monthly report
  // rows already fetched above (assumed sorted ascending by "YYYY-MM" month).
  const summary = (() => {
    const items = monthly?.items ?? [];
    if (items.length === 0) return null;
    const latest = items[items.length - 1];
    const prevMonth = items.length >= 2 ? items[items.length - 2] : undefined;
    const [ly, lm] = latest.month.split("-").map(Number);
    const yearAgoKey = `${ly - 1}-${String(lm).padStart(2, "0")}`;
    const yearAgo = items.find((i) => i.month === yearAgoKey);

    const net = latest.income - latest.expense;
    const savingsRate = latest.income > 0 ? (net / latest.income) * 100 : 0;
    const pctChange = (a: number, b: number | undefined) => (b === undefined || b === 0 ? null : ((a - b) / b) * 100);

    return {
      latest, net, savingsRate,
      momSavings: pctChange(net, prevMonth ? prevMonth.income - prevMonth.expense : undefined),
      momOverhead: pctChange(latest.expense, prevMonth?.expense),
      yoySavings: pctChange(net, yearAgo ? yearAgo.income - yearAgo.expense : undefined),
      yoyOverhead: pctChange(latest.expense, yearAgo?.expense),
    };
  })();

  const { data: categories, isLoading: loadingCats } = useQuery({
    queryKey: ["reports-categories"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getLocalCategoryReport()
        : api.get<{ items: { category: string; total: number; count: number }[] }>("/api/reports/categories"),
    enabled: tab === "categories",
  });

  const { data: budgets, isLoading: loadingBudgets } = useQuery({
    queryKey: ["reports-budgets"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getLocalBudgetReport()
        : api.get<{ items: { category: string; budgeted: number; actual: number; variance: number }[] }>("/api/reports/budgets"),
    enabled: tab === "budgets",
  });

  const tabs = [
    { key: "monthly", label: "Monthly Summary" },
    { key: "categories", label: "Category Report" },
    { key: "budgets", label: "Budget vs Actual" },
  ] as const;

  if (isMobile) return <MobileReportsView />;

  return (
    <>
      <Topbar title="Reports" />
      <CustomExportSheet open={exportOpen} onClose={() => setExportOpen(false)} />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 2xl:px-10">
        <div className="mb-6 flex flex-wrap justify-end gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-pp-border px-3 py-2 text-xs font-medium text-pp-text transition-all hover:border-pp-accent/50 "
          >
            <Printer className="h-3.5 w-3.5" /> Print summary
          </button>
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-pp-accent px-3 py-2 text-xs font-semibold text-white transition-all hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" /> Custom Export
          </button>
        </div>

        {/* Executive summary: this month's headline figures plus MoM/YoY
            delta badges, derived from the same monthly report rows below. */}
        {summary && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Monthly Financial Statement — {summary.latest.month}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-pp-text-dim">Gross Income</p>
                  <p className="text-lg font-bold text-mantis">{formatCurrency(summary.latest.income, cur)}</p>
                </div>
                <div>
                  <p className="text-xs text-pp-text-dim">Total Overhead</p>
                  <p className="text-lg font-bold text-vulcanico">{formatCurrency(summary.latest.expense, cur)}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <DeltaBadge label="MoM" pct={summary.momOverhead === null ? null : -summary.momOverhead} />
                    <DeltaBadge label="YoY" pct={summary.yoyOverhead === null ? null : -summary.yoyOverhead} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-pp-text-dim">Net Savings</p>
                  <p className={cn("text-lg font-bold", summary.net >= 0 ? "text-pp-text" : "text-vulcanico")}>{formatCurrency(summary.net, cur)}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <DeltaBadge label="MoM" pct={summary.momSavings} />
                    <DeltaBadge label="YoY" pct={summary.yoySavings} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-pp-text-dim">Net Savings Rate</p>
                  <p className="text-lg font-bold text-pp-text">{summary.savingsRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-4">
          <div className="flex gap-2 border-b border-pp-border" role="tablist" aria-label="Report sections">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                className={`min-h-[40px] px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? "border-b-2 border-pp-accent text-pp-accent" : "text-pp-text-dim hover:text-pp-text/50"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "monthly" && (
          <Card>
            <CardHeader><CardTitle>Monthly Income & Expense Report</CardTitle></CardHeader>
            <CardContent>
              {loadingMonthly ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-pp-surface-2" />)}</div>
              ) : !monthly?.items?.length ? (
                <EmptyState icon={FileText} title="No report data available" description="Add transactions to generate reports." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-pp-border text-left text-pp-text-dim">
                        <th className="pb-2 font-medium">Month</th>
                        <th className="pb-2 font-medium">Income</th>
                        <th className="pb-2 font-medium">Expense</th>
                        <th className="pb-2 font-medium">Transactions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.items.map((r) => (
                        <tr key={r.month} className="border-b border-pp-border dark:border-white/5">
                          <td className="py-2 font-medium text-pp-text">{r.month}</td>
                          <td className="py-2 text-mantis">{formatCurrency(r.income, cur)}</td>
                          <td className="py-2 text-vulcanico">{formatCurrency(r.expense, cur)}</td>
                          <td className="py-2 text-pp-text-dim">{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "categories" && (
          <Card>
            <CardHeader><CardTitle>Category-wise Expense Report</CardTitle></CardHeader>
            <CardContent>
              {loadingCats ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-pp-surface-2" />)}</div>
              ) : !categories?.items?.length ? (
                <EmptyState icon={FileText} title="No category data" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-pp-border text-left text-pp-text-dim">
                        <th className="pb-2 font-medium">Category</th>
                        <th className="pb-2 font-medium">Total Spent</th>
                        <th className="pb-2 font-medium">Transactions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.items.map((c) => (
                        <tr key={c.category} className="border-b border-pp-border dark:border-white/5">
                          <td className="py-2 font-medium text-pp-text">{c.category}</td>
                          <td className="py-2 text-vulcanico">{formatCurrency(c.total, cur)}</td>
                          <td className="py-2 text-pp-text-dim">{c.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "budgets" && (
          <Card>
            <CardHeader><CardTitle>Budget vs Actual Report</CardTitle></CardHeader>
            <CardContent>
              {loadingBudgets ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-pp-surface-2" />)}</div>
              ) : !budgets?.items?.length ? (
                <EmptyState icon={FileText} title="No budget data" description="Set budgets to compare against actual spending." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-pp-border text-left text-pp-text-dim">
                        <th className="pb-2 font-medium">Category</th>
                        <th className="pb-2 font-medium">Budgeted</th>
                        <th className="pb-2 font-medium">Actual</th>
                        <th className="pb-2 font-medium">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgets.items.map((b) => (
                        <tr key={b.category} className="border-b border-pp-border dark:border-white/5">
                          <td className="py-2 font-medium text-pp-text">{b.category}</td>
                          <td className="py-2 text-pp-text">{formatCurrency(b.budgeted, cur)}</td>
                          <td className="py-2 text-vulcanico">{formatCurrency(b.actual, cur)}</td>
                          <td className={`py-2 font-medium ${b.variance <= 0 ? "text-mantis" : "text-vulcanico"}`}>
                            {b.variance > 0 ? "+" : ""}{formatCurrency(b.variance, cur)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
