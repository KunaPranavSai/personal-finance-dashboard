import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { safeParam, safeBody } from "../utils/safeRequest";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { userId: req.auth!.userId },
      include: { subcategories: true },
      orderBy: { name: "asc" },
    });
    res.json({ items: categories });
  })
);

router.post(
  "/categories",
  validateBody(z.object({ name: z.string().min(1), type: z.enum(["INCOME", "EXPENSE"]) })),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.create({ data: { ...req.body, userId: req.auth!.userId } });
    res.status(201).json(category);
  })
);

router.post(
  "/categories/:id/subcategories",
  validateBody(z.object({ name: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const categoryId = safeParam(req, "id");
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: req.auth!.userId } });
    if (!category) throw new ApiError(404, "Category not found");
    const sub = await prisma.subcategory.create({
      data: { name: req.body.name, categoryId },
    });
    res.status(201).json(sub);
  })
);

router.get(
  "/accounts",
  asyncHandler(async (req, res) => {
    const accounts = await prisma.account.findMany({ where: { userId: req.auth!.userId }, orderBy: { name: "asc" } });
    res.json({ items: accounts });
  })
);

const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
});

router.post(
  "/accounts",
  validateBody(z.object({ name: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const account = await prisma.account.create({ data: { ...req.body, userId: req.auth!.userId } });
    res.status(201).json(account);
  })
);

router.patch(
  "/accounts/:id",
  validateBody(updateAccountSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.account.findFirst({ where: { id, userId: req.auth!.userId } });
    if (!existing) throw new ApiError(404, "Account not found");
    const account = await prisma.account.update({ where: { id }, data: req.body });
    res.json(account);
  })
);

router.delete(
  "/accounts/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const userId = req.auth!.userId;
    const existing = await prisma.account.findFirst({ where: { id, userId } });
    if (!existing) throw new ApiError(404, "Account not found");
    const txnCount = await prisma.transaction.count({ where: { accountId: id, userId } });
    if (txnCount > 0) throw new ApiError(400, `Cannot delete account with ${txnCount} linked transaction(s). Archive instead.`);
    await prisma.account.delete({ where: { id } });
    res.json({ success: true });
  })
);

router.get(
  "/payment-methods",
  asyncHandler(async (req, res) => {
    const items = await prisma.paymentMethodType.findMany({ where: { userId: req.auth!.userId }, orderBy: { name: "asc" } });
    res.json({ items });
  })
);

const updatePaymentMethodSchema = z.object({
  name: z.string().min(1).optional(),
});

router.post(
  "/payment-methods",
  validateBody(z.object({ name: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const paymentMethod = await prisma.paymentMethodType.create({ data: { ...req.body, userId: req.auth!.userId } });
    res.status(201).json(paymentMethod);
  })
);

router.patch(
  "/payment-methods/:id",
  validateBody(updatePaymentMethodSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.paymentMethodType.findFirst({ where: { id, userId: req.auth!.userId } });
    if (!existing) throw new ApiError(404, "Payment method not found");
    const paymentMethod = await prisma.paymentMethodType.update({ where: { id }, data: req.body });
    res.json(paymentMethod);
  })
);

router.delete(
  "/payment-methods/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const userId = req.auth!.userId;
    const existing = await prisma.paymentMethodType.findFirst({ where: { id, userId } });
    if (!existing) throw new ApiError(404, "Payment method not found");
    const txnCount = await prisma.transaction.count({ where: { paymentMethodTypeId: id, userId } });
    if (txnCount > 0) throw new ApiError(400, `Cannot delete payment method with ${txnCount} linked transaction(s).`);
    await prisma.paymentMethodType.delete({ where: { id } });
    res.json({ success: true });
  })
);

export default router;
