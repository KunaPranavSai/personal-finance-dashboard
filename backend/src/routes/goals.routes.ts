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
  asyncHandler(async (_req, res) => {
    const items = await prisma.goal.findMany({ orderBy: { name: "asc" } });
    res.json({ items });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const item = await prisma.goal.findUnique({ where: { id } });
    if (!item) throw new ApiError(404, "Goal not found");
    res.json(item);
  })
);

router.post(
  "/",
  validateBody(createGoalSchema),
  asyncHandler(async (req, res) => {
    const data = safeBody(createGoalSchema, req);
    const item = await prisma.goal.create({ data });
    res.status(201).json(item);
  })
);

router.patch(
  "/:id",
  validateBody(updateGoalSchema),
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const data = safeBody(updateGoalSchema, req);
    const item = await prisma.goal.update({ where: { id }, data });
    res.json(item);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    await prisma.goal.delete({ where: { id } });
    res.status(204).send();
  })
);

router.post(
  "/bulk-delete",
  asyncHandler(async (req, res) => {
    const { ids } = safeBody(z.object({ ids: z.array(z.string()).nonempty() }), req);
    const result = await prisma.goal.deleteMany({ where: { id: { in: ids } } });
    res.json({ deleted: result.count });
  })
);

export default router;
