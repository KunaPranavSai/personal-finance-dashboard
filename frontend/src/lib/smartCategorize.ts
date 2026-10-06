// Smart categorize: description -> category + wallet / money source.
// 1) Learn from the user's own past transactions (most accurate), 2) keyword rules for common merchants/words,
// 3) otherwise suggest nothing (never guess). The forms always let the user override.
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { listLocalTransactions } from "@/lib/services/transactionsService";
import type { PaginatedResponse, Transaction } from "@/types";

export interface Named { id: string; name: string }
export interface HistoryItem { description: string; type: string; categoryId?: string | null; accountId?: string | null; paymentMethodTypeId?: string | null }
export interface Suggestion { categoryId?: string; accountId?: string; paymentMethodTypeId?: string; reason: "history" | "keyword" }

const STOP = new Set(["the", "a", "an", "to", "for", "of", "and", "on", "in", "at", "my", "via", "from", "with", "paid", "pay", "payment", "bill", "rs", "inr"]);
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t));
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// keyword -> candidate category names (first one the user has wins)
const CATEGORY_RULES: Array<[RegExp, string[]]> = [
  [/salary|payroll|paycheck|wages|stipend/i, ["Salary"]],
  [/freelanc|client|project payment/i, ["Freelancing", "Freelance"]],
  [/interest/i, ["Interest"]],
  [/dividend/i, ["Dividends", "Dividend"]],
  [/rent(al)? income|tenant/i, ["Rental Income"]],
  [/bonus|incentive/i, ["Bonus"]],
  [/refund|cashback|reimburse/i, ["Refunds", "Other"]],
  [/grocer|supermarket|vegetable|fruit|milk|bigbasket|blinkit|zepto|dmart|instamart|kirana/i, ["Groceries", "Food & Dining", "Food"]],
  [/zomato|swiggy|restaurant|lunch|dinner|breakfast|coffee|cafe|pizza|burger|biryani|snack|food|dominos|mcdonald|kfc|starbucks/i, ["Food & Dining", "Food", "Dining"]],
  [/uber|ola\b|rapido|taxi|rickshaw|cabb\b|metro|bus\b|train|irctc|petrol|diesel|fuel|toll|parking|auto\b/i, ["Transportation", "Transport"]],
  [/netflix|spotify|prime|hotstar|youtube|subscription|membership|icloud|google one/i, ["Subscriptions", "Entertainment"]],
  [/electric|water bill|internet|wifi|broadband|recharge|gas bill|airtel|jio\b|vi\b|dth|utility|utilities|lpg/i, ["Bills & Utilities", "Utilities"]],
  [/doctor|pharmacy|medicine|medical|hospital|clinic|apollo|lab test|dental|gym|insurance premium/i, ["Health", "Healthcare", "Health & Fitness"]],
  [/movie|cinema|bookmyshow|game|concert|party|outing/i, ["Entertainment"]],
  [/flight|hotel|trip|travel|holiday|vacation|makemytrip|goibibo|airbnb|booking/i, ["Travel"]],
  [/amazon|flipkart|myntra|ajio|meesho|shopping|clothes|shoes|mall|gadget|electronics/i, ["Shopping"]],
  [/school|tuition|course|udemy|coursera|college|fees|exam|books?\b|stationery/i, ["Education"]],
  [/\brent\b|emi|mortgage|maintenance|society|housing|loan/i, ["Housing", "Rent", "Rent & Housing"]],
  [/donat|charity|gift/i, ["Gifts & Donations", "Gifts", "Other"]],
];

// keyword -> candidate wallet / money-source names
const SOURCE_RULES: Array<[RegExp, string[]]> = [
  [/upi|gpay|google pay|phonepe|paytm|bhim/i, ["UPI", "UPI Wallet", "Digital Wallet"]],
  [/credit card|\bcc\b/i, ["Credit Card"]],
  [/debit card|atm/i, ["Debit Card", "Bank Account"]],
  [/net ?banking|neft|imps|rtgs|bank transfer|cheque/i, ["Net Banking", "Bank Account"]],
  [/\bcash\b/i, ["Cash"]],
];

function pick(candidates: string[], items: Named[]): string | undefined {
  for (const n of candidates) { const hit = items.find((i) => sameName(i.name, n)); if (hit) return hit.id; }
  for (const n of candidates) { const hit = items.find((i) => i.name.toLowerCase().includes(n.toLowerCase())); if (hit) return hit.id; }
  return undefined;
}

