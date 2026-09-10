import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middleware/validate";
import { safeParam, safeBody } from "../utils/safeRequest";
import { createInvestmentSchema, updateInvestmentSchema } from "../schemas/investment.schema";
import { ApiError } from "../middleware/errorHandler";
import { listRecords, getRecord, createRecord, updateRecord, deleteRecord } from "../services/drive/dataService";
import { DriveRecord } from "../services/drive/types";

interface InvestmentRecord extends DriveRecord {
  instrument: string;
}

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await listRecords<InvestmentRecord>(req.auth!.userId, "investments");
    res.json({ items: [...items].sort((a, b) => a.instrument.localeCompare(b.instrument)) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const item = await getRecord(req.auth!.userId, "investments", id);
    if (!item) throw new ApiError(404, "Investment not found");
    res.json(item);
  })
);

router.post(
  "/",
  validateBody(createInvestmentSchema),
  asyncHandler(async (req, res) => {
    const data = safeBody(createInvestmentSchema, req);
    const idempotencyKey = req.headers["idempotency-key"];
    const item = await createRecord(req.auth!.userId, "investments", { ...data, purchaseDate: data.purchaseDate.toISOString() }, {
      idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
    });
    res.status(201).json(item);
  })
);

router.patch(
  "/:id",
  validateBody(updateInvestmentSchema),
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const data = safeBody(updateInvestmentSchema, req);
    const userId = req.auth!.userId;
    const existing = await getRecord(userId, "investments", id);
    if (!existing) throw new ApiError(404, "Investment not found");
    const patch = { ...data, ...(data.purchaseDate && { purchaseDate: data.purchaseDate.toISOString() }) };
    const item = await updateRecord(userId, "investments", id, patch);
    res.json(item);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const deleted = await deleteRecord(req.auth!.userId, "investments", id);
    if (!deleted) throw new ApiError(404, "Investment not found");
    res.status(204).send();
  })
);

export default router;
