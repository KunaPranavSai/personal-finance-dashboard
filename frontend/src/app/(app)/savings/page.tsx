"use client";

import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { SavingsSummary } from "@/types";
import { PiggyBank, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export default function SavingsPage() {
  const { settings } = useSettingsContext();
  const cur = settings.currency;
  const { data, isLoading, error } = useQuery({
    queryKey: ["savings"],
    queryFn: () => api.get<SavingsSummary>("/api/savings"),
  });

  if (isLoading) {
    return (
      <>
        <Topbar title="Savings" />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />
            ))}
          </div>
        </main>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Topbar title="Savings" />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Card><CardContent className="pt-5">
            <EmptyState icon={PiggyBank} title="Could not load savings data" description="Try again later." />
          </CardContent></Card>
        </main>
      </>
    );
  }

  if (data.totalIncome === 0 && data.totalExpenses === 0) {
    return (
      <>
        <Topbar title="Savings" />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Card><CardContent className="pt-5">
            <EmptyState icon={PiggyBank} title="No transaction data yet"
              description="Add some income and expense transactions to see your savings breakdown." />
          </CardContent></Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar title="Savings" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 pt-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10">
                <Wallet className="h-6 w-6 text-teal" />
              </div>
              <div>
                <p className="text-xs text-navy/50 dark:text-white/50">Total Income</p>
                <p className="text-xl font-bold text-navy dark:text-white">{formatCurrency(data.totalIncome, cur)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
                <TrendingDown className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-navy/50 dark:text-white/50">Total Expenses</p>
                <p className="text-xl font-bold text-navy dark:text-white">{formatCurrency(data.totalExpenses, cur)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-navy/50 dark:text-white/50">Total Savings</p>
                <p className="text-xl font-bold text-navy dark:text-white">{formatCurrency(data.totalSavings, cur)}</p>
                <p className="text-xs text-navy/40 dark:text-white/40">Rate: {formatPercent(data.savingsRate)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader><CardTitle>Monthly Savings Trend</CardTitle></CardHeader>
          <CardContent>
            {data.monthlyTrend.length === 0 ? (
              <EmptyState icon={PiggyBank} title="No monthly data" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
                      <th className="pb-2 font-medium">Month</th>
                      <th className="pb-2 font-medium">Income</th>
                      <th className="pb-2 font-medium">Expense</th>
                      <th className="pb-2 font-medium">Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthlyTrend.map((m) => (
                      <tr key={m.month} className="border-b border-black/5 dark:border-white/5">
                        <td className="py-2 text-navy dark:text-white">{m.month}</td>
                        <td className="py-2 text-emerald-600">{formatCurrency(m.income, cur)}</td>
                        <td className="py-2 text-red-500">{formatCurrency(m.expense, cur)}</td>
                        <td className={`py-2 font-medium ${m.savings >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {formatCurrency(m.savings, cur)}
                        </td>
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
