import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.activityLog.count(),
    ]);
    res.json({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  })
);

export default router;
