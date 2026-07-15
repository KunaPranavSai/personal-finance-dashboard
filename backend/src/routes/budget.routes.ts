import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody, validateQuery } from "../middleware/validate";
import { createBudgetSchema, updateBudgetSchema, listBudgetsQuerySchema } from "../schemas/budget.schema";
import { listBudgets, createBudget, updateBudget, deleteBudget } from "../controllers/budget.controller";

const router = Router();

router.get("/", validateQuery(listBudgetsQuerySchema), asyncHandler(listBudgets));
router.post("/", validateBody(createBudgetSchema), asyncHandler(createBudget));
router.patch("/:id", validateBody(updateBudgetSchema), asyncHandler(updateBudget));
router.delete("/:id", asyncHandler(deleteBudget));

export default router;
