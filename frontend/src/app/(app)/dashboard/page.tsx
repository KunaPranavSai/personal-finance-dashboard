"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard } from "@/components/kpi/KpiCard";
import { KpiDetailDrawer, KpiDetailData } from "@/components/kpi/KpiDetailDrawer";
import { IncomeExpenseChart } from "@/components/charts/IncomeExpenseChart";
import { CategoryDonutChart } from "@/components/charts/CategoryDonutChart";
import { FinancialHealthGauge } from "@/components/charts/FinancialHealthGauge";
import { WelcomeTour } from "@/components/ui/WelcomeTour";
import { TwoFactorPromptModal } from "@/components/ui/TwoFactorPromptModal";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { DashboardSummary } from "@/types";
import {
  Wallet, TrendingDown, PiggyBank, Activity, Landmark, Gauge,
  HeartPulse, ShieldCheck, TrendingUp, ArrowLeftRight, Receipt, BarChart3,
} from "lucide-react";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { twoFactorEnabled } = useAuth();
  const [showTour, setShowTour] = useState(false);
  const [show2FAPrompt, setShow2FAPrompt] = useState(false);
  const [isWelcome, setIsWelcome] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<KpiDetailData | null>(null);

  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      setShowTour(true);
      setIsWelcome(true);
      router.replace("/dashboard");
    }
  }, [searchParams, router]);

  const handleTourClose = () => {
    setShowTour(false);
    if (isWelcome && !twoFactorEnabled) setShow2FAPrompt(true);
  };

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
                changePct={summary?.kpis?.changeVsPrevMonth?.income}
                onClick={() => setSelectedKpi({
                  label: "Total Income", value: f(summary?.kpis?.totalIncome ?? 0), icon: Wallet,
                  changePct: summary?.kpis?.changeVsPrevMonth?.income,
                  description: "All money coming in this month, compared to last month.",
                  actions: [{ label: "View Income", href: "/income" }],
                })} />
              <KpiCard label="Total Expenses" value={f(summary?.kpis?.totalExpenses ?? 0)} icon={TrendingDown}
                changePct={summary?.kpis ? -summary.kpis.changeVsPrevMonth.expense : null} tone="negative"
                onClick={() => setSelectedKpi({
                  label: "Total Expenses", value: f(summary?.kpis?.totalExpenses ?? 0), icon: TrendingDown, tone: "negative",
                  changePct: summary?.kpis ? -summary.kpis.changeVsPrevMonth.expense : null,
                  description: "Everything you've spent this month, compared to last month.",
                  actions: [{ label: "View Expenses", href: "/expenses" }],
                })} />
              <KpiCard label="Total Savings" value={f(summary?.kpis?.totalSavings ?? 0)} icon={PiggyBank}
                onClick={() => setSelectedKpi({
                  label: "Total Savings", value: f(summary?.kpis?.totalSavings ?? 0), icon: PiggyBank,
                  description: "Income minus expenses this month.",
                  actions: [{ label: "View Savings", href: "/savings" }],
                })} />
              <KpiCard label="Cash Flow" value={f(summary?.kpis?.cashFlow ?? 0)} icon={Activity}
                onClick={() => setSelectedKpi({
                  label: "Cash Flow", value: f(summary?.kpis?.cashFlow ?? 0), icon: Activity,
                  description: "Net movement of money in and out of your accounts this month.",
                  actions: [{ label: "View Analytics", href: "/analytics" }],
                })} />
              <KpiCard label="Net Worth" value={f(summary?.kpis?.netWorth ?? 0)} icon={Landmark}
                onClick={() => setSelectedKpi({
                  label: "Net Worth", value: f(summary?.kpis?.netWorth ?? 0), icon: Landmark,
                  description: "Your total savings plus investments, minus nothing owed.",
                  actions: [{ label: "View Investments", href: "/investments" }],
                })} />
              <KpiCard label="Savings Rate" value={formatPercent(summary?.kpis?.savingsRatePct ?? 0)} icon={PiggyBank}
                onClick={() => setSelectedKpi({
                  label: "Savings Rate", value: formatPercent(summary?.kpis?.savingsRatePct ?? 0), icon: PiggyBank,
                  description: "The share of your income you kept as savings this month.",
                  actions: [{ label: "View Savings", href: "/savings" }],
                })} />
              <KpiCard label="Budget Usage" value={formatPercent(summary?.kpis?.budgetUtilizationPct ?? 0)} icon={Gauge}
                onClick={() => setSelectedKpi({
                  label: "Budget Usage", value: formatPercent(summary?.kpis?.budgetUtilizationPct ?? 0), icon: Gauge,
                  description: "How much of your monthly budget you've used so far.",
                  actions: [{ label: "View Budgets", href: "/budget" }],
                })} />
              <KpiCard label="Financial Health" value={String(summary?.kpis?.financialHealthScore ?? 0)} icon={HeartPulse}
                onClick={() => setSelectedKpi({
                  label: "Financial Health", value: String(summary?.kpis?.financialHealthScore ?? 0), icon: HeartPulse,
                  description: "An overall score combining your savings rate, budget discipline, and emergency fund progress.",
                  actions: [{ label: "View Analytics", href: "/analytics" }],
                })} />
              <KpiCard label="Emergency Fund" value={formatPercent(summary?.kpis?.emergencyFundProgressPct ?? 0)} icon={ShieldCheck}
                onClick={() => setSelectedKpi({
                  label: "Emergency Fund", value: formatPercent(summary?.kpis?.emergencyFundProgressPct ?? 0), icon: ShieldCheck,
                  description: "Progress toward your emergency fund goal.",
                  actions: [{ label: "View Goals", href: "/goals" }],
                })} />
              <KpiCard label="Investments" value={f(summary?.kpis?.investmentGrowth ?? 0)} icon={TrendingUp}
                onClick={() => setSelectedKpi({
                  label: "Investments", value: f(summary?.kpis?.investmentGrowth ?? 0), icon: TrendingUp,
                  description: "Growth across your tracked investments this month.",
                  actions: [{ label: "View Investments", href: "/investments" }],
                })} />
              <KpiCard label="Transactions" value={String(summary?.kpis?.transactionCount ?? 0)} icon={ArrowLeftRight}
                onClick={() => setSelectedKpi({
                  label: "Transactions", value: String(summary?.kpis?.transactionCount ?? 0), icon: ArrowLeftRight,
                  description: "Total expense and income entries logged this month.",
                  actions: [{ label: "View Expenses", href: "/expenses" }, { label: "View Income", href: "/income" }],
                })} />
              <KpiCard label="Avg Transaction" value={f(summary?.kpis?.avgTransactionAmount ?? 0)} icon={Receipt}
                onClick={() => setSelectedKpi({
                  label: "Avg Transaction", value: f(summary?.kpis?.avgTransactionAmount ?? 0), icon: Receipt,
                  description: "The average amount per expense or income entry this month.",
                  actions: [{ label: "View Expenses", href: "/expenses" }],
                })} />
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
      <WelcomeTour isOpen={showTour} onClose={handleTourClose} />
      <TwoFactorPromptModal isOpen={show2FAPrompt} onClose={() => setShow2FAPrompt(false)} />
      <KpiDetailDrawer data={selectedKpi} onClose={() => setSelectedKpi(null)} />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <><Topbar title="Dashboard" /><main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />)}
        </div>
      </main></>
    }>
      <DashboardContent />
    </Suspense>
  );
}
