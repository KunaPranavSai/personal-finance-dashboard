import { z } from "zod";

export const createBillSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.string().min(1, "Type is required").max(50),
  dueDate: z.coerce.date(),
  amount: z.coerce.number().nonnegative(),
  paidAmount: z.coerce.number().nonnegative().default(0),
  autoPay: z.boolean().default(false),
  interestRate: z.coerce.number().optional().nullable(),
  tenureMonths: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateBillSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.string().min(1).max(50).optional(),
  dueDate: z.coerce.date().optional(),
  amount: z.coerce.number().nonnegative().optional(),
  paidAmount: z.coerce.number().nonnegative().optional(),
  autoPay: z.boolean().optional(),
  interestRate: z.coerce.number().optional().nullable(),
  tenureMonths: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
