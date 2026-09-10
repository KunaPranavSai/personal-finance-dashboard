import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middleware/validate";
import { safeParam, safeBody } from "../utils/safeRequest";
import { createBillSchema, updateBillSchema } from "../schemas/bill.schema";
import { ApiError } from "../middleware/errorHandler";
import { z } from "zod";
import { listRecords, getRecord, createRecord, updateRecord, deleteRecord, deleteRecords } from "../services/drive/dataService";
import { DriveRecord } from "../services/drive/types";

interface BillRecord extends DriveRecord {
  dueDate: string;
}

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await listRecords<BillRecord>(req.auth!.userId, "bills");
    res.json({ items: [...items].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const item = await getRecord(req.auth!.userId, "bills", id);
    if (!item) throw new ApiError(404, "Bill not found");
    res.json(item);
  })
);

router.post(
  "/",
  validateBody(createBillSchema),
  asyncHandler(async (req, res) => {
    const data = safeBody(createBillSchema, req);
    const idempotencyKey = req.headers["idempotency-key"];
    const item = await createRecord(req.auth!.userId, "bills", { ...data, dueDate: data.dueDate.toISOString() }, {
      idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
    });
    res.status(201).json(item);
  })
);

router.patch(
  "/:id",
  validateBody(updateBillSchema),
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const data = safeBody(updateBillSchema, req);
    const userId = req.auth!.userId;
    const existing = await getRecord(userId, "bills", id);
    if (!existing) throw new ApiError(404, "Bill not found");
    const patch = { ...data, ...(data.dueDate && { dueDate: data.dueDate.toISOString() }) };
    const item = await updateRecord(userId, "bills", id, patch);
    res.json(item);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const deleted = await deleteRecord(req.auth!.userId, "bills", id);
    if (!deleted) throw new ApiError(404, "Bill not found");
    res.status(204).send();
  })
);

router.post(
  "/bulk-delete",
  asyncHandler(async (req, res) => {
    const { ids } = safeBody(z.object({ ids: z.array(z.string()).nonempty() }), req);
    const deleted = await deleteRecords(req.auth!.userId, "bills", ids);
    res.json({ deleted });
  })
);

export default router;
