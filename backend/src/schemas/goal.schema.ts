import { z } from "zod";

export const createGoalSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  category: z.string().min(1, "Category is required").max(50),
  targetAmount: z.coerce.number().positive("Target amount must be positive"),
  currentAmount: z.coerce.number().nonnegative().default(0),
  monthlyContribution: z.coerce.number().nonnegative().default(0),
});

export const updateGoalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(50).optional(),
  targetAmount: z.coerce.number().positive().optional(),
  currentAmount: z.coerce.number().nonnegative().optional(),
  monthlyContribution: z.coerce.number().nonnegative().optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
