"use client";

import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard } from "@/components/kpi/KpiCard";
import { IncomeExpenseChart } from "@/components/charts/IncomeExpenseChart";
import { CategoryDonutChart } from "@/components/charts/CategoryDonutChart";
import { FinancialHealthGauge } from "@/components/charts/FinancialHealthGauge";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { DashboardSummary } from "@/types";
import {
  Wallet, TrendingDown, PiggyBank, Activity, Landmark, Gauge,
  HeartPulse, ShieldCheck, TrendingUp, ArrowLeftRight, Receipt, BarChart3,
} from "lucide-react";

export default function DashboardPage() {
  const { settings } = useSettingsContext();
  const cur = settings.currency;
  const f = (v: number) => formatCurrency(v, cur);
  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get<DashboardSummary>("/api/dashboard/summary"),
  });

  const { data: trend } = useQuery({
    queryKey: ["income-expense-trend"],
    queryFn: () => api.get<{ items: { month: string; type: string; total: string }[] }>(
      "/api/dashboard/trend/income-expense"
    ),
  });

  const { data: breakdown } = useQuery({
    queryKey: ["category-breakdown"],
    queryFn: () => api.get<{ items: { category: string; total: number }[] }>(
      "/api/dashboard/breakdown/category"
    ),
  });

  const trendByMonth = new Map<string, { month: string; income: number; expense: number }>();
  (trend?.items ?? []).forEach((row) => {
    const entry = trendByMonth.get(row.month) ?? { month: row.month, income: 0, expense: 0 };
    if (row.type === "INCOME") entry.income = Number(row.total);
    else entry.expense = Number(row.total);
    trendByMonth.set(row.month, entry);
  });
  const trendData = Array.from(trendByMonth.values()).sort((a, b) => a.month.localeCompare(b.month));

  const hasError = !summary && !isLoading;

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />
            ))}
          </div>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-sm font-semibold text-navy dark:text-white">Could not load dashboard</p>
            <p className="text-sm text-navy/50 dark:text-white/50">Try refreshing the page.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              <KpiCard label="Total Income" value={f(summary?.kpis?.totalIncome ?? 0)} icon={Wallet}
                changePct={summary?.kpis?.changeVsPrevMonth?.income} />
              <KpiCard label="Total Expenses" value={f(summary?.kpis?.totalExpenses ?? 0)} icon={TrendingDown}
                changePct={summary?.kpis ? -summary.kpis.changeVsPrevMonth.expense : null} tone="negative" />
              <KpiCard label="Total Savings" value={f(summary?.kpis?.totalSavings ?? 0)} icon={PiggyBank} />
              <KpiCard label="Cash Flow" value={f(summary?.kpis?.cashFlow ?? 0)} icon={Activity} />
              <KpiCard label="Net Worth" value={f(summary?.kpis?.netWorth ?? 0)} icon={Landmark} />
              <KpiCard label="Savings Rate" value={formatPercent(summary?.kpis?.savingsRatePct ?? 0)} icon={PiggyBank} />
              <KpiCard label="Budget Usage" value={formatPercent(summary?.kpis?.budgetUtilizationPct ?? 0)} icon={Gauge} />
              <KpiCard label="Financial Health" value={String(summary?.kpis?.financialHealthScore ?? 0)} icon={HeartPulse} />
              <KpiCard label="Emergency Fund" value={formatPercent(summary?.kpis?.emergencyFundProgressPct ?? 0)} icon={ShieldCheck} />
              <KpiCard label="Investments" value={f(summary?.kpis?.investmentGrowth ?? 0)} icon={TrendingUp} />
              <KpiCard label="Transactions" value={String(summary?.kpis?.transactionCount ?? 0)} icon={ArrowLeftRight} />
              <KpiCard label="Avg Transaction" value={f(summary?.kpis?.avgTransactionAmount ?? 0)} icon={Receipt} />
            </div>

            {trendData.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <IncomeExpenseChart data={trendData} />
                </div>
                <FinancialHealthGauge score={summary?.kpis?.financialHealthScore ?? 0} />
              </div>
            )}

            {breakdown?.items && breakdown.items.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <CategoryDonutChart data={breakdown.items} />
              </div>
            )}

            {!trendData.length && !breakdown?.items?.length && (
              <div className="mt-10">
                <p className="text-center text-sm text-navy/40 dark:text-white/40">Add transactions to see charts and trends.</p>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
