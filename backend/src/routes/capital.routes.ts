import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { listRecords } from "../services/drive/dataService";
import { computeCapital } from "../lib/capital";

const router = Router();

// One request for the whole Capital overview (investments, bills & EMIs, savings, budgets).
router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const [investments, bills, goals, budgets, transactions, categories] = await Promise.all(
      (["investments", "bills", "goals", "budgets", "transactions", "categories"] as const).map((c) => listRecords(userId, c))
    );
    res.json(computeCapital({ investments, bills, goals, budgets, transactions, categories }));
  })
);

export default router;
