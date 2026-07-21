import { z } from "zod";

export const createInvestmentSchema = z.object({
  instrument: z.string().min(1, "Name is required").max(100),
  category: z.string().min(1, "Category is required").max(50),
  investedAmount: z.coerce.number().nonnegative("Invested amount cannot be negative"),
  currentValue: z.coerce.number().nonnegative("Current value cannot be negative"),
  purchaseDate: z.coerce.date().max(new Date(), "Purchase date cannot be in the future"),
  monthlyContribution: z.coerce.number().nonnegative().default(0),
  annualReturnPct: z.coerce.number().default(0),
  platform: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  isAutoSync: z.boolean().default(false),
});

export const updateInvestmentSchema = z.object({
  instrument: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(50).optional(),
  investedAmount: z.coerce.number().nonnegative().optional(),
  currentValue: z.coerce.number().nonnegative().optional(),
  purchaseDate: z.coerce.date().max(new Date(), "Purchase date cannot be in the future").optional(),
  monthlyContribution: z.coerce.number().nonnegative().optional(),
  annualReturnPct: z.coerce.number().optional(),
  platform: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  isAutoSync: z.boolean().optional(),
});

export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;
export type UpdateInvestmentInput = z.infer<typeof updateInvestmentSchema>;
