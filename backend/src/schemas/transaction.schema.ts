import { z } from "zod";

export const entryTypeEnum = z.enum(["INCOME", "EXPENSE"]);
export const paymentMethodEnum = z.enum([
  "CASH", "UPI", "CREDIT_CARD", "DEBIT_CARD", "NET_BANKING", "WALLET",
]);
export const fixedVariableEnum = z.enum(["FIXED", "VARIABLE"]);
export const essentialityEnum = z.enum(["ESSENTIAL", "NON_ESSENTIAL"]);

export const createTransactionSchema = z.object({
  date: z.coerce.date(),
  description: z.string().min(1, "Description is required").max(200),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  type: entryTypeEnum,
  categoryId: z.string().min(1, "Category is required"),
  subcategoryId: z.string().optional().nullable(),
  merchant: z.string().max(100).optional().nullable(),
  accountId: z.string().optional().nullable(),
  paymentMethod: paymentMethodEnum.optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(1000).optional().nullable(),
  recurring: z.boolean().default(false),
  fixedVariable: fixedVariableEnum.optional().nullable(),
  essentiality: essentialityEnum.optional().nullable(),
  attachmentUrl: z.string().url().optional().nullable(),
});

export const updateTransactionSchema = z.object({
  date: z.coerce.date().optional(),
  description: z.string().min(1).max(200).optional(),
  amount: z.coerce.number().positive().optional(),
  type: entryTypeEnum.optional(),
  categoryId: z.string().min(1).optional(),
  subcategoryId: z.string().optional().nullable(),
  merchant: z.string().max(100).optional().nullable(),
  accountId: z.string().optional().nullable(),
  paymentMethod: paymentMethodEnum.optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(1000).optional().nullable(),
  recurring: z.boolean().optional(),
  fixedVariable: fixedVariableEnum.optional().nullable(),
  essentiality: essentialityEnum.optional().nullable(),
  attachmentUrl: z.string().url().optional().nullable(),
});

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  type: entryTypeEnum.optional(),
  categoryId: z.string().optional(),
  paymentMethod: paymentMethodEnum.optional(),
  accountId: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(["date", "amount", "description"]).default("date"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
