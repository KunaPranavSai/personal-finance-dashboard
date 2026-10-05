import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { requireDriveConnected } from "../middleware/auth";
import { listRecords } from "../services/drive/dataService";
import { buildLedger, queryLedger, LEDGER_TYPES, LedgerType } from "../lib/ledger";

const router = Router();

// Unified financial ledger (income, expenses, bills, budgets, investments, goals), newest first,
// cursor-paginated for "Load more". The old "/" below is the security/audit log.
router.get(
  "/feed",
  requireDriveConnected,
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const q = req.query as Record<string, string | undefined>;
    const [transactions, bills, budgets, investments, goals, categories] = await Promise.all(
      (["transactions", "bills", "budgets", "investments", "goals", "categories"] as const).map((c) => listRecords(userId, c))
    );
    const types = (q.types ?? "").split(",").filter((t): t is LedgerType => (LEDGER_TYPES as string[]).includes(t));
    const num = (v?: string) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
    res.json(
      queryLedger(buildLedger({ transactions, bills, budgets, investments, goals, categories }), {
        types, from: q.from, to: q.to, min: num(q.min), max: num(q.max), limit: num(q.limit), cursor: q.cursor || null,
      })
    );
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: { userId: req.auth!.userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.activityLog.count({ where: { userId: req.auth!.userId } }),
    ]);
    res.json({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  })
);

export default router;
