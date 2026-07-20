import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middleware/validate";
import { safeParam, safeBody } from "../utils/safeRequest";
import { createInvestmentSchema, updateInvestmentSchema } from "../schemas/investment.schema";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.investment.findMany({ where: { userId: req.auth!.userId }, orderBy: { instrument: "asc" } });
    res.json({ items });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const item = await prisma.investment.findFirst({ where: { id, userId: req.auth!.userId } });
    if (!item) throw new ApiError(404, "Investment not found");
    res.json(item);
  })
);

router.post(
  "/",
  validateBody(createInvestmentSchema),
  asyncHandler(async (req, res) => {
    const data = safeBody(createInvestmentSchema, req);
    const item = await prisma.investment.create({ data: { ...data, userId: req.auth!.userId } });
    res.status(201).json(item);
  })
);

router.patch(
  "/:id",
  validateBody(updateInvestmentSchema),
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const data = safeBody(updateInvestmentSchema, req);
    const existing = await prisma.investment.findFirst({ where: { id, userId: req.auth!.userId } });
    if (!existing) throw new ApiError(404, "Investment not found");
    const item = await prisma.investment.update({ where: { id }, data });
    res.json(item);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const result = await prisma.investment.deleteMany({ where: { id, userId: req.auth!.userId } });
    if (result.count === 0) throw new ApiError(404, "Investment not found");
    res.status(204).send();
  })
);

export default router;
