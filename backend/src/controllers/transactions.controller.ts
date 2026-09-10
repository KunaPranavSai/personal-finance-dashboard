import { Request, Response } from "express";
import { z } from "zod";
import { safeBody, safeParam, safeQuery } from "../utils/safeRequest";
import { createTransactionSchema, listTransactionsQuerySchema, updateTransactionSchema } from "../schemas/transaction.schema";
import { ApiError } from "../middleware/errorHandler";
import { listRecords, createRecord, updateRecord, deleteRecord, deleteRecords } from "../services/drive/dataService";
import { DriveRecord } from "../services/drive/types";

interface CategoryRecord extends DriveRecord {
  name: string;
  type: "INCOME" | "EXPENSE";
  subcategories: { id: string; name: string }[];
}
interface AccountRecord extends DriveRecord {
  name: string;
}
interface PaymentMethodRecord extends DriveRecord {
  name: string;
}
interface TransactionRecord extends DriveRecord {
  date: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  categoryId: string;
  subcategoryId?: string | null;
  merchant?: string | null;
  accountId?: string | null;
  paymentMethodTypeId?: string | null;
  location?: string | null;
  tags: string[];
  notes?: string | null;
  recurring: boolean;
  fixedVariable?: string | null;
  essentiality?: string | null;
  attachmentUrl?: string | null;
}

/** Attaches the same nested category/subcategory/account/paymentMethodType shape the frontend
 * already expects from the old Prisma `include`, joined in-memory against the sibling collections. */
async function enrichTransaction(userId: string, t: TransactionRecord) {
  const [categories, accounts, paymentMethods] = await Promise.all([
    listRecords<CategoryRecord>(userId, "categories"),
    listRecords<AccountRecord>(userId, "accounts"),
    listRecords<PaymentMethodRecord>(userId, "paymentMethods"),
  ]);
  const category = categories.find((c) => c.id === t.categoryId) ?? null;
  const subcategory = category?.subcategories.find((s) => s.id === t.subcategoryId) ?? null;
  const account = t.accountId ? accounts.find((a) => a.id === t.accountId) ?? null : null;
  const paymentMethodType = t.paymentMethodTypeId ? paymentMethods.find((p) => p.id === t.paymentMethodTypeId) ?? null : null;

  return {
    ...t,
    category: category ? { id: category.id, name: category.name, type: category.type } : null,
    subcategory: subcategory ? { id: subcategory.id, name: subcategory.name } : null,
    account: account ? { id: account.id, name: account.name } : null,
    paymentMethodType: paymentMethodType ? { id: paymentMethodType.id, name: paymentMethodType.name } : null,
  };
}

async function enrichTransactions(userId: string, items: TransactionRecord[]) {
  const [categories, accounts, paymentMethods] = await Promise.all([
    listRecords<CategoryRecord>(userId, "categories"),
    listRecords<AccountRecord>(userId, "accounts"),
    listRecords<PaymentMethodRecord>(userId, "paymentMethods"),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const paymentMethodMap = new Map(paymentMethods.map((p) => [p.id, p]));

  return items.map((t) => {
    const category = categoryMap.get(t.categoryId) ?? null;
    const subcategory = category?.subcategories.find((s) => s.id === t.subcategoryId) ?? null;
    const account = t.accountId ? accountMap.get(t.accountId) ?? null : null;
    const paymentMethodType = t.paymentMethodTypeId ? paymentMethodMap.get(t.paymentMethodTypeId) ?? null : null;
    return {
      ...t,
      category: category ? { id: category.id, name: category.name, type: category.type } : null,
      subcategory: subcategory ? { id: subcategory.id, name: subcategory.name } : null,
      account: account ? { id: account.id, name: account.name } : null,
      paymentMethodType: paymentMethodType ? { id: paymentMethodType.id, name: paymentMethodType.name } : null,
    };
  });
}

export async function listTransactions(req: Request, res: Response) {
  const query = safeQuery(listTransactionsQuerySchema, req);
  const userId = req.auth!.userId;

  let items = await listRecords<TransactionRecord>(userId, "transactions");

  if (query.type) items = items.filter((t) => t.type === query.type);
  if (query.categoryId) items = items.filter((t) => t.categoryId === query.categoryId);
  if (query.paymentMethodTypeId) items = items.filter((t) => t.paymentMethodTypeId === query.paymentMethodTypeId);
  if (query.accountId) items = items.filter((t) => t.accountId === query.accountId);
  if (query.dateFrom) items = items.filter((t) => new Date(t.date) >= query.dateFrom!);
  if (query.dateTo) items = items.filter((t) => new Date(t.date) <= query.dateTo!);
  if (query.search) {
    const needle = query.search.toLowerCase();
    items = items.filter(
      (t) =>
        t.description.toLowerCase().includes(needle) ||
        (t.merchant ?? "").toLowerCase().includes(needle) ||
        (t.notes ?? "").toLowerCase().includes(needle)
    );
  }

  const dir = query.sortDir === "asc" ? 1 : -1;
  items = [...items].sort((a, b) => {
    if (query.sortBy === "amount") return (a.amount - b.amount) * dir;
    if (query.sortBy === "description") return a.description.localeCompare(b.description) * dir;
    return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
  });

  const total = items.length;
  const start = (query.page - 1) * query.pageSize;
  const page = items.slice(start, start + query.pageSize);
  const enriched = await enrichTransactions(userId, page);

  res.json({
    items: enriched,
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  });
}

export async function getTransaction(req: Request, res: Response) {
  const id = safeParam(req, "id");
  const userId = req.auth!.userId;
  const items = await listRecords<TransactionRecord>(userId, "transactions");
  const tx = items.find((t) => t.id === id);
  if (!tx) throw new ApiError(404, "Transaction not found");
  res.json(await enrichTransaction(userId, tx));
}

export async function createTransaction(req: Request, res: Response) {
  const data = safeBody(createTransactionSchema, req);
  const userId = req.auth!.userId;
  const idempotencyKey = req.headers["idempotency-key"];
  const tx = await createRecord<TransactionRecord>(
    userId,
    "transactions",
    { ...data, date: data.date.toISOString() } as unknown as Omit<TransactionRecord, "id" | "createdAt" | "updatedAt">,
    { idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined }
  );
  res.status(201).json(await enrichTransaction(userId, tx));
}

export async function updateTransaction(req: Request, res: Response) {
  const id = safeParam(req, "id");
  const data = safeBody(updateTransactionSchema, req);
  const userId = req.auth!.userId;
  const patch = { ...data, ...(data.date && { date: data.date.toISOString() }) };
  const tx = await updateRecord<TransactionRecord>(userId, "transactions", id, patch as Partial<Omit<TransactionRecord, "id" | "createdAt" | "updatedAt">>);
  res.json(await enrichTransaction(userId, tx));
}

export async function deleteTransaction(req: Request, res: Response) {
  const id = safeParam(req, "id");
  const deleted = await deleteRecord(req.auth!.userId, "transactions", id);
  if (!deleted) throw new ApiError(404, "Transaction not found");
  res.status(204).send();
}

export async function bulkDeleteTransactions(req: Request, res: Response) {
  const { ids } = safeBody(z.object({ ids: z.array(z.string()).nonempty() }), req);
  const deleted = await deleteRecords(req.auth!.userId, "transactions", ids);
  res.json({ deleted });
}
