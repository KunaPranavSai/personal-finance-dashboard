// Shared helpers for the smart Income/Expense entry form.

/** Ascending, locale-aware, case-insensitive. Always applied at render so user-added options land in place. */
export const sortAlpha = <T,>(items: T[], key: (t: T) => string): T[] =>
  [...items].sort((a, b) => key(a).localeCompare(key(b), undefined, { sensitivity: "base" }));

/** Local calendar date (YYYY-MM-DD) — toISOString() is UTC and flips the day early/late for non-UTC users. */
export const localToday = (): string => new Date().toLocaleDateString("en-CA");

// keyword → candidate category names (first one the user actually has wins).
const RULES: Array<[RegExp, string[]]> = [
  [/salary|payroll|paycheck|wages/i, ["Salary"]],
  [/freelanc|client|project/i, ["Freelancing", "Freelance"]],
  [/interest/i, ["Interest"]],
  [/dividend/i, ["Dividends", "Dividend"]],
  [/rent(al)? income|tenant/i, ["Rental Income"]],
  [/bonus/i, ["Bonus"]],
  [/refund|cashback/i, ["Refunds"]],
  [/grocer|supermarket|vegetable|bigbasket|blinkit|zepto/i, ["Groceries"]],
  [/uber|ola|taxi|cab|metro|bus|petrol|fuel|auto/i, ["Transportation", "Transport"]],
  [/netflix|spotify|prime|hotstar|subscription/i, ["Subscriptions", "Entertainment"]],
  [/electric|water bill|internet|wifi|broadband|recharge|gas bill/i, ["Bills & Utilities", "Utilities"]],
  [/zomato|swiggy|restaurant|lunch|dinner|coffee|cafe|food/i, ["Food", "Food & Dining", "Dining"]],
  [/doctor|pharmacy|medicine|hospital|clinic/i, ["Health", "Healthcare"]],
  [/movie|cinema|game/i, ["Entertainment"]],
  [/flight|hotel|trip|travel/i, ["Travel"]],
  [/amazon|flipkart|myntra|shopping|clothes/i, ["Shopping"]],
  [/school|tuition|course|book/i, ["Education"]],
  [/rent|emi|mortgage/i, ["Housing", "Rent"]],
];

/** Returns the matching category id, or null when there is no confident match (never guess). */
export function suggestCategoryId(description: string, categories: Array<{ id: string; name: string }>): string | null {
  for (const [re, names] of RULES) {
    if (!re.test(description)) continue;
    for (const n of names) {
      const hit = categories.find((c) => c.name.toLowerCase() === n.toLowerCase());
      if (hit) return hit.id;
    }
  }
  return null;
}

if (process.env.NODE_ENV === "test") {
  const cats = [{ id: "1", name: "Salary" }, { id: "2", name: "Groceries" }];
  console.assert(suggestCategoryId("Monthly salary", cats) === "1");
  console.assert(suggestCategoryId("Grocery shopping", cats) === "2");
  console.assert(suggestCategoryId("Payment to XYZ", cats) === null);
  console.assert(sortAlpha(["b", "C", "a"], (x) => x).join() === "a,b,C");
}
