/**
 * Illustrative figures for the landing page. One source of truth: the DOM tables and the
 * WebGL threads both read from here, so what you see in 3D always has a text equivalent.
 * Never real user data; the UI labels it "Sample data".
 */
export const INCOME = [
  { id: "salary", label: "Salary", amount: 62000 },
  { id: "freelance", label: "Freelance", amount: 14200 },
  { id: "interest", label: "Interest & dividends", amount: 5000 },
  { id: "other", label: "Other", amount: 3000 },
] as const;

export const INCOME_TOTAL = INCOME.reduce((s, i) => s + i.amount, 0); // 84,200
export const SPENT = 46350;
export const KEPT = INCOME_TOTAL - SPENT; // 37,850

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
