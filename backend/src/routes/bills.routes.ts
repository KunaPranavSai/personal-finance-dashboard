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
  asyncHandler(async (_req, res) => {
    const items = await prisma.bill.findMany({ orderBy: { dueDate: "asc" } });
    res.json({ items });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const item = await prisma.bill.findUnique({ where: { id } });
    if (!item) throw new ApiError(404, "Bill not found");
    res.json(item);
  })
);

router.post(
  "/",
  validateBody(createBillSchema),
  asyncHandler(async (req, res) => {
    const data = safeBody(createBillSchema, req);
    const item = await prisma.bill.create({ data });
    res.status(201).json(item);
  })
);

router.patch(
  "/:id",
  validateBody(updateBillSchema),
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const data = safeBody(updateBillSchema, req);
    const item = await prisma.bill.update({ where: { id }, data });
    res.json(item);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    await prisma.bill.delete({ where: { id } });
    res.status(204).send();
  })
);

router.post(
  "/bulk-delete",
  asyncHandler(async (req, res) => {
    const { ids } = safeBody(z.object({ ids: z.array(z.string()).nonempty() }), req);
    const result = await prisma.bill.deleteMany({ where: { id: { in: ids } } });
    res.json({ deleted: result.count });
  })
);

export default router;
