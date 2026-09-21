import type { DashboardSummary } from "@/types";
import {
  Sparkles, Zap, TrendingUp, AlertTriangle, Tag, Receipt,
  Siren, CheckCircle2, LifeBuoy, Bell, TrendingDown, ThumbsUp, type LucideIcon,
} from "lucide-react";

export interface Insight {
  id: string;
  icon: LucideIcon;
  text: string;
  tone: "positive" | "warning" | "critical" | "neutral";
}

/**
 * "Financial Intelligence" — deterministic, explainable observations
 * derived entirely from the same DashboardSummary the rest of Home already
 * renders (no separate fetch, no LLM, no invented numbers). Every rule only
 * fires when the underlying field actually indicates something (a real
 * category, a real overdue bill, a transaction count > 0, etc.); when the
 * account is new/empty this returns a single onboarding-style message
 * instead of guessing. Recomputed fresh every call — there is nothing here
 * to go stale, so the center updates the instant `summary` (react-query)
 * changes.
 */
export function buildHomeInsights(summary: DashboardSummary, cur: (v: number) => string): Insight[] {
  const k = summary.kpis;
  const insights: Insight[] = [];

  if (k.transactionCount === 0) {
    return [{ id: "empty", icon: Sparkles, text: "Log your first transaction to unlock personalized financial analysis here.", tone: "neutral" }];
  }

  // Income vs. expenses / savings rate
  if (Number.isFinite(k.savingsRatePct)) {
    if (k.savingsRatePct >= 20) {
      insights.push({ id: "savings-good", icon: Zap, text: `Savings rate is ${k.savingsRatePct.toFixed(0)}% of income this period — comfortably above the 20% benchmark.`, tone: "positive" });
    } else if (k.savingsRatePct >= 0) {
      insights.push({ id: "savings-ok", icon: TrendingUp, text: `Savings rate is ${k.savingsRatePct.toFixed(0)}% of income this period, below the commonly recommended 20% target.`, tone: "neutral" });
    } else {
      insights.push({ id: "savings-negative", icon: AlertTriangle, text: `Expenses currently exceed income (${k.savingsRatePct.toFixed(0)}% savings rate) — a spending review is worth prioritizing.`, tone: "critical" });
    }
  }

  // Spending trend / concentration
  if (k.highestSpendingCategory) {
    insights.push({ id: "top-category", icon: Tag, text: `${k.highestSpendingCategory} is your largest spending category — the first place to look for savings opportunities.`, tone: "neutral" });
  }

  // Unusually high / largest expense
  if (k.largestExpense > 0) {
    insights.push({ id: "largest-expense", icon: Receipt, text: `The largest single expense on record is ${cur(k.largestExpense)}.`, tone: "neutral" });
  }

  // Budget deviation
  if (Number.isFinite(k.budgetUtilizationPct) && k.budgetUtilizationPct > 0) {
    if (k.budgetUtilizationPct >= 90) {
      insights.push({ id: "budget-high", icon: Siren, text: `${k.budgetUtilizationPct.toFixed(0)}% of budget has been used this month — spending is tracking ahead of plan.`, tone: "warning" });
    } else if (k.budgetUtilizationPct <= 50) {
      insights.push({ id: "budget-comfortable", icon: CheckCircle2, text: `Budget utilization is ${k.budgetUtilizationPct.toFixed(0)}% for the month — well within plan.`, tone: "positive" });
    }
  }

  // Savings opportunity: emergency fund
  if (Number.isFinite(k.emergencyFundProgressPct) && k.emergencyFundProgressPct > 0 && k.emergencyFundProgressPct < 100) {
    insights.push({ id: "emergency-fund", icon: LifeBuoy, text: `Emergency fund progress stands at ${k.emergencyFundProgressPct.toFixed(0)}% of target.`, tone: "neutral" });
  }

  // Upcoming financial obligations (recurring bills/EMIs and one-off dues alike)
  if (summary.upcomingBills.length > 0) {
    const totalDue = summary.upcomingBills.reduce((s, b) => s + Math.max(0, b.amount - b.paidAmount), 0);
    const recurringCount = summary.upcomingBills.filter((b) => b.type === "EMI" || b.type === "Subscription").length;
    const recurringNote = recurringCount > 0 ? ` (${recurringCount} recurring)` : "";
    insights.push({
      id: "upcoming-bills",
      icon: Bell,
      text: `${summary.upcomingBills.length} upcoming obligation${summary.upcomingBills.length > 1 ? "s" : ""}${recurringNote} totaling ${cur(totalDue)} due soon.`,
      tone: "warning",
    });
  }

  // Investment performance (only when real investment data exists)
  if (Number.isFinite(k.investmentGrowth) && k.investmentGrowth !== 0) {
    const up = k.investmentGrowth > 0;
    insights.push({ id: "investment-growth", icon: up ? TrendingUp : TrendingDown, text: `Investment portfolio is ${up ? "up" : "down"} ${Math.abs(k.investmentGrowth).toFixed(1)}% overall.`, tone: up ? "positive" : "warning" });
  }

  if (insights.length === 0) {
    insights.push({ id: "steady", icon: ThumbsUp, text: "No notable deviations detected yet — keep logging transactions for deeper analysis.", tone: "neutral" });
  }

  return insights.slice(0, 6);
}
