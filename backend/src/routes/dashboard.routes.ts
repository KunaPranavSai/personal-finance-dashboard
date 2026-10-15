import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import {
  getDashboardSummary,
  getIncomeExpenseTrend,
  getCategoryBreakdown,
  getDashboardHome,
} from "../controllers/dashboard.controller";

const router = Router();

router.get("/home", asyncHandler(getDashboardHome));
router.get("/summary", asyncHandler(getDashboardSummary));
router.get("/trend/income-expense", asyncHandler(getIncomeExpenseTrend));
router.get("/breakdown/category", asyncHandler(getCategoryBreakdown));

export default router;
