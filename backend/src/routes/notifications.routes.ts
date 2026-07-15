import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { z } from "zod";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ items });
  })
);

router.get(
  "/unread-count",
  asyncHandler(async (_req, res) => {
    const count = await prisma.notification.count({ where: { read: false } });
    res.json({ count });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Notification not found");
    const n = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    res.json(n);
  })
);

router.post(
  "/mark-all-read",
  asyncHandler(async (_req, res) => {
    await prisma.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    res.json({ success: true });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Notification not found");
    await prisma.notification.delete({ where: { id } });
    res.json({ success: true });
  })
);

router.delete(
  "/",
  asyncHandler(async (_req, res) => {
    await prisma.notification.deleteMany({});
    res.json({ success: true });
  })
);

export default router;
