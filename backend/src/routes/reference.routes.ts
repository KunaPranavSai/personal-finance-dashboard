import { Router } from "express";
import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler";
import { safeParam } from "../utils/safeRequest";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { ApiError } from "../middleware/errorHandler";
import { requireDriveConnected } from "../middleware/auth";
import { listRecords, createRecord, updateRecord, deleteRecord, getRecord } from "../services/drive/dataService";
import { DriveRecord } from "../services/drive/types";

interface CategoryRecord extends DriveRecord {
  name: string;
  type: "INCOME" | "EXPENSE";
  subcategories: { id: string; name: string }[];
}
interface TransactionRecord extends DriveRecord {
  categoryId: string;
  accountId?: string | null;
  paymentMethodTypeId?: string | null;
}

const router = Router();
router.use(requireDriveConnected);

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const items = await listRecords<CategoryRecord>(req.auth!.userId, "categories");
    res.json({ items: [...items].sort((a, b) => a.name.localeCompare(b.name)) });
  })
);

router.post(
  "/categories",
  validateBody(z.object({ name: z.string().min(1), type: z.enum(["INCOME", "EXPENSE"]) })),
  asyncHandler(async (req, res) => {
    const { name, type } = req.body as { name: string; type: "INCOME" | "EXPENSE" };
    const category = await createRecord<CategoryRecord>(req.auth!.userId, "categories", { name, type, subcategories: [] });
    res.status(201).json(category);
  })
);

router.post(
  "/categories/:id/subcategories",
  validateBody(z.object({ name: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const categoryId = safeParam(req, "id");
    const userId = req.auth!.userId;
    const category = await getRecord<CategoryRecord>(userId, "categories", categoryId);
    if (!category) throw new ApiError(404, "Category not found");
    const sub = { id: crypto.randomUUID(), name: req.body.name as string };
    const updated = await updateRecord<CategoryRecord>(userId, "categories", categoryId, {
      subcategories: [...category.subcategories, sub],
    });
    res.status(201).json({ ...sub, categoryId: updated.id });
  })
);

router.get(
  "/accounts",
  asyncHandler(async (req, res) => {
    const items = await listRecords(req.auth!.userId, "accounts");
    res.json({ items: [...items].sort((a, b) => (a.name as string).localeCompare(b.name as string)) });
  })
);

const updateAccountSchema = z.object({ name: z.string().min(1).optional() });

router.post(
  "/accounts",
  validateBody(z.object({ name: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const account = await createRecord(req.auth!.userId, "accounts", { name: req.body.name as string });
    res.status(201).json(account);
  })
);

router.patch(
  "/accounts/:id",
  validateBody(updateAccountSchema),
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const userId = req.auth!.userId;
    const existing = await getRecord(userId, "accounts", id);
    if (!existing) throw new ApiError(404, "Account not found");
    const account = await updateRecord(userId, "accounts", id, req.body as { name?: string });
    res.json(account);
  })
);

router.delete(
  "/accounts/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const userId = req.auth!.userId;
    const existing = await getRecord(userId, "accounts", id);
    if (!existing) throw new ApiError(404, "Account not found");
    const transactions = await listRecords<TransactionRecord>(userId, "transactions");
    const linked = transactions.filter((t) => t.accountId === id).length;
    if (linked > 0) throw new ApiError(400, `Cannot delete account with ${linked} linked transaction(s). Archive instead.`);
    await deleteRecord(userId, "accounts", id);
    res.json({ success: true });
  })
);

router.get(
  "/payment-methods",
  asyncHandler(async (req, res) => {
    const items = await listRecords(req.auth!.userId, "paymentMethods");
    res.json({ items: [...items].sort((a, b) => (a.name as string).localeCompare(b.name as string)) });
  })
);

const updatePaymentMethodSchema = z.object({ name: z.string().min(1).optional() });

router.post(
  "/payment-methods",
  validateBody(z.object({ name: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const paymentMethod = await createRecord(req.auth!.userId, "paymentMethods", { name: req.body.name as string });
    res.status(201).json(paymentMethod);
  })
);

router.patch(
  "/payment-methods/:id",
  validateBody(updatePaymentMethodSchema),
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const userId = req.auth!.userId;
    const existing = await getRecord(userId, "paymentMethods", id);
    if (!existing) throw new ApiError(404, "Payment method not found");
    const paymentMethod = await updateRecord(userId, "paymentMethods", id, req.body as { name?: string });
    res.json(paymentMethod);
  })
);

router.delete(
  "/payment-methods/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const userId = req.auth!.userId;
    const existing = await getRecord(userId, "paymentMethods", id);
    if (!existing) throw new ApiError(404, "Payment method not found");
    const transactions = await listRecords<TransactionRecord>(userId, "transactions");
    const linked = transactions.filter((t) => t.paymentMethodTypeId === id).length;
    if (linked > 0) throw new ApiError(400, `Cannot delete payment method with ${linked} linked transaction(s).`);
    await deleteRecord(userId, "paymentMethods", id);
    res.json({ success: true });
  })
);

export default router;
