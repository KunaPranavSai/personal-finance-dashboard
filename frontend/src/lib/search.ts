// Global search — real data only. Two sources:
//  1. A fixed list of the app's own routes (client-side substring match,
//     no network call needed for page navigation).
//  2. The signed-in user's own transactions, via the exact same
//     storage-mode-aware paths already used by the Transactions page
//     (listLocalTransactions for Local-Only, GET /api/transactions
//     for Drive mode) — the backend scopes every query to req.auth.userId,
//     so this can never surface another account's data.
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { listLocalTransactions } from "@/lib/services/transactionsService";
import { formatDateIN } from "@/lib/format";
import type { PaginatedResponse, Transaction } from "@/types";

export interface SearchResult {
  id: string;
  kind: "page" | "transaction";
  title: string;
  subtitle?: string;
  href: string;
}

interface PageEntry {
  title: string;
  href: string;
  keywords: string;
}

const PAGES: PageEntry[] = [
  { title: "Dashboard", href: "/dashboard", keywords: "home dashboard overview net worth" },
  { title: "Transactions", href: "/transactions", keywords: "activity transactions all" },
  { title: "Expenses", href: "/expenses", keywords: "expenses spending" },
  { title: "Income", href: "/income", keywords: "income earnings salary" },
  { title: "Budget", href: "/budget", keywords: "budget categories spending limit" },
  { title: "Investments", href: "/investments", keywords: "investments portfolio stocks mutual funds" },
  { title: "Analytics", href: "/analytics", keywords: "analytics charts custom chart insights" },
  { title: "Bills & EMIs", href: "/bills", keywords: "bills emi recurring subscriptions" },
  { title: "Goals", href: "/goals", keywords: "goals savings target" },
  { title: "Savings", href: "/savings", keywords: "savings" },
  { title: "Wallets, Categories & Money Sources", href: "/customizations", keywords: "wallets accounts categories money source payment method" },
  { title: "Reports", href: "/reports", keywords: "reports export pdf csv" },
  { title: "Notifications", href: "/notifications", keywords: "notifications alerts" },
  { title: "Profile", href: "/profile", keywords: "profile account avatar" },
  { title: "Settings", href: "/settings", keywords: "settings preferences appearance" },
  { title: "Security", href: "/settings/security", keywords: "security 2fa passkey password" },
  { title: "Storage & Sync", href: "/settings/storage", keywords: "sync storage drive local backup" },
];

export function searchPages(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return PAGES.filter((p) => p.title.toLowerCase().includes(q) || p.keywords.includes(q)).map((p) => ({
    id: `page:${p.href}`,
    kind: "page" as const,
    title: p.title,
    href: p.href,
  }));
}

const TXN_PAGE_SIZE = 6;

/** The type-locked page a transaction result should open into — /expenses
 * and /income each only render their own type, so a search result has to
 * land on the one that will actually show it. Mobile's /transactions route
 * is type-agnostic, so it doesn't need this branching (see callers). */
export function transactionDestination(t: Pick<Transaction, "type" | "description">): string {
  const base = t.type === "INCOME" ? "/income" : "/expenses";
  return `${base}?search=${encodeURIComponent(t.description)}`;
}

export async function searchTransactions(query: string, cur: (v: number) => string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const items: Transaction[] =
    getStorageMode() === "local"
      ? (await listLocalTransactions({ page: 1, pageSize: TXN_PAGE_SIZE, search: q })).items
      : (await api.get<PaginatedResponse<Transaction>>(`/api/transactions?page=1&pageSize=${TXN_PAGE_SIZE}&search=${encodeURIComponent(q)}`)).items;

  return items.map((t) => ({
    id: `txn:${t.id}`,
    kind: "transaction" as const,
    title: t.description,
    subtitle: `${formatDateIN(t.date)} · ${t.type === "INCOME" ? "+" : "-"}${cur(t.amount)}${t.category ? ` · ${t.category.name}` : ""}`,
    href: transactionDestination(t),
  }));
}
