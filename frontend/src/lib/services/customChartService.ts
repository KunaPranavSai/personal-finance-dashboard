// Data for the Analytics "Custom Chart" builder's Daily/Weekly/Year-to-Date
// groupings. Monthly grouping reuses the existing monthly `trend` array from
// getLocalAnalyticsSummary/`/api/analytics/summary` directly — this module
// only covers the finer/derived groupings those endpoints don't aggregate
// at, by pulling the same real transactions already exposed via
// listLocalTransactions/`/api/transactions` (same filters, same data, no
// mock/sample values) and bucketing them client-side.
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { listLocalTransactions } from "@/lib/services/transactionsService";
import type { AnalyticsFilters } from "@/lib/services/analyticsService";
import type { PaginatedResponse, Transaction } from "@/types";

const API_PAGE_SIZE = 200; // backend's listTransactionsQuerySchema hard cap

export interface ChartPoint {
  bucket: string;
  income: number;
  expense: number;
  savings: number;
  transactions: number;
  netCashFlow: number;
}

/** Fetches every transaction matching the given filters — looping pages for
 * the Drive-backed REST API (capped at 200/page server-side), or a single
 * large-pageSize call for Local-Only mode (an in-memory slice, no real
 * pagination cost). Reused as-is from the existing Transactions list
 * data path; no new backend capability. */
async function fetchAllTransactions(filters: AnalyticsFilters): Promise<Transaction[]> {
  if (getStorageMode() === "local") {
    const res = await listLocalTransactions({
      page: 1,
      pageSize: 1_000_000,
      categoryId: filters.categoryId,
      accountId: filters.accountId,
      paymentMethodTypeId: filters.paymentMethodTypeId,
      dateFrom: filters.from,
      dateTo: filters.to,
    });
    return res.items;
  }

  const items: Transaction[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const params = new URLSearchParams({ page: String(page), pageSize: String(API_PAGE_SIZE) });
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.accountId) params.set("accountId", filters.accountId);
    if (filters.paymentMethodTypeId) params.set("paymentMethodTypeId", filters.paymentMethodTypeId);
    const res = await api.get<PaginatedResponse<Transaction>>(`/api/transactions?${params.toString()}`);
    items.push(...res.items);
    totalPages = res.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);
  return items;
}

function isoWeekKey(date: Date): string {
  // ISO 8601 week: Thursday of the week's calendar year determines the
  // week-year, weeks start Monday.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Buckets real transactions by day or ISO week and returns them in
 * chronological order, ready to feed straight into the same chart used for
 * Monthly grouping. */
export async function getGroupedChartData(filters: AnalyticsFilters, grouping: "daily" | "weekly"): Promise<ChartPoint[]> {
  const transactions = await fetchAllTransactions(filters);
  const buckets = new Map<string, { income: number; expense: number; count: number }>();

  for (const t of transactions) {
    const d = new Date(t.date);
    const key = grouping === "daily" ? t.date.slice(0, 10) : isoWeekKey(d);
    const bucket = buckets.get(key) ?? { income: 0, expense: 0, count: 0 };
    if (t.type === "INCOME") bucket.income += Number(t.amount);
    else bucket.expense += Number(t.amount);
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, v]) => ({
      bucket,
      income: v.income,
      expense: v.expense,
      savings: v.income - v.expense,
      transactions: v.count,
      netCashFlow: v.income - v.expense,
    }));
}

/** Year-to-date grouping is a running cumulative total across the current
 * calendar year's monthly buckets — a real transform of the same monthly
 * trend data already fetched for the page, not a separate data source. */
export function getYearToDateChartData(trend: { month: string; income: number; expense: number; count: number }[]): ChartPoint[] {
  const currentYear = String(new Date().getFullYear());
  let income = 0;
  let expense = 0;
  let count = 0;
  return trend
    .filter((t) => t.month.startsWith(currentYear))
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((t) => {
      income += t.income;
      expense += t.expense;
      count += t.count;
      return { bucket: t.month, income, expense, savings: income - expense, transactions: count, netCashFlow: income - expense };
    });
}
