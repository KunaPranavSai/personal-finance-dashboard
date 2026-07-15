import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import {
  getDashboardSummary,
  getIncomeExpenseTrend,
  getCategoryBreakdown,
} from "../controllers/dashboard.controller";

const router = Router();

router.get("/summary", asyncHandler(getDashboardSummary));
router.get("/trend/income-expense", asyncHandler(getIncomeExpenseTrend));
router.get("/breakdown/category", asyncHandler(getCategoryBreakdown));

export default router;
