import { ExportData } from "./index";

export function generateJSON(data: ExportData): string {
  const output = {
    profile: data.profile ?? {},
    settings: data.settings ?? {},
    transactions: data.transactions.map((t: Record<string, unknown>) => ({
      id: t.id,
      date: String(t.date ?? ""),
      description: String(t.description ?? ""),
      amount: Number(t.amount ?? 0),
      type: String(t.type ?? ""),
      category: t.category ? String((t.category as Record<string, unknown>).name ?? "") : "",
      merchant: String(t.merchant ?? ""),
      account: t.account ? String((t.account as Record<string, unknown>).name ?? "") : "",
      paymentMethod: String(t.paymentMethod ?? ""),
    })),
    budgets: data.budgets.map((b: Record<string, unknown>) => ({
      category: b.category ? String((b.category as Record<string, unknown>).name ?? "") : "",
      period: String(b.period ?? ""),
      amount: Number(b.amount ?? 0),
      actual: Number(b.actual ?? 0),
      remaining: Number(b.remaining ?? 0),
      status: String(b.status ?? ""),
    })),
    investments: data.investments.map((inv: Record<string, unknown>) => ({
      instrument: String(inv.instrument ?? ""),
      category: String(inv.category ?? ""),
      currentValue: Number(inv.currentValue ?? 0),
      monthlyContribution: Number(inv.monthlyContribution ?? 0),
      annualReturnPct: Number(inv.annualReturnPct ?? 0),
    })),
    bills: data.bills.map((b: Record<string, unknown>) => ({
      name: String(b.name ?? ""),
      type: String(b.type ?? ""),
      dueDate: String(b.dueDate ?? ""),
      amount: Number(b.amount ?? 0),
      paidAmount: Number(b.paidAmount ?? 0),
      status: Number(b.paidAmount ?? 0) >= Number(b.amount ?? 0) ? "Paid" : new Date(String(b.dueDate)) < new Date() ? "Overdue" : "Upcoming",
    })),
    goals: data.goals.map((g: Record<string, unknown>) => {
      const tgt = Number(g.targetAmount ?? 0);
      const cur = Number(g.currentAmount ?? 0);
      return {
        name: String(g.name ?? ""),
        category: String(g.category ?? ""),
        targetAmount: tgt,
        currentAmount: cur,
        monthlyContribution: Number(g.monthlyContribution ?? 0),
        progressPct: tgt > 0 ? Number(((cur / tgt) * 100).toFixed(1)) : 0,
      };
    }),
    accounts: data.accounts.map((a: Record<string, unknown>) => String(a.name ?? "")),
    categories: data.categories.map((c: Record<string, unknown>) => ({
      name: String(c.name ?? ""),
      type: String(c.type ?? ""),
    })),
    analyticsSummary: data.analytics ?? {},
    dashboardSummary: data.dashboard ?? {},
    exportedAt: new Date().toISOString(),
    version: "1.0.0",
  };

  return JSON.stringify(output, null, 2);
}
