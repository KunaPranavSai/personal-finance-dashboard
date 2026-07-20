import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { safeBody, safeParam, safeQuery } from "../utils/safeRequest";
import { createTransactionSchema, listTransactionsQuerySchema, updateTransactionSchema } from "../schemas/transaction.schema";
import { ApiError } from "../middleware/errorHandler";

export async function listTransactions(req: Request, res: Response) {
  const query = safeQuery(listTransactionsQuerySchema, req);
  const userId = req.auth!.userId;

  const where: Prisma.TransactionWhereInput = {
    userId,
    ...(query.type && { type: query.type }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.paymentMethodTypeId && { paymentMethodTypeId: query.paymentMethodTypeId }),
    ...(query.accountId && { accountId: query.accountId }),
    ...((query.dateFrom || query.dateTo) && {
      date: { ...(query.dateFrom && { gte: query.dateFrom }), ...(query.dateTo && { lte: query.dateTo }) },
    }),
    ...(query.search && {
      OR: [
        { description: { contains: query.search, mode: "insensitive" } },
        { merchant: { contains: query.search, mode: "insensitive" } },
        { notes: { contains: query.search, mode: "insensitive" } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true, subcategory: true, account: true, paymentMethodType: true },
      orderBy: { [query.sortBy]: query.sortDir },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.transaction.count({ where }),
  ]);

  res.json({
    items,
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  });
}

export async function getTransaction(req: Request, res: Response) {
  const id = safeParam(req, "id");
  const tx = await prisma.transaction.findFirst({
    where: { id, userId: req.auth!.userId },
    include: { category: true, subcategory: true, account: true, paymentMethodType: true },
  });
  if (!tx) throw new ApiError(404, "Transaction not found");
  res.json(tx);
}

export async function createTransaction(req: Request, res: Response) {
  const data = safeBody(createTransactionSchema, req);
  const tx = await prisma.transaction.create({
    data: { ...data, userId: req.auth!.userId },
    include: { category: true, subcategory: true, account: true, paymentMethodType: true },
  });
  res.status(201).json(tx);
}

export async function updateTransaction(req: Request, res: Response) {
  const id = safeParam(req, "id");
  const data = safeBody(updateTransactionSchema, req);
  const existing = await prisma.transaction.findFirst({ where: { id, userId: req.auth!.userId } });
  if (!existing) throw new ApiError(404, "Transaction not found");
  const tx = await prisma.transaction.update({
    where: { id },
    data,
    include: { category: true, subcategory: true, account: true, paymentMethodType: true },
  });
  res.json(tx);
}

export async function deleteTransaction(req: Request, res: Response) {
  const id = safeParam(req, "id");
  const result = await prisma.transaction.deleteMany({ where: { id, userId: req.auth!.userId } });
  if (result.count === 0) throw new ApiError(404, "Transaction not found");
  res.status(204).send();
}

export async function bulkDeleteTransactions(req: Request, res: Response) {
  const { ids } = safeBody(
    z.object({ ids: z.array(z.string()).nonempty() }),
    req
  );
  const result = await prisma.transaction.deleteMany({ where: { id: { in: ids }, userId: req.auth!.userId } });
  res.json({ deleted: result.count });
}
