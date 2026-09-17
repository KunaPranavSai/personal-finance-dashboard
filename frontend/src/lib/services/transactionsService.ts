// Local-mode ("This Device Only") transaction data access — StorageProvider
// wiring, Master Implementation Plan Phase 0. Drive-mode pages keep calling
// the existing rich `/api/transactions` REST endpoint directly (unchanged,
// zero regression risk); this module is only ever invoked when
// getStorageMode() === "local", and reproduces the same query/response
// shape (search, type filter, pagination, category/account/paymentMethod
// joins) purely client-side over IndexedDB, since the abstraction's
// list()/get() have no query parameters of their own.
import { getStorageProvider } from "@/lib/storage";
import type { Transaction, Category, Account, PaymentMethodType, PaginatedResponse, EntryType } from "@/types";

// Domain types don't declare createdAt/updatedAt (the backend adds them at
// the API boundary), but every StorageProvider record has them — this just
// widens the type for provider calls without changing runtime behavior.
type Stored<T> = T & { createdAt: string; updatedAt: string; [key: string]: unknown };

export interface ListLocalTransactionsParams {
  page: number;
  pageSize: number;
  search?: string;
  type?: "" | EntryType;
  categoryId?: string;
  accountId?: string;
  paymentMethodTypeId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "date" | "amount" | "description";
  sortDir?: "asc" | "desc";
}

export async function listLocalTransactions(params: ListLocalTransactionsParams): Promise<PaginatedResponse<Transaction>> {
  const provider = getStorageProvider();
  const [rawItems, categories, accounts, paymentMethods] = await Promise.all([
    provider.list<Stored<Transaction>>("transactions"),
    provider.list<Stored<Category>>("categories"),
    provider.list<Stored<Account>>("accounts"),
    provider.list<Stored<PaymentMethodType>>("paymentMethods"),
  ]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const paymentMethodById = new Map(paymentMethods.map((p) => [p.id, p]));

  let items: Transaction[] = rawItems.map((t) => ({
    ...t,
    category: t.categoryId ? categoryById.get(t.categoryId) ?? null : null,
    account: t.accountId ? accountById.get(t.accountId) ?? null : null,
    paymentMethodType: t.paymentMethodTypeId ? paymentMethodById.get(t.paymentMethodTypeId) ?? null : null,
  }));

  if (params.type) items = items.filter((t) => t.type === params.type);
  if (params.categoryId) items = items.filter((t) => t.categoryId === params.categoryId);
  if (params.accountId) items = items.filter((t) => t.accountId === params.accountId);
  if (params.paymentMethodTypeId) items = items.filter((t) => t.paymentMethodTypeId === params.paymentMethodTypeId);
  if (params.dateFrom) items = items.filter((t) => t.date >= params.dateFrom!);
  if (params.dateTo) items = items.filter((t) => t.date <= params.dateTo!);
  if (params.search) {
    const q = params.search.toLowerCase();
    items = items.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        (t.merchant ?? "").toLowerCase().includes(q) ||
        (t.notes ?? "").toLowerCase().includes(q)
    );
  }
  const sortBy = params.sortBy ?? "date";
  const sortDir = params.sortDir ?? "desc";
  items.sort((a, b) => {
    let cmp: number;
    if (sortBy === "amount") cmp = Number(a.amount) - Number(b.amount);
    else if (sortBy === "description") cmp = a.description.localeCompare(b.description);
    else cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    return sortDir === "asc" ? cmp : -cmp;
  });

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(Math.max(1, params.page), totalPages);
  const start = (page - 1) * params.pageSize;
  return {
    items: items.slice(start, start + params.pageSize),
    pagination: { page, pageSize: params.pageSize, total, totalPages },
  };
}

/** Throws a plain Error (message = the outcome's message) on failure, so
 * callers can keep using the same `(mutation.error as Error)?.message`
 * pattern they already use for the Drive-backed API path. */
export async function createLocalTransaction(data: Record<string, unknown>): Promise<Transaction> {
  const provider = getStorageProvider();
  const outcome = await provider.create<Stored<Transaction>>("transactions", data as never);
  if (outcome.status !== "success") throw new Error(outcome.message);
  return outcome.data;
}

export async function updateLocalTransaction(id: string, data: Record<string, unknown>): Promise<Transaction> {
  const provider = getStorageProvider();
  const outcome = await provider.update<Stored<Transaction>>("transactions", id, data as never);
  if (outcome.status !== "success") throw new Error(outcome.message);
  return outcome.data;
}

export async function deleteLocalTransaction(id: string): Promise<void> {
  const provider = getStorageProvider();
  const outcome = await provider.remove("transactions", id);
  if (outcome.status !== "success") throw new Error(outcome.message);
}
