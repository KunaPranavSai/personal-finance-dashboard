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
  asyncHandler(async (_req, res) => {
    const items = await prisma.investment.findMany({ orderBy: { instrument: "asc" } });
    res.json({ items });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const item = await prisma.investment.findUnique({ where: { id } });
    if (!item) throw new ApiError(404, "Investment not found");
    res.json(item);
  })
);

router.post(
  "/",
  validateBody(createInvestmentSchema),
  asyncHandler(async (req, res) => {
    const data = safeBody(createInvestmentSchema, req);
    const item = await prisma.investment.create({ data });
    res.status(201).json(item);
  })
);

router.patch(
  "/:id",
  validateBody(updateInvestmentSchema),
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const data = safeBody(updateInvestmentSchema, req);
    const item = await prisma.investment.update({ where: { id }, data });
    res.json(item);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    await prisma.investment.delete({ where: { id } });
    res.status(204).send();
  })
);

export default router;
