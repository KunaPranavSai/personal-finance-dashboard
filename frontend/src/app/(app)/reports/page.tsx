"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { ReportItem } from "@/types";
import { FileText, Download } from "lucide-react";

export default function ReportsPage() {
  const { settings } = useSettingsContext();
  const cur = settings.currency;
  const [tab, setTab] = useState<"monthly" | "categories" | "budgets">("monthly");

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

  return (
    <>
      <Topbar title="Reports" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mb-6 flex justify-end">
          <Link
            href="/settings?tab=export"
            className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-medium text-navy transition-all hover:border-teal/50 dark:border-white/10 dark:text-white"
          >
            <Download className="h-3.5 w-3.5" /> Export data
          </Link>
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
                          <td className="py-2 text-navy/70 dark:text-white/70">{r.count}</td>
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
                          <td className="py-2 text-navy/70 dark:text-white/70">{c.count}</td>
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
