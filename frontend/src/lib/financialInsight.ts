export interface FinancialInsightInput {
  firstName?: string;
  savingsRatePct: number; // 0-100
  budgetUsagePct: number; // 0-100+
  cashFlow: number;
}

export interface FinancialInsight {
  tagline: string;
  tips: string[];
}

const round = (n: number) => Math.round(n);

/**
 * Ranked rule set — first match wins. Thriving (strong savings + positive
 * cash flow) beats Caution (overspending/negative cash flow), which beats
 * the On Track default, so a user who is both saving well AND slightly over
 * budget still reads as "thriving" rather than getting flagged.
 */
export function computeFinancialInsight({ firstName, savingsRatePct, budgetUsagePct, cashFlow }: FinancialInsightInput): FinancialInsight {
  const name = firstName || "Pilot";

  if (savingsRatePct > 40 && cashFlow >= 0) {
    return {
      tagline: `Tailwinds Ahead, ${name}! 🚀 Your savings rate is soaring at ${round(savingsRatePct)}%.`,
      tips: [
        "Consider shifting 15% of surplus cash flow into investments to accelerate passive growth.",
        "You're outpacing most months — a great time to top up your emergency fund goal.",
      ],
    };
  }

  if (budgetUsagePct > 85 || cashFlow < 0) {
    return {
      tagline: `Approaching Turbulence, ${name} ⚠️ You've utilized ${round(budgetUsagePct)}% of your budget.`,
      tips: [
        "Pause non-essential expenses for the next 4 days to stay clear of overdrafts.",
        "Review your largest recent purchase — a small cutback now protects next month's buffer.",
      ],
    };
  }

  return {
    tagline: `Smooth Cruising, ${name} 🌤️ On target to hit your monthly goals.`,
    tips: [
      "Review discretionary spending this weekend to keep your safety buffer intact.",
      "Set aside 5 minutes to categorize any stray transactions from this week.",
    ],
  };
}
