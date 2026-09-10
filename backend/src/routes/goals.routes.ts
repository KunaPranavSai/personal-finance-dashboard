import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middleware/validate";
import { safeParam, safeBody } from "../utils/safeRequest";
import { createGoalSchema, updateGoalSchema } from "../schemas/goal.schema";
import { ApiError } from "../middleware/errorHandler";
import { z } from "zod";
import { listRecords, getRecord, createRecord, updateRecord, deleteRecord, deleteRecords } from "../services/drive/dataService";
import { DriveRecord } from "../services/drive/types";

interface GoalRecord extends DriveRecord {
  name: string;
}

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await listRecords<GoalRecord>(req.auth!.userId, "goals");
    res.json({ items: [...items].sort((a, b) => a.name.localeCompare(b.name)) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const item = await getRecord(req.auth!.userId, "goals", id);
    if (!item) throw new ApiError(404, "Goal not found");
    res.json(item);
  })
);

router.post(
  "/",
  validateBody(createGoalSchema),
  asyncHandler(async (req, res) => {
    const data = safeBody(createGoalSchema, req);
    const idempotencyKey = req.headers["idempotency-key"];
    const item = await createRecord(req.auth!.userId, "goals", data, {
      idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
    });
    res.status(201).json(item);
  })
);

router.patch(
  "/:id",
  validateBody(updateGoalSchema),
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const data = safeBody(updateGoalSchema, req);
    const userId = req.auth!.userId;
    const existing = await getRecord(userId, "goals", id);
    if (!existing) throw new ApiError(404, "Goal not found");
    const item = await updateRecord(userId, "goals", id, data);
    res.json(item);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = safeParam(req, "id");
    const deleted = await deleteRecord(req.auth!.userId, "goals", id);
    if (!deleted) throw new ApiError(404, "Goal not found");
    res.status(204).send();
  })
);

router.post(
  "/bulk-delete",
  asyncHandler(async (req, res) => {
    const { ids } = safeBody(z.object({ ids: z.array(z.string()).nonempty() }), req);
    const deleted = await deleteRecords(req.auth!.userId, "goals", ids);
    res.json({ deleted });
  })
);

export default router;
