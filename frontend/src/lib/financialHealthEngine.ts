import type { DashboardSummary, Transaction, Investment, Bill } from "@/types";

// ─── Financial Health Score (0-100) ──────────────────────────────────────────
// Weights: Cash Flow 25%, Savings Rate 20%, Debt-to-Income 20%,
// Emergency Fund Coverage 15%, Budget Adherence 10%, Investment Rate 10%.

export type HealthTier = "super-sonic" | "smooth-cruising" | "mild-crosswinds" | "turbulence";

export const HEALTH_TIER_META: Record<HealthTier, { label: string; emoji: string }> = {
  "super-sonic": { label: "Super-Sonic Clear Skies", emoji: "🚀" },
  "smooth-cruising": { label: "Smooth Cruising", emoji: "🌤️" },
  "mild-crosswinds": { label: "Mild Crosswinds", emoji: "🌬️" },
  turbulence: { label: "Approaching Turbulence", emoji: "⚠️" },
};

function tierForScore(score: number): HealthTier {
  if (score >= 85) return "super-sonic";
  if (score >= 70) return "smooth-cruising";
  if (score >= 50) return "mild-crosswinds";
  return "turbulence";
}

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

export function computeHealthScore(signals: FinancialSignals): { score: number; tier: HealthTier } {
  const income = Math.max(signals.income, 1);
  const cashFlowScore = clamp((signals.cashFlow / income) * 200 + 50);
  const savingsRateScore = clamp(signals.savingsRatePct * 2);
  const dtiScore = clamp(100 - signals.dtiPct * 2.5);
  const emergencyFundScore = clamp(signals.emergencyFundProgressPct);
  const budgetAdherenceScore = signals.budgetUsagePct <= 80 ? 100 : clamp(100 - (signals.budgetUsagePct - 80) * 3);
  const investmentRateScore = clamp(signals.investRatePct * 4);

  const score = Math.round(
    cashFlowScore * 0.25 +
      savingsRateScore * 0.2 +
      dtiScore * 0.2 +
      emergencyFundScore * 0.15 +
      budgetAdherenceScore * 0.1 +
      investmentRateScore * 0.1
  );
  return { score, tier: tierForScore(score) };
}

// ─── Signals ─────────────────────────────────────────────────────────────────
// Everything the 42 rules read. Derived from data already fetched for the
// dashboard (DashboardSummary), plus a small recent-transactions and
// investments pull made by DashboardHero itself. A few signals (savings
// streak, net-worth milestone, score deltas) need a tiny bit of memory across
// visits — that's kept client-side in localStorage (see loadHistory/
// saveHistory below); this card is a UX nicety, not a system of record, so a
// lightweight local cache is an intentional, proportionate choice rather than
// standing up new backend tracking for it.

export interface FinancialSignals {
  firstName: string;
  income: number;
  expenses: number;
  cashFlow: number;
  savingsRatePct: number;
  budgetUsagePct: number;
  emergencyFundProgressPct: number;
  netWorth: number;
  investRatePct: number;
  dtiPct: number;
  changeVsPrevMonthIncomePct: number;
  dayOfMonth: number;
  daysInMonth: number;

  overdueBill?: { name: string; amount: number };
  dueSoonBill?: { name: string; amount: number; daysUntil: number };
  creditCardPaidOff?: { name: string };
  creditCardStatement?: { name: string; amount: number; utilizationPct: number };
  subscriptionCount: number;
  avgSubscriptionAmount: number;

  daysSinceLastTransaction: number | null;
  weekendSpendPct: number | null;
  categorySpike: { category: string; pctUp: number } | null;
  impulseBuyCount: number;
  largeTransaction: { amount: number; description: string } | null;
  unplannedLargeExpense: { amount: number; description: string } | null;
  isPayday: boolean;
  incomeBonus: { amount: number } | null;

  portfolioGainPct: number;
  hasAnyInvestments: boolean;

