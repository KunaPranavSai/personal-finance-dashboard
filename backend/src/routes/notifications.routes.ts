import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.notification.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ items });
  })
);

router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const count = await prisma.notification.count({ where: { userId: req.auth!.userId, read: false } });
    res.json({ count });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.notification.findFirst({ where: { id, userId: req.auth!.userId } });
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
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.auth!.userId, read: false },
      data: { read: true },
    });
    res.json({ success: true });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await prisma.notification.deleteMany({ where: { id, userId: req.auth!.userId } });
    if (result.count === 0) throw new ApiError(404, "Notification not found");
    res.json({ success: true });
  })
);

router.delete(
  "/",
  asyncHandler(async (req, res) => {
    await prisma.notification.deleteMany({ where: { userId: req.auth!.userId } });
    res.json({ success: true });
  })
);

export default router;
