"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { useToast } from "@/components/ui/Toast";
import { downloadExport } from "@/lib/export";
import { ReportItem } from "@/types";
import { FileText, Download } from "lucide-react";

export default function ReportsPage() {
  const { settings } = useSettingsContext();
  const { toast } = useToast();
  const cur = settings.currency;
  const [tab, setTab] = useState<"monthly" | "categories" | "budgets">("monthly");
  const [exporting, setExporting] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleExport = useCallback(async (format: string) => {
    setExporting(format);
    try {
      await downloadExport(format, toast, { from: dateFrom || undefined, to: dateTo || undefined });
    } finally {
      setExporting(null);
    }
  }, [toast, dateFrom, dateTo]);

  const { data: monthly, isLoading: loadingMonthly } = useQuery({
    queryKey: ["reports-monthly"],
    queryFn: () => api.get<{ items: ReportItem[] }>("/api/reports/monthly"),
    enabled: tab === "monthly",
  });

  const { data: categories, isLoading: loadingCats } = useQuery({
    queryKey: ["reports-categories"],
    queryFn: () => api.get<{ items: { category: string; total: number; count: number }[] }>("/api/reports/categories"),
    enabled: tab === "categories",
  });

  const { data: budgets, isLoading: loadingBudgets } = useQuery({
    queryKey: ["reports-budgets"],
    queryFn: () => api.get<{ items: { category: string; budgeted: number; actual: number; variance: number }[] }>("/api/reports/budgets"),
    enabled: tab === "budgets",
  });

  const tabs = [
    { key: "monthly", label: "Monthly Summary" },
    { key: "categories", label: "Category Report" },
    { key: "budgets", label: "Budget vs Actual" },
  ] as const;

  const formats = [
    { id: "csv", label: "CSV" },
    { id: "excel", label: "Excel" },
    { id: "json", label: "JSON" },
    { id: "pdf", label: "PDF" },
  ];

  return (
    <>
      <Topbar title="Reports" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="pb-1.5 text-xs text-navy/50 hover:text-navy dark:text-white/50 dark:hover:text-white">
              Clear range
            </button>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => handleExport(fmt.id)}
              disabled={exporting !== null}
              className={cn(
                "flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all",
                exporting === fmt.id
                  ? "border-teal bg-teal/10 text-teal animate-pulse"
                  : exporting !== null
                  ? "border-black/5 bg-black/2 text-navy/30 dark:border-white/5 dark:bg-white/2 dark:text-white/30 cursor-not-allowed"
                  : "border-black/10 text-navy hover:border-teal/50 hover:bg-teal/5 dark:border-white/10 dark:text-white dark:hover:border-teal/50"
              )}
            >
              {exporting === fmt.id ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Download className="h-4 w-4" />
              )}
              {fmt.label}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <div className="flex gap-2 border-b border-black/5 dark:border-white/10">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? "border-b-2 border-teal text-teal" : "text-navy/50 hover:text-navy dark:text-white/50"}`}>
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
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
              ) : !monthly?.items?.length ? (
                <EmptyState icon={FileText} title="No report data available" description="Add transactions to generate reports." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
                        <th className="pb-2 font-medium">Month</th>
                        <th className="pb-2 font-medium">Income</th>
                        <th className="pb-2 font-medium">Expense</th>
                        <th className="pb-2 font-medium">Transactions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.items.map((r) => (
                        <tr key={r.month} className="border-b border-black/5 dark:border-white/5">
                          <td className="py-2 font-medium text-navy dark:text-white">{r.month}</td>
                          <td className="py-2 text-emerald-600">{formatCurrency(r.income, cur)}</td>
                          <td className="py-2 text-red-500">{formatCurrency(r.expense, cur)}</td>
                          <td className="py-2 text-navy/70">{r.count}</td>
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
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
              ) : !categories?.items?.length ? (
                <EmptyState icon={FileText} title="No category data" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
                        <th className="pb-2 font-medium">Category</th>
                        <th className="pb-2 font-medium">Total Spent</th>
                        <th className="pb-2 font-medium">Transactions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.items.map((c) => (
                        <tr key={c.category} className="border-b border-black/5 dark:border-white/5">
                          <td className="py-2 font-medium text-navy dark:text-white">{c.category}</td>
                          <td className="py-2 text-red-500">{formatCurrency(c.total, cur)}</td>
                          <td className="py-2 text-navy/70">{c.count}</td>
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
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
              ) : !budgets?.items?.length ? (
                <EmptyState icon={FileText} title="No budget data" description="Set budgets to compare against actual spending." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
                        <th className="pb-2 font-medium">Category</th>
                        <th className="pb-2 font-medium">Budgeted</th>
                        <th className="pb-2 font-medium">Actual</th>
                        <th className="pb-2 font-medium">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgets.items.map((b) => (
                        <tr key={b.category} className="border-b border-black/5 dark:border-white/5">
                          <td className="py-2 font-medium text-navy dark:text-white">{b.category}</td>
                          <td className="py-2 text-navy dark:text-white">{formatCurrency(b.budgeted, cur)}</td>
                          <td className="py-2 text-red-500">{formatCurrency(b.actual, cur)}</td>
                          <td className={`py-2 font-medium ${b.variance <= 0 ? "text-emerald-600" : "text-red-500"}`}>
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