function fromHistory(desc: string, type: string, history: HistoryItem[], categories: Named[]): Suggestion | null {
  const q = new Set(tokens(desc));
  if (q.size === 0) return null;
  const catScore = new Map<string, number>();
  const srcScore = new Map<string, { account?: string; pm?: string; score: number }>();
  for (const h of history) {
    if (h.type !== type || !h.categoryId) continue;
    const ht = new Set(tokens(h.description));
    if (ht.size === 0) continue;
    let common = 0; q.forEach((t) => { if (ht.has(t)) common++; });
    if (common === 0) continue;
    const sim = common / (q.size + ht.size - common); // Jaccard
    if (sim < 0.5) continue; // need real overlap, otherwise defer to keyword rules
    catScore.set(h.categoryId, (catScore.get(h.categoryId) ?? 0) + sim);
    const key = `${h.categoryId}|${h.accountId ?? ""}|${h.paymentMethodTypeId ?? ""}`;
    const cur = srcScore.get(key) ?? { account: h.accountId ?? undefined, pm: h.paymentMethodTypeId ?? undefined, score: 0 };
    cur.score += sim; srcScore.set(key, cur);
  }
  let best: string | undefined, top = 0;
  catScore.forEach((s, id) => { if (s > top && categories.some((c) => c.id === id)) { top = s; best = id; } });
  if (!best) return null;
  let src: { account?: string; pm?: string; score: number } | undefined;
  srcScore.forEach((v, key) => { if (key.startsWith(`${best}|`) && (v.account || v.pm) && (!src || v.score > src.score)) src = v; });
  return { categoryId: best, accountId: src?.account, paymentMethodTypeId: src?.pm, reason: "history" };
}

export function suggestFromDescription(
  description: string, type: "EXPENSE" | "INCOME",
  ctx: { categories: Named[]; accounts: Named[]; paymentMethods: Named[]; history: HistoryItem[] },
): Suggestion | null {
  const desc = description.trim();
  if (desc.length < 3) return null;
  const learned = fromHistory(desc, type, ctx.history, ctx.categories);
  let categoryId = learned?.categoryId;
  let reason: Suggestion["reason"] = categoryId ? "history" : "keyword";
  if (!categoryId) {
    for (const [re, names] of CATEGORY_RULES) { if (re.test(desc)) { categoryId = pick(names, ctx.categories); if (categoryId) { reason = "keyword"; break; } } }
  }
  if (!categoryId) { // the description literally mentions one of the user's own categories
    const dt = new Set(tokens(desc));
    const hit = ctx.categories.find((c) => tokens(c.name).some((t) => t.length > 3 && dt.has(t)));
    if (hit) { categoryId = hit.id; reason = "keyword"; }
  }
  let accountId = learned?.accountId, paymentMethodTypeId = learned?.paymentMethodTypeId;
  if (!accountId && !paymentMethodTypeId) {
    for (const [re, names] of SOURCE_RULES) {
      if (!re.test(desc)) continue;
      const pm = pick(names, ctx.paymentMethods); if (pm) { paymentMethodTypeId = pm; break; }
      const ac = pick(names, ctx.accounts); if (ac) { accountId = ac; break; }
    }
  }
  if (!categoryId && !accountId && !paymentMethodTypeId) return null;
  return { categoryId, accountId, paymentMethodTypeId, reason };
}

/** The user's recent transactions, cached for 5 minutes, used to learn description -> category/wallet. */
export function useSmartHistory(): HistoryItem[] {
  const { data } = useQuery({
    queryKey: ["smart-history"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<HistoryItem[]> => {
      const res: PaginatedResponse<Transaction> = getStorageMode() === "local"
        ? await listLocalTransactions({ page: 1, pageSize: 200, sortBy: "date", sortDir: "desc" })
        : await api.get<PaginatedResponse<Transaction>>("/api/transactions?page=1&pageSize=200&sortBy=date&sortDir=desc");
      return res.items.map((t) => ({ description: t.description, type: t.type, categoryId: t.categoryId, accountId: t.accountId, paymentMethodTypeId: t.paymentMethodTypeId }));
    },
  });
  return data ?? [];
}

if (process.env.NODE_ENV === "test") {
  const categories = [{ id: "f", name: "Food & Dining" }, { id: "t", name: "Transportation" }, { id: "u", name: "Bills & Utilities" }, { id: "g", name: "Groceries" }];
  const ctx = { categories, accounts: [{ id: "c", name: "Cash" }], paymentMethods: [{ id: "up", name: "UPI" }], history: [{ description: "Chai at office canteen", type: "EXPENSE", categoryId: "f", paymentMethodTypeId: "up" }] };
  console.assert(suggestFromDescription("swiggy dinner", "EXPENSE", ctx)?.categoryId === "f");
  console.assert(suggestFromDescription("Uber to office", "EXPENSE", ctx)?.categoryId === "t");
  console.assert(suggestFromDescription("electricity bill", "EXPENSE", ctx)?.categoryId === "u");
  console.assert(suggestFromDescription("chai office canteen", "EXPENSE", ctx)?.paymentMethodTypeId === "up");
  console.assert(suggestFromDescription("xyz", "EXPENSE", ctx) === null);
}
