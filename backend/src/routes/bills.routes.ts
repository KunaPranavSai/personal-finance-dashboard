import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middleware/validate";
import { safeParam, safeBody } from "../utils/safeRequest";
import { createBillSchema, updateBillSchema } from "../schemas/bill.schema";
import { ApiError } from "../middleware/errorHandler";
import { z } from "zod";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.bill.findMany({ where: { userId: req.auth!.userId }, orderBy: { dueDate: "asc" } });
    res.json({ items });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const item = await prisma.bill.findFirst({ where: { id, userId: req.auth!.userId } });
    if (!item) throw new ApiError(404, "Bill not found");
    res.json(item);
  })
);

router.post(
  "/",
  validateBody(createBillSchema),
  asyncHandler(async (req, res) => {
    const data = safeBody(createBillSchema, req);
    const item = await prisma.bill.create({ data: { ...data, userId: req.auth!.userId } });
    res.status(201).json(item);
  })
);

router.patch(
  "/:id",
  validateBody(updateBillSchema),
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const data = safeBody(updateBillSchema, req);
    const existing = await prisma.bill.findFirst({ where: { id, userId: req.auth!.userId } });
    if (!existing) throw new ApiError(404, "Bill not found");
    const item = await prisma.bill.update({ where: { id }, data });
    res.json(item);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const result = await prisma.bill.deleteMany({ where: { id, userId: req.auth!.userId } });
    if (result.count === 0) throw new ApiError(404, "Bill not found");
    res.status(204).send();
  })
);

router.post(
  "/bulk-delete",
  asyncHandler(async (req, res) => {
    const { ids } = safeBody(z.object({ ids: z.array(z.string()).nonempty() }), req);
    const result = await prisma.bill.deleteMany({ where: { id: { in: ids }, userId: req.auth!.userId } });
    res.json({ deleted: result.count });
  })
);

export default router;
