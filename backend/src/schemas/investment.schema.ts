import { z } from "zod";

export const createInvestmentSchema = z.object({
  instrument: z.string().min(1, "Instrument is required").max(100),
  category: z.string().min(1, "Category is required").max(50),
  currentValue: z.coerce.number().nonnegative(),
  monthlyContribution: z.coerce.number().nonnegative().default(0),
  annualReturnPct: z.coerce.number().default(0),
});

export const updateInvestmentSchema = z.object({
  instrument: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(50).optional(),
  currentValue: z.coerce.number().nonnegative().optional(),
  monthlyContribution: z.coerce.number().nonnegative().optional(),
  annualReturnPct: z.coerce.number().optional(),
});

export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;
export type UpdateInvestmentInput = z.infer<typeof updateInvestmentSchema>;
