// Global search — real data only. Sources:
//  1. A fixed list of the app's own routes/features (client-side match,
//     no network call needed for page navigation).
//  2. The signed-in user's own data — transactions, budgets, investments,
//     bills, goals, accounts (wallets), payment methods (money sources) and
//     categories — via the exact same storage-mode-aware paths already used
//     by each of those pages (local IndexedDB for Local-Only, the existing
//     REST endpoints for Drive mode). The backend scopes every query to
//     req.auth.userId, and the local provider only ever reads this device's
//     own IndexedDB database, so this can never surface another account's
//     data.
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { listLocalTransactions } from "@/lib/services/transactionsService";
import { listLocalBudgets } from "@/lib/services/budgetsService";
import { formatDateIN } from "@/lib/format";
import type {
  PaginatedResponse,
  Transaction,
  Budget,
  Investment,
  Bill,
  Goal,
  Account,
  PaymentMethodType,
  Category,
} from "@/types";

export type SearchResultKind =
  | "page"
  | "transaction"
  | "budget"
  | "investment"
  | "bill"
  | "goal"
  | "account"
  | "paymentMethod"
  | "category";

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  group: string;
  title: string;
  subtitle?: string;
  href: string;
}

// ---------------------------------------------------------------------------
// Fuzzy / partial matching — small and dependency-free by design (the spec
// explicitly asks not to pull in a search-engine dependency for this).
// Tiers, best (lowest number) first: 0 exact, 1 prefix/plural-exact,
// 2 contains, 3 plural-aware contains, 4 small-typo fuzzy.
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function tokenize(s: string): string[] {
  return normalize(s).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Very small, practical singular/plural normalizer — not a full inflector,
 * just enough to make "goal"/"goals", "category"/"categories" etc. match. */
function singularize(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && (w.endsWith("ses") || w.endsWith("xes") || w.endsWith("ches"))) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function tokenMatch(q: string, t: string): { tier: number; dist: number } | null {
  if (!q || !t) return null;
  if (q === t) return { tier: 0, dist: 0 };
  if (t.startsWith(q)) return { tier: 1, dist: t.length - q.length };
  if (t.includes(q)) return { tier: 2, dist: t.length - q.length };
  const sq = singularize(q);
  const st = singularize(t);
  if (sq === st) return { tier: 1, dist: 0 };
  if (sq.length >= 3 && st.startsWith(sq)) return { tier: 3, dist: st.length - sq.length };
  if (sq.length >= 3 && st.includes(sq)) return { tier: 3, dist: st.length - sq.length };
  if (q.length >= 3) {
    const maxDist = q.length <= 4 ? 1 : 2;
    const d = levenshtein(q, t);
    if (d <= maxDist) return { tier: 4, dist: d };
  }
  return null;
}

interface MatchInfo {
  tier: number;
  score: number;
}

/** Matches a (possibly multi-word) query against a searchable target string.
 * Every query token must match some token of the target — via the best
 * available tier — for the whole thing to count as a match (AND across
 * query words), so "money source" only matches targets containing both
 * "money" and "source"-ish tokens, not either alone. */
function matchText(query: string, target: string): MatchInfo | null {
  const qTokens = tokenize(query);
  if (!qTokens.length) return null;
  const tTokens = tokenize(target);
  if (!tTokens.length) return null;

  let worstTier = 0;
  let totalDist = 0;
  for (const qt of qTokens) {
    let best: { tier: number; dist: number } | null = null;
    for (const tt of tTokens) {
      const m = tokenMatch(qt, tt);
      if (m && (!best || m.tier < best.tier || (m.tier === best.tier && m.dist < best.dist))) best = m;
    }
    if (!best) return null;
    worstTier = Math.max(worstTier, best.tier);
    totalDist += best.dist;
  }
  return { tier: worstTier, score: totalDist };
}

function rankResults<T extends { title: string }>(query: string, items: T[], text: (item: T) => string): T[] {
  const scored = items
    .map((item) => ({ item, m: matchText(query, text(item)) }))
    .filter((s): s is { item: T; m: MatchInfo } => s.m !== null);
  scored.sort((a, b) => a.m.tier - b.m.tier || a.m.score - b.m.score || a.item.title.localeCompare(b.item.title));
  return scored.map((s) => s.item);
}

// ---------------------------------------------------------------------------
// Pages / features
// ---------------------------------------------------------------------------

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
  { title: "Settings", href: "/settings", keywords: "settings preferences" },
  { title: "Dark Mode", href: "/settings", keywords: "dark mode theme appearance display light" },
  { title: "Currency, Date & Language", href: "/settings", keywords: "currency date language preferences timezone first day of week" },
  { title: "Notification Preferences", href: "/settings", keywords: "notifications alerts preferences email push budget goal bill reminders" },
  { title: "Export Data", href: "/settings", keywords: "export data csv json download backup" },
  { title: "Privacy", href: "/settings", keywords: "privacy tracking analytics crash reporting" },
  { title: "2FA, Passkeys & Password", href: "/settings/security", keywords: "security 2fa two factor passkey password totp otp authenticator" },
  { title: "Account Recovery", href: "/forgot-password", keywords: "account recovery forgot password reset recovery code" },
  { title: "Storage & Sync", href: "/settings/storage", keywords: "sync storage drive local backup manage disconnect restore" },
  { title: "Privacy Policy", href: "/privacy-policy", keywords: "privacy policy legal" },
  { title: "Terms of Service", href: "/terms", keywords: "terms service legal" },
];

