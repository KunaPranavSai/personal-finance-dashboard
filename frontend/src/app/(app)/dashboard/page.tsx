"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { MonthlyAuditBanner } from "@/components/dashboard/MonthlyAuditBanner";
import { KpiCard } from "@/components/kpi/KpiCard";
import { KpiExpandedCard, KpiDetailData } from "@/components/kpi/KpiExpandedCard";
import { IncomeExpenseChart } from "@/components/charts/IncomeExpenseChart";
import { CategoryDonutChart } from "@/components/charts/CategoryDonutChart";
import { FinancialHealthGauge } from "@/components/charts/FinancialHealthGauge";
import { WelcomeTour } from "@/components/ui/WelcomeTour";
import { TwoFactorPromptModal } from "@/components/ui/TwoFactorPromptModal";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, ErrorCard } from "@/components/mobile/MobileStates";
import { MiniFinancialChart } from "@/components/dashboard/MiniFinancialChart";
import { buildHomeInsights } from "@/components/dashboard/HomeInsights";
import { InsightCarousel } from "@/components/dashboard/InsightCarousel";
import { useAuth } from "@/lib/AuthContext";
import { useIsMobile } from "@/lib/DeviceContext";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { getLocalDashboardSummary, getLocalIncomeExpenseTrend, getLocalCategoryBreakdown } from "@/lib/services/dashboardService";
import { listLocalTransactions } from "@/lib/services/transactionsService";
import { formatCurrency, formatCompactCurrency, formatPercent, formatDateIN } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { useProfile } from "@/lib/reference";
import { getHomeGreeting } from "@/lib/greeting";
import { DashboardSummary, Transaction, PaginatedResponse, Investment, Goal } from "@/types";
import {
  Wallet, TrendingDown, PiggyBank, Activity, Landmark, Gauge,
  HeartPulse, ShieldCheck, TrendingUp, ArrowLeftRight, Receipt, BarChart3,
  Target, UtensilsCrossed, Car, Home, Film, ShoppingCart,
} from "lucide-react";

