// Capital overview: one summary per management area (Investments, Bills & EMIs, Savings, Budgets).
// Pure and dependency-free so the identical file also runs in the browser for "This Device Only"
// mode (frontend/src/lib/capital.ts is a byte-for-byte copy — keep the two in sync).

type Rec = { id: string; [key: string]: unknown };
export interface CapitalSources {
  investments?: Rec[];
  bills?: Rec[];
  goals?: Rec[];
  budgets?: Rec[];
  transactions?: Rec[];
  categories?: Rec[];
}
export interface Line { label: string; amount: number }

export interface CapitalSummary {
  investments: { invested: number; currentValue: number; gain: number; count: number; byCategory: Line[]; recent: string | null };
  bills: { monthlyTotal: number; count: number; dueThisMonth: number; dueSoonCount: number; nextDue: string | null; top: Line[] };
  savings: { saved: number; count: number; monthlyContribution: number; top: Line[] };
  budgets: { allocated: number; used: number; remaining: number; periodKey: string; top: Array<Line & { limit: number }> };
}

const num = (v: unknown) => Number(v) || 0;
const topN = (m: Map<string, number>, n: number): Line[] =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, amount]) => ({ label, amount }));

export function computeCapital(src: CapitalSources, now = new Date()): CapitalSummary {
  // Investments
  const inv = src.investments ?? [];
  const invCat = new Map<string, number>();
  for (const i of inv) invCat.set(String(i.category || "Other"), (invCat.get(String(i.category || "Other")) ?? 0) + num(i.investedAmount));
  const invested = inv.reduce((s, i) => s + num(i.investedAmount), 0);
  const currentValue = inv.reduce((s, i) => s + num(i.currentValue), 0);
  const recent = [...inv].sort((a, b) => String(b.purchaseDate ?? b.createdAt).localeCompare(String(a.purchaseDate ?? a.createdAt)))[0];

  // Bills & EMIs: "active" = not fully paid
  const bills = (src.bills ?? []).filter((b) => num(b.amount) > num(b.paidAmount));
  const monthKey = now.toISOString().slice(0, 7);
  const soonEnd = now.getTime() + 7 * 86400000;
  const outstanding = (b: Rec) => num(b.amount) - num(b.paidAmount);
  const dueThisMonth = bills.filter((b) => String(b.dueDate).slice(0, 7) === monthKey).reduce((s, b) => s + outstanding(b), 0);
  const dueSoonCount = bills.filter((b) => { const t = Date.parse(String(b.dueDate)); return t >= now.getTime() - 86400000 && t <= soonEnd; }).length;
  const upcoming = bills.map((b) => String(b.dueDate)).filter((d) => Date.parse(d) >= now.getTime() - 86400000).sort()[0];
  const billByType = new Map<string, number>();
  for (const b of bills) billByType.set(String(b.type || "Other"), (billByType.get(String(b.type || "Other")) ?? 0) + num(b.amount));

  // Savings = goals (saving plans)
  const goals = src.goals ?? [];
  const goalLines = new Map<string, number>();
  for (const g of goals) goalLines.set(String(g.name), num(g.currentAmount));

  // Budgets: this month, "used" = this month's expenses in the budgeted categories
  const catName = new Map((src.categories ?? []).map((c) => [c.id, String(c.name)]));
  const budgets = (src.budgets ?? []).filter((b) => b.periodKey === monthKey);
  const spent = new Map<string, number>();
  for (const t of src.transactions ?? []) {
    if (t.type === "EXPENSE" && String(t.date).slice(0, 7) === monthKey) spent.set(String(t.categoryId), (spent.get(String(t.categoryId)) ?? 0) + num(t.amount));
  }
  const rows = budgets.map((b) => ({ label: catName.get(String(b.categoryId)) ?? "Category", amount: spent.get(String(b.categoryId)) ?? 0, limit: num(b.amount) }));
  const allocated = rows.reduce((s, r) => s + r.limit, 0);
  const used = rows.reduce((s, r) => s + r.amount, 0);

  return {
    investments: { invested, currentValue, gain: currentValue - invested, count: inv.length, byCategory: topN(invCat, 3), recent: recent ? String(recent.instrument) : null },
    bills: { monthlyTotal: bills.reduce((s, b) => s + num(b.amount), 0), count: bills.length, dueThisMonth, dueSoonCount, nextDue: upcoming ?? null, top: topN(billByType, 4) },
    savings: { saved: goals.reduce((s, g) => s + num(g.currentAmount), 0), count: goals.length, monthlyContribution: goals.reduce((s, g) => s + num(g.monthlyContribution), 0), top: topN(goalLines, 4) },
    budgets: { allocated, used, remaining: allocated - used, periodKey: monthKey, top: rows.sort((a, b) => b.limit - a.limit).slice(0, 4) },
  };
}

if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
  const c = computeCapital(
    {
      investments: [{ id: "1", category: "Equity", investedAmount: 100, currentValue: 120, instrument: "X", createdAt: "2026-01-01" }],
      bills: [{ id: "b", type: "Rent", amount: 500, paidAmount: 0, dueDate: "2026-10-09T00:00:00.000Z" }, { id: "p", type: "Loan", amount: 100, paidAmount: 100, dueDate: "2026-10-01" }],
      goals: [{ id: "g", name: "Trip", currentAmount: 40, monthlyContribution: 10 }],
      budgets: [{ id: "u", categoryId: "c1", periodKey: "2026-10", amount: 300 }],
      transactions: [{ id: "t", type: "EXPENSE", categoryId: "c1", amount: 120, date: "2026-10-02" }],
      categories: [{ id: "c1", name: "Food" }],
    },
    new Date("2026-10-05T10:00:00.000Z")
  );
  console.assert(c.investments.gain === 20 && c.investments.count === 1, "investments");
  console.assert(c.bills.count === 1 && c.bills.dueThisMonth === 500 && c.bills.dueSoonCount === 1, "bills skip fully paid");
  console.assert(c.savings.saved === 40 && c.savings.monthlyContribution === 10, "savings");
  console.assert(c.budgets.allocated === 300 && c.budgets.used === 120 && c.budgets.remaining === 180, "budgets");
}