export function searchPages(query: string): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  return rankResults(q, PAGES, (p) => `${p.title} ${p.keywords}`).map((p) => ({
    id: `page:${p.href}:${p.title}`,
    kind: "page" as const,
    group: "Features",
    title: p.title,
    href: p.href,
  }));
}

// ---------------------------------------------------------------------------
// User's own financial data
// ---------------------------------------------------------------------------

const TXN_PAGE_SIZE = 6;
const DATA_RESULT_LIMIT = 6;

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
    group: "Transactions",
    title: t.description,
    subtitle: `${formatDateIN(t.date)} · ${t.type === "INCOME" ? "+" : "-"}${cur(t.amount)}${t.category ? ` · ${t.category.name}` : ""}`,
    href: transactionDestination(t),
  }));
}

function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function fetchBudgets(): Promise<Budget[]> {
  const periodKey = currentPeriodKey();
  return getStorageMode() === "local"
    ? (await listLocalBudgets({ period: "MONTHLY", periodKey })).items
    : (await api.get<{ items: Budget[] }>(`/api/budgets?period=MONTHLY&periodKey=${periodKey}`)).items;
}

async function fetchInvestments(): Promise<Investment[]> {
  return getStorageMode() === "local"
    ? getStorageProvider().list<Investment & { createdAt: string; updatedAt: string; [k: string]: unknown }>("investments")
    : (await api.get<{ items: Investment[] }>("/api/investments")).items;
}

async function fetchBills(): Promise<Bill[]> {
  return getStorageMode() === "local"
    ? getStorageProvider().list<Bill & { createdAt: string; updatedAt: string; [k: string]: unknown }>("bills")
    : (await api.get<{ items: Bill[] }>("/api/bills")).items;
}

async function fetchGoals(): Promise<Goal[]> {
  return getStorageMode() === "local"
    ? getStorageProvider().list<Goal & { createdAt: string; updatedAt: string; [k: string]: unknown }>("goals")
    : (await api.get<{ items: Goal[] }>("/api/goals")).items;
}

async function fetchAccounts(): Promise<Account[]> {
  return getStorageMode() === "local"
    ? getStorageProvider().list<Account & { createdAt: string; updatedAt: string; [k: string]: unknown }>("accounts")
    : (await api.get<{ items: Account[] }>("/api/accounts")).items;
}

async function fetchPaymentMethods(): Promise<PaymentMethodType[]> {
  return getStorageMode() === "local"
    ? getStorageProvider().list<PaymentMethodType & { createdAt: string; updatedAt: string; [k: string]: unknown }>("paymentMethods")
    : (await api.get<{ items: PaymentMethodType[] }>("/api/payment-methods")).items;
}

async function fetchCategories(): Promise<Category[]> {
  return getStorageMode() === "local"
    ? getStorageProvider().list<Category & { createdAt: string; updatedAt: string; [k: string]: unknown }>("categories")
    : (await api.get<{ items: Category[] }>("/api/categories")).items;
}

/** Snapshot of the user's own non-transaction data, fetched once per search
 * session (not per keystroke) so every keystroke after that only re-filters
 * already-fetched real data — live matching without refetching on each key. */
export interface UserDataSnapshot {
  budgets: Budget[];
  investments: Investment[];
  bills: Bill[];
  goals: Goal[];
  accounts: Account[];
  paymentMethods: PaymentMethodType[];
  categories: Category[];
}