const CATEGORY_ICONS = [BarChart3, Receipt, Target, UtensilsCrossed, Car, Home, Film, ShoppingCart];

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, twoFactorEnabled } = useAuth();
  const isMobile = useIsMobile();
  const [showTour, setShowTour] = useState(false);
  const [show2FAPrompt, setShow2FAPrompt] = useState(false);
  const [isWelcome, setIsWelcome] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<KpiDetailData | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

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
  const fCompact = (v: number) => formatCompactCurrency(v, cur);
  const { data: summary, isLoading, isError: summaryIsError, refetch: refetchSummary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => (getStorageMode() === "local" ? getLocalDashboardSummary() : api.get<DashboardSummary>("/api/dashboard/summary")),
  });

  const { data: recentTxns } = useQuery({
    queryKey: ["transactions", "recent-3"],
    queryFn: () =>
      getStorageMode() === "local"
        ? listLocalTransactions({ page: 1, pageSize: 3 })
        : api.get<PaginatedResponse<Transaction>>("/api/transactions?page=1&pageSize=3&sortBy=date&sortDir=desc"),
    enabled: isMobile,
  });

  const { data: trend } = useQuery({
    queryKey: ["income-expense-trend"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getLocalIncomeExpenseTrend()
        : api.get<{ items: { month: string; type: string; total: string }[] }>("/api/dashboard/trend/income-expense"),
  });

  const { data: breakdown } = useQuery({
    queryKey: ["category-breakdown"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getLocalCategoryBreakdown()
        : api.get<{ items: { category: string; total: number }[] }>(
      "/api/dashboard/breakdown/category"
    ),
  });

  // Real Investments/Goals data for the Annual Cash Flow allocation bar —
  // same list endpoints/local collections the Investments and Goals pages
  // already use, just read-only here. Only fetched on mobile (this data
  // only feeds the mobile Home layout).
  const { data: investmentsData } = useQuery({
    queryKey: ["investments"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getStorageProvider().list<Investment & { createdAt: string; updatedAt: string; [k: string]: unknown }>("investments").then((items) => ({ items }))
        : api.get<{ items: Investment[] }>("/api/investments"),
    enabled: isMobile,
  });
  const { data: goalsData } = useQuery({
    queryKey: ["goals"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getStorageProvider().list<Goal & { createdAt: string; updatedAt: string; [k: string]: unknown }>("goals").then((items) => ({ items }))
        : api.get<{ items: Goal[] }>("/api/goals"),
    enabled: isMobile,
  });

  const trendByMonth = new Map<string, { month: string; income: number; expense: number }>();
  (trend?.items ?? []).forEach((row) => {
    const entry = trendByMonth.get(row.month) ?? { month: row.month, income: 0, expense: 0 };
    if (row.type === "INCOME") entry.income = Number(row.total);
    else entry.expense = Number(row.total);
    trendByMonth.set(row.month, entry);
  });
  const trendData = Array.from(trendByMonth.values()).sort((a, b) => a.month.localeCompare(b.month));

  // Flight-path graph trajectory: a running cumulative balance (income minus
  // expense per month) walked back from the current net worth, so the line
  // ends exactly at today's figure while still shaping its climbs/dips from
  // real monthly performance.
  const netWorthTrend = (() => {
    if (trendData.length < 2 || !summary?.kpis) return undefined;
    const monthlyNet = trendData.map((m) => m.income - m.expense);
    const totalNet = monthlyNet.reduce((a, b) => a + b, 0);
    let running = summary.kpis.netWorth - totalNet;
    return monthlyNet.map((n) => (running += n));
  })();

  const hasError = !summary && !isLoading;
  // AuthContext's user.name is the primary source (kept live via
  // updateUserName after a profile save — see profile/page.tsx); the
  // ["profile"] query is a defensive fallback in case that context hasn't
  // hydrated yet on a fresh load.
  const { data: profile } = useProfile();
  const displayName = user?.name || profile?.name;
  const firstName = displayName?.split(" ")[0];
  // Computed once per mount (not on every render) so it stays put for the
  // whole session/day instead of flickering between variations — see
  // lib/greeting.ts for the deterministic seeding.
  const homeGreeting = useMemo(() => getHomeGreeting(firstName), [firstName]);

  if (isMobile) {
    if (isLoading) {
      return (
        <MobileShell title="Penny Pilot">
          <div className="ppm-stack">
            <LoadingCard lines={2} />
            <LoadingCard />
            <LoadingCard />
          </div>
        </MobileShell>
      );
    }
    if (summaryIsError || !summary) {
      return (
        <MobileShell title="Penny Pilot">
          <ErrorCard onRetry={() => refetchSummary()} />
        </MobileShell>
      );
    }
    const k = summary.kpis;
    const incomeChange = k.changeVsPrevMonth?.income ?? 0;
    const netWorthUp = (k.netWorth ?? 0) >= 0;
    // Proportional two-segment bar: both segments share ONE denominator
    // (income + expense), not income alone — the previous version divided
    // expense's share by income only and capped it at "100 - income's own
    // 100%", which silently zeroed the expense segment out any time income
    // was greater than 0 (i.e. essentially always). Recomputed fresh from
    // `summary` every render, so it can never disagree with the numbers
    // printed right above it or go stale after a create/edit/delete.
    const monthTotal = Math.max(k.currentMonth.income + k.currentMonth.expense, 1);
    const incomePct = (k.currentMonth.income / monthTotal) * 100;
    const expensePct = (k.currentMonth.expense / monthTotal) * 100;
    const monthNet = k.currentMonth.income - k.currentMonth.expense;
    const monthStatus =
      k.currentMonth.income === 0 && k.currentMonth.expense === 0
        ? { label: "No activity yet", tone: "neutral" as const }
        : monthNet >= 0
        ? { label: "On track", tone: "positive" as const }
        : { label: "Overspending", tone: "critical" as const };
    const totalBreakdown = (breakdown?.items ?? []).reduce((s, i) => s + i.total, 0) || 1;

    const currentYear = String(new Date().getFullYear());
    const annual = (trend?.items ?? []).reduce(
      (acc, row) => {
        if (!row.month.startsWith(currentYear)) return acc;
        if (row.type === "INCOME") acc.income += Number(row.total);
        else acc.expense += Number(row.total);
        return acc;
      },
      { income: 0, expense: 0 }
    );
    const annualNet = annual.income - annual.expense;
    const annualTotal = Math.max(annual.income + annual.expense, 1);
    const annualIncomePct = (annual.income / annualTotal) * 100;
    const annualExpensePct = (annual.expense / annualTotal) * 100;

    const insights = buildHomeInsights(summary, f);

    // Annual Cash Flow as a real income-allocation bar: where this year's
    // real income actually went, using only genuinely available data —
    // Bills (summary.upcomingBills, already fetched), Investments and
    // Goals (their own real monthlyContribution × 12, from the same
    // list endpoints/local collections the Investments/Goals pages use),
    // Emergency Fund (the Goal category the app already defines for this —
    // see GOAL_CATEGORIES in lib/reference.ts — filtered out of the
    // general Goals segment so it isn't double-counted), Other Expenses
    // (the real annual expense total minus whatever's already counted as
    // Bills), and Net Savings (whatever real income is left over). Any
    // segment with no real data behind it (no investments logged, no
    // goals, no upcoming bills) is simply omitted, never shown as zero or
    // guessed.
    const billsAnnual = summary.upcomingBills.reduce((s, b) => s + Math.max(0, b.amount - b.paidAmount), 0);
    const investmentsAnnual = (investmentsData?.items ?? []).reduce((s, inv) => s + Math.max(0, inv.monthlyContribution) * 12, 0);
    const emergencyFundGoals = (goalsData?.items ?? []).filter((g) => g.category === "Emergency Fund");
    const otherGoals = (goalsData?.items ?? []).filter((g) => g.category !== "Emergency Fund");
    const emergencyFundAnnual = emergencyFundGoals.reduce((s, g) => s + Math.max(0, g.monthlyContribution) * 12, 0);
    const goalsAnnual = otherGoals.reduce((s, g) => s + Math.max(0, g.monthlyContribution) * 12, 0);
    const otherExpensesAnnual = Math.max(0, annual.expense - billsAnnual);
    const allocated = billsAnnual + investmentsAnnual + emergencyFundAnnual + goalsAnnual + otherExpensesAnnual;
    const netSavingsRemainder = Math.max(0, annual.income - allocated);
    const allocationBase = Math.max(annual.income, allocated, 1);

    const allocationSegments = [
      { label: "Other Expenses", value: otherExpensesAnnual, color: "var(--ppm-warning)" },
      { label: "Bills", value: billsAnnual, color: "var(--ppm-turmeric)" },
      { label: "Investments", value: investmentsAnnual, color: "var(--ppm-accent)" },
      { label: "Emergency Fund", value: emergencyFundAnnual, color: "var(--ppm-mantis)" },
      { label: "Goals", value: goalsAnnual, color: "var(--ppm-vulcanico)" },
      { label: "Unallocated", value: netSavingsRemainder, color: "var(--ppm-positive)" },
    ]
      .filter((seg) => seg.value > 0)
      .map((seg) => ({ ...seg, pct: (seg.value / allocationBase) * 100 }));

    return (
      <MobileShell title="Penny Pilot" subtitle="Smart Money Management">
        <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--ppm-text)", marginBottom: 12 }}>
          {homeGreeting}
        </div>

        <div className="ppm-card">
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ppm-section-label">Total Net Worth</div>
              <div className="ppm-figure" style={{ fontSize: "1.5rem" }}>
                {f(k.netWorth)}
              </div>
              <span className={`ppm-delta${netWorthUp ? "" : " down"}`} style={{ display: "inline-block", marginTop: 6 }}>{netWorthUp ? "+" : ""}{formatPercent(incomeChange)} {netWorthUp ? "↗" : "↘"}</span>
            </div>
            <MiniFinancialChart income={k.currentMonth.income} expense={k.currentMonth.expense} savings={monthNet} format={f} formatCompact={fCompact} />
          </div>

          <div style={{ borderTop: "1px dashed var(--ppm-border)", margin: "14px 0" }} />

          <div className="ppm-section-label">Financial Intelligence</div>
          <InsightCarousel insights={insights} />
        </div>

        <div className="ppm-stack">
          <div className="ppm-card">
            <div className="ppm-section-label">
              Monthly Cash Flow
              <span className={`ppm-badge${monthStatus.tone === "critical" ? " critical" : monthStatus.tone === "positive" ? "" : " warn"}`}>{monthStatus.label}</span>
            </div>
            <div className="ppm-cf-row">
              <span className="in">Income {f(k.currentMonth.income)}</span>
              <span className="out">Expenses {f(k.currentMonth.expense)}</span>
            </div>
            <div className="ppm-bar-track">
              <div className="ppm-bar-fill" style={{ width: `${incomePct}%`, background: "var(--ppm-positive)" }} />
              <div className="ppm-bar-fill" style={{ width: `${expensePct}%`, background: "var(--ppm-warning)" }} />
            </div>

            <div style={{ borderTop: "1px dashed var(--ppm-border)", margin: "16px 0" }} />

            <div className="ppm-section-label">Annual Cash Flow · {currentYear}</div>
            <div className="ppm-cf-row">
              <span className="in">Income {f(annual.income)}</span>
              <span className="out">Expenses {f(annual.expense)}</span>
            </div>
            <div className="ppm-bar-track">
              {allocationSegments.length > 0
                ? allocationSegments.map((seg) => (
                    <div key={seg.label} className="ppm-bar-fill" style={{ width: `${seg.pct}%`, background: seg.color }} />
                  ))
                : (
                  <>
                    <div className="ppm-bar-fill" style={{ width: `${annualIncomePct}%`, background: "var(--ppm-positive)" }} />
                    <div className="ppm-bar-fill" style={{ width: `${annualExpensePct}%`, background: "var(--ppm-warning)" }} />
                  </>
                )}
            </div>
            {allocationSegments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 10 }}>
                {allocationSegments.map((seg) => (
                  <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: seg.color, flexShrink: 0 }} aria-hidden="true" />
                    <span style={{ color: "var(--ppm-text-dim)", fontWeight: 600 }}>{seg.label}</span>
                    <span style={{ fontWeight: 700 }}>{f(seg.value)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="ppm-cf-row" style={{ marginTop: 10, marginBottom: 0 }}>
              <span style={{ fontSize: 12, color: "var(--ppm-text-dim)" }}>Net Savings</span>
              <span style={{ fontWeight: 700, color: annualNet >= 0 ? "var(--ppm-positive)" : "var(--ppm-critical)" }}>{f(annualNet)}</span>
            </div>
          </div>

          <div className="ppm-card">
            <div className="ppm-section-label">
              Category Breakdown
              <Link href="/budget">View</Link>
            </div>
            {(breakdown?.items ?? []).length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>No spending recorded yet.</p>
            ) : (
              (breakdown?.items ?? []).slice(0, 4).map((item, i) => (
                <div className="ppm-cat-row" key={item.category}>
                  <div className="ppm-ic" aria-hidden="true">{(() => { const Ic = CATEGORY_ICONS[i % CATEGORY_ICONS.length]; return <Ic size={18} />; })()}</div>
                  <div className="ppm-info">
                    <div className="ppm-name">{item.category}</div>
                  </div>
                  <div className="ppm-amt">
                    {f(item.total)}
                    <span className="sub">{formatPercent(item.total / totalBreakdown)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="ppm-card">
            <div className="ppm-section-label">
              Recent Transactions
              <Link href="/transactions">View all</Link>
            </div>
            {(recentTxns?.items ?? []).length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>No transactions yet — tap Add to log your first one.</p>
            ) : (
              (recentTxns?.items ?? []).map((t) => (
                <div className="ppm-txn-row" key={t.id}>
                  <div className="ppm-ic" aria-hidden="true">{t.type === "INCOME" ? <Wallet size={18} /> : <Receipt size={18} />}</div>
                  <div className="ppm-info">
                    <div className="ppm-name">{t.description}</div>
                    <div className="ppm-meta">{formatDateIN(t.date)} · {t.category?.name ?? "Uncategorized"}</div>
                  </div>
                  <div className={`ppm-amt ${t.type === "INCOME" ? "pos" : "neg"}`}>
                    {t.type === "INCOME" ? "+" : "-"}{f(t.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </MobileShell>
    );
  }

  return (
    <>
      <Topbar title="Dashboard" />
      <main ref={mainRef} className="flex-1 overflow-y-auto p-4 lg:p-6">
        <MonthlyAuditBanner />
        <DashboardHero
          firstName={firstName}
          netWorthLabel={f(summary?.kpis?.netWorth ?? 0)}
          incomeLabel={f(summary?.kpis?.totalIncome ?? 0)}
          expenseLabel={f(summary?.kpis?.totalExpenses ?? 0)}
          netWorthTrend={netWorthTrend}
          summary={summary}
          scrollContainerRef={mainRef}
          heroRef={heroRef}
        />
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
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
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              <KpiCard id="total-income" label="Total Income" value={f(summary?.kpis?.totalIncome ?? 0)} icon={Wallet}
                changePct={summary?.kpis?.changeVsPrevMonth?.income}
                onClick={() => setSelectedKpi({
                  id: "total-income",
                  label: "Total Income", value: f(summary?.kpis?.totalIncome ?? 0), icon: Wallet,
                  changePct: summary?.kpis?.changeVsPrevMonth?.income,
                  description: "All money coming in this month, compared to last month.",
                  actions: [{ label: "View Income", href: "/income" }],
                  transactionType: "INCOME",
                })} />
              <KpiCard id="total-expenses" label="Total Expenses" value={f(summary?.kpis?.totalExpenses ?? 0)} icon={TrendingDown}
                changePct={summary?.kpis ? -summary.kpis.changeVsPrevMonth.expense : null} tone="negative"
                onClick={() => setSelectedKpi({
                  id: "total-expenses",
                  label: "Total Expenses", value: f(summary?.kpis?.totalExpenses ?? 0), icon: TrendingDown, tone: "negative",
                  changePct: summary?.kpis ? -summary.kpis.changeVsPrevMonth.expense : null,
                  description: "Everything you've spent this month, compared to last month.",
                  actions: [{ label: "View Expenses", href: "/expenses" }],
                  transactionType: "EXPENSE",
                })} />
              <KpiCard id="total-savings" label="Total Savings" value={f(summary?.kpis?.totalSavings ?? 0)} icon={PiggyBank}
                onClick={() => setSelectedKpi({
                  id: "total-savings",
                  label: "Total Savings", value: f(summary?.kpis?.totalSavings ?? 0), icon: PiggyBank,
                  description: "Income minus expenses this month.",
                  actions: [{ label: "View Savings", href: "/savings" }],
                })} />
              <KpiCard id="cash-flow" label="Cash Flow" value={f(summary?.kpis?.cashFlow ?? 0)} icon={Activity}
                onClick={() => setSelectedKpi({
                  id: "cash-flow",
                  label: "Cash Flow", value: f(summary?.kpis?.cashFlow ?? 0), icon: Activity,
                  description: "Net movement of money in and out of your accounts this month.",
                  actions: [{ label: "View Analytics", href: "/analytics" }],
                })} />
              <KpiCard id="net-worth" label="Net Worth" value={f(summary?.kpis?.netWorth ?? 0)} icon={Landmark}
                onClick={() => setSelectedKpi({
                  id: "net-worth",
                  label: "Net Worth", value: f(summary?.kpis?.netWorth ?? 0), icon: Landmark,
                  description: "Your total savings plus investments, minus nothing owed.",
                  actions: [{ label: "View Investments", href: "/investments" }],
                })} />
              <KpiCard id="savings-rate" label="Savings Rate" value={formatPercent(summary?.kpis?.savingsRatePct ?? 0)} icon={PiggyBank}
                onClick={() => setSelectedKpi({
                  id: "savings-rate",
                  label: "Savings Rate", value: formatPercent(summary?.kpis?.savingsRatePct ?? 0), icon: PiggyBank,
                  description: "The share of your income you kept as savings this month.",
                  actions: [{ label: "View Savings", href: "/savings" }],
                })} />
              <KpiCard id="budget-usage" label="Budget Usage" value={formatPercent(summary?.kpis?.budgetUtilizationPct ?? 0)} icon={Gauge}
                onClick={() => setSelectedKpi({
                  id: "budget-usage",
                  label: "Budget Usage", value: formatPercent(summary?.kpis?.budgetUtilizationPct ?? 0), icon: Gauge,
                  description: "How much of your monthly budget you've used so far.",
                  actions: [{ label: "View Budgets", href: "/budget" }],
                  transactionType: "EXPENSE",
                })} />
              <KpiCard id="financial-health" label="Financial Health" value={String(summary?.kpis?.financialHealthScore ?? 0)} icon={HeartPulse}
                onClick={() => setSelectedKpi({
                  id: "financial-health",
                  label: "Financial Health", value: String(summary?.kpis?.financialHealthScore ?? 0), icon: HeartPulse,
                  description: "An overall score combining your savings rate, budget discipline, and emergency fund progress.",
                  actions: [{ label: "View Analytics", href: "/analytics" }],
                })} />
              <KpiCard id="emergency-fund" label="Emergency Fund" value={formatPercent(summary?.kpis?.emergencyFundProgressPct ?? 0)} icon={ShieldCheck}
                onClick={() => setSelectedKpi({
                  id: "emergency-fund",
                  label: "Emergency Fund", value: formatPercent(summary?.kpis?.emergencyFundProgressPct ?? 0), icon: ShieldCheck,
                  description: "Progress toward your emergency fund goal.",
                  actions: [{ label: "View Goals", href: "/goals" }],
                })} />
              <KpiCard id="investments" label="Investments" value={f(summary?.kpis?.investmentGrowth ?? 0)} icon={TrendingUp}
                onClick={() => setSelectedKpi({
                  id: "investments",
                  label: "Investments", value: f(summary?.kpis?.investmentGrowth ?? 0), icon: TrendingUp,
                  description: "Growth across your tracked investments this month.",
                  actions: [{ label: "View Investments", href: "/investments" }],
                })} />
              <KpiCard id="transactions" label="Transactions" value={String(summary?.kpis?.transactionCount ?? 0)} icon={ArrowLeftRight}
                onClick={() => setSelectedKpi({
                  id: "transactions",
                  label: "Transactions", value: String(summary?.kpis?.transactionCount ?? 0), icon: ArrowLeftRight,
                  description: "Total expense and income entries logged this month.",
                  actions: [{ label: "View Expenses", href: "/expenses" }, { label: "View Income", href: "/income" }],
                })} />
              <KpiCard id="avg-transaction" label="Avg Transaction" value={f(summary?.kpis?.avgTransactionAmount ?? 0)} icon={Receipt}
                onClick={() => setSelectedKpi({
                  id: "avg-transaction",
                  label: "Avg Transaction", value: f(summary?.kpis?.avgTransactionAmount ?? 0), icon: Receipt,
                  description: "The average amount per expense or income entry this month.",
                  actions: [{ label: "View Expenses", href: "/expenses" }],
                })} />
            </div>

            {trendData.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <IncomeExpenseChart
                    data={trendData}
                    budgetLimit={
                      summary?.kpis && summary.kpis.budgetUtilizationPct > 0
                        ? summary.kpis.totalExpenses / (summary.kpis.budgetUtilizationPct / 100)
                        : undefined
                    }
                  />
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
      <KpiExpandedCard data={selectedKpi} onClose={() => setSelectedKpi(null)} />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <><Topbar title="Dashboard" /><main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />)}
        </div>
      </main></>
    }>
      <DashboardContent />
    </Suspense>
  );
}
