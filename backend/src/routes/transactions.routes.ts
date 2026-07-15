import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionsQuerySchema,
} from "../schemas/transaction.schema";
import {
  listTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkDeleteTransactions,
} from "../controllers/transactions.controller";

const router = Router();

router.get("/", validateQuery(listTransactionsQuerySchema), asyncHandler(listTransactions));
router.get("/:id", asyncHandler(getTransaction));
router.post("/", validateBody(createTransactionSchema), asyncHandler(createTransaction));
router.patch("/:id", validateBody(updateTransactionSchema), asyncHandler(updateTransaction));
router.delete("/:id", asyncHandler(deleteTransaction));
router.post("/bulk-delete", asyncHandler(bulkDeleteTransactions));

export default router;
