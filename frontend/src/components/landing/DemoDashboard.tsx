"use client";

import { Wallet, TrendingDown, PiggyBank, Landmark } from "lucide-react";
import { KpiCard } from "@/components/kpi/KpiCard";
import { IncomeExpenseChart } from "@/components/charts/IncomeExpenseChart";
import { FinancialHealthGauge } from "@/components/charts/FinancialHealthGauge";
import { CategoryDonutChart } from "@/components/charts/CategoryDonutChart";
import { formatCurrency } from "@/lib/format";

/**
 * Illustrative-only demo data, shaped exactly like the real dashboard's data
 * (see lib/services/dashboardService.ts / types.ts) so it can drive the
 * actual production chart/KPI components instead of a fabricated mock. None
 * of this is real user data — every figure here is a round, clearly
 * fictional example.
 */
const DEMO_TREND = [
  { month: "Apr", income: 92000, expense: 58000 },
  { month: "May", income: 88000, expense: 61000 },
  { month: "Jun", income: 95000, expense: 54000 },
  { month: "Jul", income: 91000, expense: 57000 },
  { month: "Aug", income: 98000, expense: 52000 },
  { month: "Sep", income: 94000, expense: 49000 },
];

const DEMO_CATEGORIES = [
  { category: "Food & Dining", total: 14200 },
  { category: "Transport", total: 8600 },
  { category: "Shopping", total: 11400 },
  { category: "Bills & Utilities", total: 9800 },
  { category: "Savings", total: 15000 },
];

const DEMO_KPIS = [
  { id: "networth", label: "Net Worth", value: formatCurrency(1240000), icon: Landmark, changePct: 0.124, tone: "positive" as const, sparklineData: [8, 9, 8.7, 9.4, 10.2, 11, 11.6, 12.4] },
  { id: "income", label: "Monthly Income", value: formatCurrency(94000), icon: Wallet, changePct: 0.032, tone: "positive" as const, sparklineData: [88, 92, 88, 95, 91, 98, 94] },
  { id: "expense", label: "Monthly Expenses", value: formatCurrency(49000), icon: TrendingDown, changePct: -0.06, tone: "positive" as const, sparklineData: [58, 61, 54, 57, 52, 49] },
  { id: "savings", label: "Savings Rate", value: "47.9%", icon: PiggyBank, changePct: 0.081, tone: "positive" as const, sparklineData: [37, 41, 43, 39, 45, 48] },
];

interface DemoDashboardProps {
  /** Show the chart + donut row below the KPIs. Hero keeps this compact; the
   * "Financial Intelligence" section shows the fuller view. */
  variant?: "compact" | "full";
}

export function DemoDashboard({ variant = "full" }: DemoDashboardProps) {
  return (
    <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-black/5 bg-white/70 shadow-2xl dark:border-white/10 dark:bg-navy-dark/70">
      {/* Mock browser chrome — signals "this is a real app screen", not a stock illustration */}
      <div className="flex items-center gap-1.5 border-b border-black/5 px-4 py-3 dark:border-white/10">
        <div className="flex gap-1.5" aria-hidden="true">
          <div className="h-3 w-3 rounded-full bg-rose-400" />
          <div className="h-3 w-3 rounded-full bg-amber-400" />
          <div className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 text-center font-mono text-xs text-navy/40 dark:text-white/40">
          www.pennypilot.pro/dashboard
        </div>
        <span className="rounded-full border border-navy/10 bg-navy/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy/40 dark:border-white/10 dark:bg-white/5 dark:text-white/40">
          Illustrative preview
        </span>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DEMO_KPIS.map((kpi) => (
            <KpiCard key={kpi.id} {...kpi} />
          ))}
        </div>

        {variant === "full" && (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <IncomeExpenseChart data={DEMO_TREND} />
            </div>
            <FinancialHealthGauge score={82} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Standalone donut, used by the Financial Intelligence section without
 * repeating the full KPI/chart block above. */
export function DemoCategoryDonut() {
  return <CategoryDonutChart data={DEMO_CATEGORIES} />;
}
