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
import { useIsMobile } from "@/lib/DeviceContext";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";

export default function SavingsPage() {
  const { settings } = useSettingsContext();
  const cur = settings.currency;
  const isMobile = useIsMobile();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["savings"],
    queryFn: () => api.get<SavingsSummary>("/api/savings"),
  });

  if (isMobile) {
    return (
      <MobileShell title="Savings">
        <div className="ppm-page-title">
          <h2>Savings</h2>
          <p>Income vs. expense, over time</p>
        </div>

        {isLoading && (
          <div className="ppm-stack">
            <LoadingCard lines={1} />
            <LoadingCard lines={4} />
          </div>
        )}

        {(error) && !isLoading && <ErrorCard onRetry={() => refetch()} />}

        {!isLoading && !error && data && data.totalIncome === 0 && data.totalExpenses === 0 && (
          <EmptyCard icon={<PiggyBank size={22} />} title="No transaction data yet" subtitle="Add some income and expense transactions to see your savings breakdown." />
        )}

        {!isLoading && !error && data && (data.totalIncome > 0 || data.totalExpenses > 0) && (
          <>
            <div className="ppm-card">
              <div className="ppm-cat-row">
                <div className="ppm-ic" aria-hidden="true"><Wallet size={18} /></div>
                <div className="ppm-info"><div className="ppm-name">Total Income</div></div>
                <div className="ppm-amt pos">{formatCurrency(data.totalIncome, cur)}</div>
              </div>
              <div className="ppm-cat-row">
                <div className="ppm-ic" aria-hidden="true"><TrendingDown size={18} /></div>
                <div className="ppm-info"><div className="ppm-name">Total Expenses</div></div>
                <div className="ppm-amt neg">{formatCurrency(data.totalExpenses, cur)}</div>
              </div>
              <div className="ppm-cat-row">
                <div className="ppm-ic" aria-hidden="true"><PiggyBank size={18} /></div>
                <div className="ppm-info">
                  <div className="ppm-name">Total Savings</div>
                  <div className="ppm-meta">Rate: {formatPercent(data.savingsRate)}</div>
                </div>
                <div className={`ppm-amt ${data.totalSavings >= 0 ? "pos" : "neg"}`}>{formatCurrency(data.totalSavings, cur)}</div>
              </div>
            </div>

            <div className="ppm-card" style={{ marginTop: 14 }}>
              <div className="ppm-section-label">Monthly Savings Trend</div>
              {data.monthlyTrend.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>No monthly data yet.</p>
              ) : (
                data.monthlyTrend.map((m) => (
                  <div className="ppm-cat-row" key={m.month}>
                    <div className="ppm-info">
                      <div className="ppm-name">{m.month}</div>
                      <div className="ppm-meta">In {formatCurrency(m.income, cur)} · Out {formatCurrency(m.expense, cur)}</div>
                    </div>
                    <div className={`ppm-amt ${m.savings >= 0 ? "pos" : "neg"}`}>{formatCurrency(m.savings, cur)}</div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </MobileShell>
    );
  }

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
