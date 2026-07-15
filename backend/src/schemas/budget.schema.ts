import { z } from "zod";

export const budgetPeriodEnum = z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]);

export const createBudgetSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  period: budgetPeriodEnum.default("MONTHLY"),
  // e.g. "2026-07" (monthly), "2026-Q2" (quarterly), "2026" (yearly)
  periodKey: z.string().min(4, "Period key is required"),
  amount: z.coerce.number().nonnegative(),
});

export const updateBudgetSchema = z.object({
  categoryId: z.string().min(1).optional(),
  period: budgetPeriodEnum.optional(),
  periodKey: z.string().min(4).optional(),
  amount: z.coerce.number().nonnegative().optional(),
});

export const listBudgetsQuerySchema = z.object({
  period: budgetPeriodEnum.optional(),
  periodKey: z.string().optional(),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
