import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middleware/validate";
import { safeParam, safeBody } from "../utils/safeRequest";
import { createGoalSchema, updateGoalSchema } from "../schemas/goal.schema";
import { ApiError } from "../middleware/errorHandler";
import { z } from "zod";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.goal.findMany({ where: { userId: req.auth!.userId }, orderBy: { name: "asc" } });
    res.json({ items });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const item = await prisma.goal.findFirst({ where: { id, userId: req.auth!.userId } });
    if (!item) throw new ApiError(404, "Goal not found");
    res.json(item);
  })
);

router.post(
  "/",
  validateBody(createGoalSchema),
  asyncHandler(async (req, res) => {
    const data = safeBody(createGoalSchema, req);
    const item = await prisma.goal.create({ data: { ...data, userId: req.auth!.userId } });
    res.status(201).json(item);
  })
);

router.patch(
  "/:id",
  validateBody(updateGoalSchema),
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const data = safeBody(updateGoalSchema, req);
    const existing = await prisma.goal.findFirst({ where: { id, userId: req.auth!.userId } });
    if (!existing) throw new ApiError(404, "Goal not found");
    const item = await prisma.goal.update({ where: { id }, data });
    res.json(item);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const result = await prisma.goal.deleteMany({ where: { id, userId: req.auth!.userId } });
    if (result.count === 0) throw new ApiError(404, "Goal not found");
    res.status(204).send();
  })
);

router.post(
  "/bulk-delete",
  asyncHandler(async (req, res) => {
    const { ids } = safeBody(z.object({ ids: z.array(z.string()).nonempty() }), req);
    const result = await prisma.goal.deleteMany({ where: { id: { in: ids }, userId: req.auth!.userId } });
    res.json({ deleted: result.count });
  })
);

export default router;