  savingsGoalStreakMonths: number;
  earlyGoalDays: number | null;
  netWorthMilestone: number | null;
  scoreDelta: number | null;
}

const HISTORY_KEY = "pfd-financial-health-history";
const SAVINGS_GOAL_PCT = 20;
const NET_WORTH_MILESTONES = [50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000];

interface HealthHistory {
  lastScore?: number;
  savingsGoalMonths?: string[]; // "YYYY-MM" keys where the savings goal was met
  lastMilestone?: number;
}

function loadHistory(): HealthHistory {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HealthHistory) : {};
  } catch {
    return {};
  }
}

function saveHistory(next: HealthHistory) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const daysBetween = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000);

function matchesKeyword(value: string, keywords: string[]): boolean {
  const v = value.toLowerCase();
  return keywords.some((k) => v.includes(k));
}

export function buildFinancialSignals({
  summary,
  transactions,
  investments,
  firstName,
}: {
  summary: DashboardSummary | undefined;
  transactions: Transaction[];
  investments: Investment[];
  firstName: string;
}): FinancialSignals {
  const now = new Date();
  const k = summary?.kpis;
  const income = k?.totalIncome ?? 0;
  const expenses = k?.totalExpenses ?? 0;
  const cashFlow = k?.cashFlow ?? income - expenses;
  const savingsRatePct = k?.savingsRatePct ?? 0;
  const budgetUsagePct = k?.budgetUtilizationPct ?? 0;
  const emergencyFundProgressPct = k?.emergencyFundProgressPct ?? 0;
  const netWorth = k?.netWorth ?? 0;
  const changeVsPrevMonthIncomePct = k?.changeVsPrevMonth?.income ?? 0;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  const investRatePct = income > 0 ? (investments.reduce((s, i) => s + (i.monthlyContribution || 0), 0) / income) * 100 : 0;
  const investedTotal = investments.reduce((s, i) => s + i.investedAmount, 0);
  const currentTotal = investments.reduce((s, i) => s + i.currentValue, 0);
  const portfolioGainPct = investedTotal > 0 ? ((currentTotal - investedTotal) / investedTotal) * 100 : 0;

  const bills = summary?.upcomingBills ?? [];
  const overdue = bills.find((b) => new Date(b.dueDate) < now && b.paidAmount < b.amount);
  const dueSoon = bills
    .filter((b) => b.paidAmount < b.amount)
    .map((b) => ({ bill: b, daysUntil: daysBetween(new Date(b.dueDate), now) }))
    .find((x) => x.daysUntil >= 0 && x.daysUntil <= 3);
  const isDebtBill = (b: Bill) => Boolean(b.tenureMonths) || matchesKeyword(b.type, ["loan", "emi", "mortgage"]);
  const debtBills = bills.filter(isDebtBill);
  const dtiPct = income > 0 ? (debtBills.reduce((s, b) => s + b.amount, 0) / income) * 100 : 0;

  const creditCardBills = bills.filter((b) => matchesKeyword(b.type, ["credit card", "credit-card", "creditcard"]));
  const paidOffCard = creditCardBills.find((b) => b.amount > 0 && b.paidAmount >= b.amount);
  const openCardStatement = creditCardBills.find((b) => b.paidAmount < b.amount && b.amount > 0);

  const subscriptionBills = bills.filter((b) => matchesKeyword(b.type, ["subscription", "streaming", "saas"]));
  const avgSubscriptionAmount =
    subscriptionBills.length > 0 ? subscriptionBills.reduce((s, b) => s + b.amount, 0) / subscriptionBills.length : 0;

  const sortedTx = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastTx = sortedTx[0];
  const daysSinceLastTransaction = lastTx ? daysBetween(now, new Date(lastTx.date)) : null;

  const last7 = sortedTx.filter((t) => t.type === "EXPENSE" && daysBetween(now, new Date(t.date)) <= 7);
  const weekendSpend = last7.filter((t) => [0, 6].includes(new Date(t.date).getDay())).reduce((s, t) => s + t.amount, 0);
  const last7Total = last7.reduce((s, t) => s + t.amount, 0);
  const weekendSpendPct = last7Total > 0 ? (weekendSpend / last7Total) * 100 : null;

  // Category spike: this-week spend in a category vs the trailing-3-week
  // average for that same category — flagged when meaningfully (>=40%) higher.
  const byCategoryThisWeek = new Map<string, number>();
  last7.forEach((t) => byCategoryThisWeek.set(t.category.name, (byCategoryThisWeek.get(t.category.name) ?? 0) + t.amount));
  const priorWeeks = sortedTx.filter((t) => {
    const d = daysBetween(now, new Date(t.date));
    return t.type === "EXPENSE" && d > 7 && d <= 28;
  });
  const byCategoryPrior = new Map<string, number>();
  priorWeeks.forEach((t) => byCategoryPrior.set(t.category.name, (byCategoryPrior.get(t.category.name) ?? 0) + t.amount));
  let categorySpike: { category: string; pctUp: number } | null = null;
  for (const [cat, thisWeek] of byCategoryThisWeek) {
    const priorAvgWeekly = (byCategoryPrior.get(cat) ?? 0) / 3;
    if (priorAvgWeekly >= 200 && thisWeek > priorAvgWeekly * 1.4) {
      const pctUp = Math.round(((thisWeek - priorAvgWeekly) / priorAvgWeekly) * 100);
      if (!categorySpike || pctUp > categorySpike.pctUp) categorySpike = { category: cat, pctUp };
    }
  }

  const todayTx = sortedTx.filter((t) => isSameDay(new Date(t.date), now));
  const impulseBuyCount = todayTx.filter((t) => t.type === "EXPENSE" && t.essentiality === "NON_ESSENTIAL" && t.amount <= 1000).length;

  const avgTxAmount = k?.avgTransactionAmount ?? 0;
  const largeTxThreshold = Math.max(avgTxAmount * 4, 5000);
  const largeTx = sortedTx.find((t) => t.type === "EXPENSE" && t.amount >= largeTxThreshold && daysBetween(now, new Date(t.date)) <= 2);
  const largeTransaction = largeTx ? { amount: largeTx.amount, description: largeTx.description } : null;

  const unplannedTx = todayTx.find(
    (t) => t.type === "EXPENSE" && matchesKeyword(`${t.category.name} ${t.description}`, ["medical", "hospital", "repair", "doctor", "pharmacy"])
  );
  const unplannedLargeExpense = unplannedTx ? { amount: unplannedTx.amount, description: unplannedTx.description } : null;

  const todayIncome = todayTx.filter((t) => t.type === "INCOME");
  const isPayday = todayIncome.length > 0;
  const monthIncomeSoFar = k?.currentMonth?.income ?? income;
  const bonusTx = todayIncome.find((t) => t.amount > 0 && t.amount > (monthIncomeSoFar - t.amount) * 0.2 && monthIncomeSoFar - t.amount > 0);
  const incomeBonus = bonusTx ? { amount: bonusTx.amount } : null;

  // ── Client-side memory: streaks, milestones, score deltas ──
  const history = loadHistory();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const goalMonths = new Set(history.savingsGoalMonths ?? []);
  let savingsGoalStreakMonths = 0;
  if (savingsRatePct >= SAVINGS_GOAL_PCT) {
    if (!goalMonths.has(monthKey)) goalMonths.add(monthKey);
    const sorted = [...goalMonths].sort();
    let streak = 0;
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (sorted.includes(key)) streak++;
      else break;
    }
    savingsGoalStreakMonths = streak;
  }
  const earlyGoalDays = savingsRatePct >= SAVINGS_GOAL_PCT && dayOfMonth <= 15 ? dayOfMonth : null;

  const nextMilestone = NET_WORTH_MILESTONES.find((m) => netWorth >= m && (history.lastMilestone ?? 0) < m);
  const netWorthMilestone = nextMilestone ?? null;

  const { score } = computeHealthScoreForSignalsInput({
    income,
    cashFlow,
    savingsRatePct,
    dtiPct,
    emergencyFundProgressPct,
    budgetUsagePct,
    investRatePct,
  });
  const scoreDelta = typeof history.lastScore === "number" ? score - history.lastScore : null;

  saveHistory({
    lastScore: score,
    savingsGoalMonths: [...goalMonths].slice(-6),
    lastMilestone: netWorthMilestone ?? history.lastMilestone,
  });

  return {
    firstName,
    income,
    expenses,
    cashFlow,
    savingsRatePct,
    budgetUsagePct,
    emergencyFundProgressPct,
    netWorth,
    investRatePct,
    dtiPct,
    changeVsPrevMonthIncomePct,
    dayOfMonth,
    daysInMonth,
    overdueBill: overdue ? { name: overdue.name, amount: overdue.amount - overdue.paidAmount } : undefined,
    dueSoonBill: dueSoon ? { name: dueSoon.bill.name, amount: dueSoon.bill.amount - dueSoon.bill.paidAmount, daysUntil: dueSoon.daysUntil } : undefined,
    creditCardPaidOff: paidOffCard ? { name: paidOffCard.name } : undefined,
    creditCardStatement: openCardStatement
      ? { name: openCardStatement.name, amount: openCardStatement.amount, utilizationPct: NaN }
      : undefined,
    subscriptionCount: subscriptionBills.length,
    avgSubscriptionAmount,
    daysSinceLastTransaction,
    weekendSpendPct,
    categorySpike,
    impulseBuyCount,
    largeTransaction,
    unplannedLargeExpense,
    isPayday,
    incomeBonus,
    portfolioGainPct,
    hasAnyInvestments: investments.length > 0,
    savingsGoalStreakMonths,
    earlyGoalDays,
    netWorthMilestone,
    scoreDelta,
  };
}

