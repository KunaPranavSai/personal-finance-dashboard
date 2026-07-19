"use client";

import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { AnalyticsSummary } from "@/types";
import { BarChart3, TrendingUp, TrendingDown, Hash } from "lucide-react";

export default function AnalyticsPage() {
  const { settings } = useSettingsContext();
  const cur = settings.currency;
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api.get<AnalyticsSummary>("/api/analytics/summary"),
  });

  if (isLoading) {
    return (
      <>
        <Topbar title="Analytics" />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />)}
          </div>
          <div className="mt-6 h-80 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Topbar title="Analytics" />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Card><CardContent className="pt-5">
            <EmptyState icon={BarChart3} title="No analytics available" description="Add transaction data to see analytics." />
          </CardContent></Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar title="Analytics" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10"><Hash className="h-6 w-6 text-teal" /></div>
            <div><p className="text-xs text-navy/50">Total Transactions</p><p className="text-xl font-bold text-navy dark:text-white">{data.totalTransactions}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10"><TrendingUp className="h-6 w-6 text-teal" /></div>
            <div><p className="text-xs text-navy/50">Average Transaction</p><p className="text-xl font-bold text-navy dark:text-white">{formatCurrency(data.averageTransaction, cur)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10"><TrendingDown className="h-6 w-6 text-teal" /></div>
            <div><p className="text-xs text-navy/50">Avg Monthly Volume</p><p className="text-xl font-bold text-navy dark:text-white">{formatCurrency(data.averageMonthlyVolume, cur)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10"><BarChart3 className="h-6 w-6 text-teal" /></div>
            <div><p className="text-xs text-navy/50">Categories Active</p><p className="text-xl font-bold text-navy dark:text-white">{data.categoryBreakdown.length}</p></div>
          </CardContent></Card>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Expense Breakdown</CardTitle></CardHeader>
            <CardContent>
              {data.categoryBreakdown.length === 0 ? (
                <EmptyState icon={BarChart3} title="No category data" />
              ) : (
                <div className="space-y-3">
                  {data.categoryBreakdown.map((c) => (
                    <div key={c.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-navy dark:text-white">{c.category}</span>
                        <span className="text-navy/50">{formatCurrency(c.total, cur)} ({c.count} txns)</span>
                      </div>
                      <div className="h-2 rounded-full bg-black/5 dark:bg-white/5">
                        <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${Math.min((c.total / Math.max(...data.categoryBreakdown.map((x) => x.total))) * 100, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Income Breakdown</CardTitle></CardHeader>
            <CardContent>
              {data.incomeCategoryBreakdown.length === 0 ? (
                <EmptyState icon={BarChart3} title="No income data" />
              ) : (
                <div className="space-y-3">
                  {data.incomeCategoryBreakdown.map((c) => (
                    <div key={c.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-navy dark:text-white">{c.category}</span>
                        <span className="text-navy/50">{formatCurrency(c.total, cur)} ({c.count} txns)</span>
                      </div>
                      <div className="h-2 rounded-full bg-black/5 dark:bg-white/5">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min((c.total / Math.max(...data.incomeCategoryBreakdown.map((x) => x.total))) * 100, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
          <CardContent>
            {data.paymentMethodBreakdown.length === 0 ? (
              <EmptyState icon={BarChart3} title="No payment method data" />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.paymentMethodBreakdown.map((p) => (
                  <div key={p.method} className="flex justify-between text-sm">
                    <span className="text-navy dark:text-white capitalize">{p.method.toLowerCase().replace(/_/g, " ")}</span>
                    <span className="text-navy/50">{formatCurrency(p.total, cur)} ({p.count} txns)</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader><CardTitle>Monthly Trend</CardTitle></CardHeader>
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
                      <th className="pb-2 font-medium">Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthlyTrend.map((m) => (
                      <tr key={m.month} className="border-b border-black/5 dark:border-white/5">
                        <td className="py-2 font-medium text-navy dark:text-white">{m.month}</td>
                        <td className="py-2 text-emerald-600">{formatCurrency(m.income, cur)}</td>
                        <td className="py-2 text-red-500">{formatCurrency(m.expense, cur)}</td>
                        <td className="py-2 text-navy/70">{m.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