const EMPTY_SNAPSHOT: UserDataSnapshot = {
  budgets: [],
  investments: [],
  bills: [],
  goals: [],
  accounts: [],
  paymentMethods: [],
  categories: [],
};

export async function loadUserDataSnapshot(): Promise<UserDataSnapshot> {
  const [budgets, investments, bills, goals, accounts, paymentMethods, categories] = await Promise.all([
    fetchBudgets().catch(() => []),
    fetchInvestments().catch(() => []),
    fetchBills().catch(() => []),
    fetchGoals().catch(() => []),
    fetchAccounts().catch(() => []),
    fetchPaymentMethods().catch(() => []),
    fetchCategories().catch(() => []),
  ]);
  return { budgets, investments, bills, goals, accounts, paymentMethods, categories };
}

/** Pure, synchronous filter/rank over an already-fetched snapshot — this is
 * what runs on every keystroke, so it never waits on the network. */
export function searchUserData(query: string, snapshot: UserDataSnapshot | null, cur: (v: number) => string): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  const s = snapshot ?? EMPTY_SNAPSHOT;
  const results: SearchResult[] = [];

  results.push(
    ...rankResults(q, s.budgets.map((b) => ({ ...b, title: b.category?.name ?? "Budget" })), (b) => `${b.category?.name ?? ""} budget`)
      .slice(0, DATA_RESULT_LIMIT)
      .map((b) => ({
        id: `budget:${b.id}`,
        kind: "budget" as const,
        group: "Budgets",
        title: b.category?.name ?? "Budget",
        subtitle: `${cur(b.actual)} of ${cur(b.amount)} · ${b.periodKey}`,
        href: "/budget",
      }))
  );

  results.push(
    ...rankResults(q, s.investments.map((i) => ({ ...i, title: i.instrument })), (i) => `${i.instrument} ${i.category} ${i.platform ?? ""}`)
      .slice(0, DATA_RESULT_LIMIT)
      .map((i) => ({
        id: `investment:${i.id}`,
        kind: "investment" as const,
        group: "Investments",
        title: i.instrument,
        subtitle: `${i.category} · ${cur(i.currentValue)}`,
        href: "/investments",
      }))
  );

  results.push(
    ...rankResults(q, s.bills.map((b) => ({ ...b, title: b.name })), (b) => `${b.name} ${b.type}`)
      .slice(0, DATA_RESULT_LIMIT)
      .map((b) => ({
        id: `bill:${b.id}`,
        kind: "bill" as const,
        group: "Bills",
        title: b.name,
        subtitle: `${cur(b.amount)} · due ${formatDateIN(b.dueDate)}`,
        href: "/bills",
      }))
  );

  results.push(
    ...rankResults(q, s.goals.map((g) => ({ ...g, title: g.name })), (g) => `${g.name} ${g.category}`)
      .slice(0, DATA_RESULT_LIMIT)
      .map((g) => ({
        id: `goal:${g.id}`,
        kind: "goal" as const,
        group: "Goals",
        title: g.name,
        subtitle: `${cur(g.currentAmount)} of ${cur(g.targetAmount)} · ${g.category}`,
        href: "/goals",
      }))
  );

  results.push(
    ...rankResults(q, s.accounts.map((a) => ({ ...a, title: a.name })), (a) => a.name)
      .slice(0, DATA_RESULT_LIMIT)
      .map((a) => ({
        id: `account:${a.id}`,
        kind: "account" as const,
        group: "Wallets & Accounts",
        title: a.name,
        href: "/customizations",
      }))
  );

  results.push(
    ...rankResults(q, s.paymentMethods.map((p) => ({ ...p, title: p.name })), (p) => p.name)
      .slice(0, DATA_RESULT_LIMIT)
      .map((p) => ({
        id: `paymentMethod:${p.id}`,
        kind: "paymentMethod" as const,
        group: "Money Sources",
        title: p.name,
        href: "/customizations",
      }))
  );

  results.push(
    ...rankResults(q, s.categories.map((c) => ({ ...c, title: c.name })), (c) => c.name)
      .slice(0, DATA_RESULT_LIMIT)
      .map((c) => ({
        id: `category:${c.id}`,
        kind: "category" as const,
        group: "Categories",
        title: c.name,
        href: "/customizations",
      }))
  );

  return results;
}