function computeHealthScoreForSignalsInput(input: {
  income: number;
  cashFlow: number;
  savingsRatePct: number;
  dtiPct: number;
  emergencyFundProgressPct: number;
  budgetUsagePct: number;
  investRatePct: number;
}) {
  return computeHealthScore(input as FinancialSignals);
}

// ─── Rules ───────────────────────────────────────────────────────────────────

export interface FinancialInsight {
  ruleId: number;
  tagline: string;
  tips: string[];
}

interface Rule {
  id: number;
  level: 1 | 2 | 3 | 4;
  evaluate: (s: FinancialSignals) => FinancialInsight | null | undefined | false;
}

const fmtMoney = (n: number) => `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
const pct = (n: number) => `${Math.round(Math.abs(n))}%`;

const RULES: Rule[] = [
  // Level 1 — fraud / mayday
  {
    id: 29,
    level: 1,
    evaluate: (s) =>
      s.overdueBill && {
        ruleId: 29,
        tagline: `Mayday Alert, ${s.firstName} 🚨 Payment overdue on ${s.overdueBill.name}!`,
        tips: ["Settle immediately to avoid late fees and credit score impacts.", "Enable auto-pay for peace of mind."],
      },
  },
  {
    id: 38,
    level: 1,
    evaluate: (s) =>
      s.largeTransaction && {
        ruleId: 38,
        tagline: `Radar Anomaly, ${s.firstName} 🛰️ Large transaction of ${fmtMoney(s.largeTransaction.amount)} logged.`,
        tips: ["Confirm this transaction was expected.", "Tag this expense correctly to keep report metrics accurate."],
      },
  },

  // Level 2 — budget / cash-flow / debt alerts
  {
    id: 3,
    level: 2,
    evaluate: (s) =>
      s.cashFlow < 0 && {
        ruleId: 3,
        tagline: `Altitude Loss Detected, ${s.firstName} 📉 Spending has exceeded income by ${pct((Math.abs(s.cashFlow) / Math.max(s.income, 1)) * 100)}.`,
        tips: ["Pause discretionary purchases for the next 7 days.", "Tap into liquid savings temporarily rather than high-interest credit."],
      },
  },
  {
    id: 11,
    level: 2,
    evaluate: (s) =>
      s.budgetUsagePct >= 100 && {
        ruleId: 11,
        tagline: `Maximum Ceiling Reached, ${s.firstName} 🛑 Budget limit fully utilized.`,
        tips: ["Switch to essential-only spending mode.", "Review category overshoots to adjust next month's limit."],
      },
  },
  {
    id: 26,
    level: 2,
    evaluate: (s) =>
      s.dtiPct > 40 && {
        ruleId: 26,
        tagline: `Heavy Payload Warning, ${s.firstName} 🏋️ Debt obligations taking up ${pct(s.dtiPct)} of income.`,
        tips: ["Focus on the Debt Avalanche method (highest interest first).", "Avoid acquiring new line items."],
      },
  },
  {
    id: 13,
    level: 2,
    evaluate: (s) =>
      s.dayOfMonth <= 7 && s.budgetUsagePct >= 50 && {
        ruleId: 13,
        tagline: `High Speed Warning, ${s.firstName} ⚡ Half your monthly budget spent in Week 1.`,
        tips: ["Enforce a 48-hour cool-off period for online shopping.", "Spread upcoming bill payments across weeks."],
      },
  },
  {
    id: 10,
    level: 2,
    evaluate: (s) =>
      s.budgetUsagePct >= 80 && s.budgetUsagePct < 100 && {
        ruleId: 10,
        tagline: `Cautionary Airspace, ${s.firstName} ⚠️ You've utilized ${pct(s.budgetUsagePct)} of your budget.`,
        tips: [
          `Limit daily spending to ${fmtMoney(((100 - s.budgetUsagePct) / 100) * s.income / Math.max(s.daysInMonth - s.dayOfMonth, 1))} for the remainder of the month.`,
          "Defer non-urgent shopping trips.",
        ],
      },
  },
  {
    id: 17,
    level: 2,
    evaluate: (s) =>
      s.emergencyFundProgressPct <= 0 && {
        ruleId: 17,
        tagline: `Flying Without a Parachute, ${s.firstName} 🪂 Emergency fund is empty.`,
        tips: ["Build a starter buffer of ₹10,000 as priority #1.", "Redirect all secondary savings here first."],
      },
  },
  {
    id: 25,
    level: 2,
    evaluate: (s) =>
      s.dueSoonBill && {
        ruleId: 25,
        tagline: `Checkpoint Approaching, ${s.firstName} ⏰ EMI payment of ${fmtMoney(s.dueSoonBill.amount)} due in 3 days.`,
        tips: ["Ensure account balance covers auto-debit.", "Avoid non-essential transfers until processed."],
      },
  },
  {
    id: 24,
    level: 2,
    // No credit-limit data is modeled in the schema, so true utilization %
    // can't be computed — this rule is defined for completeness but never
    // fires until that data exists. Rule 27 (paid off) and 30 (near-zero
    // balance) below use the data we DO have (paid vs. statement amount).
    evaluate: () => null,
  },

  // Level 3 — milestones & achievements
  {
    id: 1,
    level: 3,
    evaluate: (s) =>
      s.savingsRatePct > 50 && {
        ruleId: 1,
        tagline: `Rocketing Heights, ${s.firstName}! 🚀 You saved ${pct(s.savingsRatePct)} of your income this month.`,
        tips: [
          "Your cash surplus is strong. Allocate 20% to high-yield investment options.",
          "Maintain this altitude to hit your annual savings target 3 months early.",
        ],
      },
  },
  {
    id: 4,
    level: 3,
    evaluate: (s) =>
      s.earlyGoalDays !== null && {
        ruleId: 4,
        tagline: `Goal Unlocked Early, ${s.firstName}! 🎯 Monthly savings quota reached in just ${s.earlyGoalDays} days.`,
        tips: ["Great discipline! Lock this surplus in a high-yield vault.", "Feel free to allocate a small percentage for a treat!"],
      },
  },
  {
    id: 27,
    level: 3,
    evaluate: (s) =>
      s.creditCardPaidOff && {
        ruleId: 27,
        tagline: `Zero Gravity Achieved, ${s.firstName} 🎉 Credit card statement paid in full!`,
        tips: ["Great credit habits! Enjoy zero interest charges.", "Maintain statement balance under 10% next month."],
      },
  },
  {
    id: 33,
    level: 3,
    evaluate: (s) =>
      s.netWorthMilestone !== null && {
        ruleId: 33,
        tagline: `New Altitude Milestone, ${s.firstName} 🏆 Net Worth hit ${fmtMoney(s.netWorthMilestone)}!`,
        tips: ["A major victory! Update your 5-year financial plan.", "Share the win with a low-cost celebration."],
      },
  },
  {
    id: 6,
    level: 3,
    evaluate: (s) =>
      s.savingsGoalStreakMonths >= 3 && {
        ruleId: 6,
        tagline: `Cruising on Autopilot, ${s.firstName} 🌟 3 consecutive months of hitting your savings target.`,
        tips: ["Time to re-evaluate your long-term wealth goals.", "Consider automating monthly index fund contributions."],
      },
  },
  {
    id: 19,
    level: 3,
    evaluate: (s) =>
      s.emergencyFundProgressPct >= 100 && {
        ruleId: 19,
        tagline: `All-Weather Armor Active, ${s.firstName} 🛡️ Fully protected against financial storms.`,
        tips: ["Excess emergency cash can now be routed toward long-term assets.", "Review coverage annually against inflation."],
      },
  },
  {
    id: 18,
    level: 3,
    evaluate: (s) =>
      s.emergencyFundProgressPct >= 15 && s.emergencyFundProgressPct < 30 && {
        ruleId: 18,
        tagline: `Safety Net Deployed, ${s.firstName} 🛟 1 month of living expenses secured.`,
        tips: ["Keep pushing! Next stop: 3 months of basic living costs.", "Keep this fund strictly in a liquid savings account."],
      },
  },
  {
    id: 30,
    level: 3,
    evaluate: (s) =>
      s.creditCardStatement && s.creditCardStatement.amount > 0 && s.creditCardStatement.amount <= s.income * 0.08 && {
        ruleId: 30,
        tagline: `Optimal Aerodynamics, ${s.firstName} 💎 Credit utilization sitting at a perfect low.`,
        tips: ["Your credit health is in top form.", "Maintain this balance ratio across all cards."],
      },
  },
  {
    id: 32,
    level: 3,
    evaluate: (s) =>
      s.investRatePct > 20 && {
        ruleId: 32,
        tagline: `Cruising at Mach Speed, ${s.firstName} 🚀 Investing ${pct(s.investRatePct)} of monthly income.`,
        tips: ["Diversify across asset classes to manage market risk.", "Rebalance portfolio bi-annually."],
      },
  },
  {
    id: 34,
    level: 3,
    evaluate: (s) =>
      s.hasAnyInvestments && s.portfolioGainPct >= 5 && {
        ruleId: 34,
        tagline: `Passive Jet Fuel, ${s.firstName} 💸 Your portfolio is up ${pct(s.portfolioGainPct)}!`,
        tips: ["Re-invest returns to trigger compounding growth.", "Track long-term annual portfolio yield."],
      },
  },
  {
    id: 42,
    level: 3,
    evaluate: (s) =>
      s.scoreDelta !== null && s.scoreDelta >= 10 && {
        ruleId: 42,
        tagline: `Upgraded Flight Rating, ${s.firstName} 📈 Your health score just climbed!`,
        tips: ["Your recent savings habit drove this boost.", "Maintain current spending controls to stay on top."],
      },
  },
  {
    id: 16,
    level: 3,
    evaluate: (s) =>
      s.dayOfMonth >= s.daysInMonth - 2 && s.budgetUsagePct < 95 && {
        ruleId: 16,
        tagline: `Smooth Landing, ${s.firstName} 🛬 Finishing the month under budget!`,
        tips: ["Sweep leftover funds directly into investments.", "Reward yourself with a planned, budget-friendly celebration."],
      },
  },
  {
    id: 28,
    level: 3,
    evaluate: (s) =>
      s.dtiPct > 0 && s.dtiPct < 20 && s.changeVsPrevMonthIncomePct <= 0 && {
        ruleId: 28,
        tagline: `Payload Shedding, ${s.firstName} ✂️ Your debt load is under control.`,
        tips: ["Keep momentum! Re-route freed-up EMI cash into savings.", "Negotiate lower interest rates with lenders."],
      },
  },

  // Level 4 — general optimization & informative tips
  {
    id: 7,
    level: 4,
    evaluate: (s) =>
      s.isPayday && {
        ruleId: 7,
        tagline: `Refueling Completed, ${s.firstName}! ⛽ Paycheck credited today.`,
        tips: ["Pay yourself first! Transfer your target savings immediately.", "Set aside fixed bill amounts upfront."],
      },
  },
  {
    id: 5,
    level: 4,
    evaluate: (s) =>
      s.incomeBonus && {
        ruleId: 5,
        tagline: `Favorable Tailwinds, ${s.firstName}! 🌬️ Unexpected deposit of ${fmtMoney(s.incomeBonus.amount)} detected.`,
        tips: ["Apply the 50/30/20 rule to this windfall.", "Boost your emergency fund before increasing discretionary spending."],
      },
  },
  {
    id: 21,
    level: 4,
    evaluate: (s) =>
      s.unplannedLargeExpense && {
        ruleId: 21,
        tagline: `Uncharted Turbulence, ${s.firstName} 🏥 Unplanned health/repair expense logged.`,
        tips: ["Don't panic! This is what your financial buffer was built for.", "Temporarily pause luxury goals to absorb the impact."],
      },
  },
  {
    id: 20,
    level: 4,
    evaluate: (s) =>
      s.emergencyFundProgressPct > 0 && s.emergencyFundProgressPct < 15 && s.cashFlow < 0 && {
        ruleId: 20,
        tagline: `Shield Activated, ${s.firstName} ⚠️ Reserve funds may be getting tapped.`,
        tips: ["Focus on replenishing your safety buffer over the next 60 days.", "Track the cause to refine future surprise budgets."],
      },
  },
  {
    id: 40,
    level: 4,
    evaluate: (s) =>
      s.impulseBuyCount >= 4 && {
        ruleId: 40,
        tagline: `Crosswind Hazard, ${s.firstName} 🌬️ ${s.impulseBuyCount} small non-essential purchases today.`,
        tips: ["Small daily purchases compound quickly.", "Try a 24-Hour 'No Spend' Challenge tomorrow."],
      },
  },
  {
    id: 12,
    level: 4,
    evaluate: (s) =>
      s.categorySpike && {
        ruleId: 12,
        tagline: `Spike in Sector 4, ${s.firstName} 🍔 ${s.categorySpike.category} expenses up ${pct(s.categorySpike.pctUp)} this week.`,
        tips: ["Try meal prepping for the next 3 days to balance out.", "Set a micro-cap limit for weekend dining."],
      },
  },
  {
    id: 14,
    level: 4,
    evaluate: (s) =>
      s.weekendSpendPct !== null && s.weekendSpendPct >= 55 && {
        ruleId: 14,
        tagline: `Weekend Drift Detected, ${s.firstName} 🛍️ ${pct(s.weekendSpendPct)} of weekly spending occurred on Sat/Sun.`,
        tips: ["Set a weekend fun allowance card to prevent overshooting.", "Track leisure expenses in real-time."],
      },
  },
  {
    id: 8,
    level: 4,
    evaluate: (s) =>
      s.changeVsPrevMonthIncomePct <= -0.15 && {
        ruleId: 8,
        tagline: `Variable Winds Detected, ${s.firstName} 📊 Income dropped ${pct(s.changeVsPrevMonthIncomePct * 100)} compared to last month.`,
        tips: ["Base your monthly baseline budget on your lowest income month.", "Maintain a larger liquid buffer (6 months)."],
      },
  },
  {
    id: 37,
    level: 4,
    evaluate: (s) =>
      s.subscriptionCount >= 3 && {
        ruleId: 37,
        tagline: `Phantom Cargo Detected, ${s.firstName} 👻 ${s.subscriptionCount} active subscriptions logged.`,
        tips: [
          "Audit unused streaming/SaaS memberships.",
          `Cancel 1 unused service to save ${fmtMoney(s.avgSubscriptionAmount * 12)}/yr.`,
        ],
      },
  },
  {
    id: 39,
    level: 4,
    evaluate: (s) =>
      s.daysSinceLastTransaction !== null && s.daysSinceLastTransaction >= 7 && {
        ruleId: 39,
        tagline: `Quiet Skies, ${s.firstName} 🌤️ No expenses logged in 7 days.`,
        tips: ["Log recent cash/offline expenses.", "Keep tracking consistent for accurate insights."],
      },
  },
  {
    id: 9,
    level: 4,
    evaluate: (s) =>
      s.dayOfMonth > s.daysInMonth / 2 && s.budgetUsagePct < 30 && {
        ruleId: 9,
        tagline: `Ultra-Efficient Flight, ${s.firstName} 🛡️ Only ${pct(s.budgetUsagePct)} of budget used past mid-month.`,
        tips: ["You have a comfortable buffer. Rollover savings to next month.", "Consider topping up your holiday/splurge fund."],
      },
  },
  {
    id: 15,
    level: 4,
    evaluate: (s) =>
      s.categorySpike === null && s.budgetUsagePct > 0 && s.budgetUsagePct < 60 && s.dayOfMonth > s.daysInMonth * 0.6 && {
        ruleId: 15,
        tagline: `Fuel Efficiency Achieved, ${s.firstName} 💡 Spending is well under pace this month.`,
        tips: ["Reallocate extra funds to your emergency reserves.", "Lower this category's ceiling next month."],
      },
  },
  {
    id: 31,
    level: 4,
    evaluate: (s) =>
      !s.hasAnyInvestments && {
        ruleId: 31,
        tagline: `Grounded Assets, ${s.firstName} 🏦 No investment contributions logged yet.`,
        tips: ["Start small: Allocate 5% of monthly income to index funds.", "Automate monthly SIPs to build discipline."],
      },
  },
  {
    id: 2,
    level: 4,
    evaluate: (s) =>
      s.savingsRatePct >= -2 && s.savingsRatePct <= 2 && {
        ruleId: 2,
        tagline: `Holding Level, ${s.firstName} ✈️ Income equals expenses this cycle.`,
        tips: ["Aim for a modest 5% auto-savings transfer on payday.", "Identify 2 recurring non-essential expenses to cut this week."],
      },
  },
];

const DEFAULT_INSIGHT: FinancialInsight = {
  ruleId: 0,
  tagline: "Smooth Cruising — on target to hit your monthly goals.",
  tips: ["Review discretionary spending this weekend to keep your safety buffer intact.", "Set aside 5 minutes to categorize any stray transactions from this week."],
};

/** Levels 1-4 in order; within a level, rules fire in the numeric order
 * they're defined above. First match wins. */
export function computeFinancialInsight(signals: FinancialSignals): FinancialInsight {
  for (const level of [1, 2, 3, 4] as const) {
    for (const rule of RULES.filter((r) => r.level === level)) {
      const result = rule.evaluate(signals);
      if (result) return result;
    }
  }
  return DEFAULT_INSIGHT;
}
