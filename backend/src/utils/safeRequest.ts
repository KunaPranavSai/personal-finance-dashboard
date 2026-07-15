import { Request } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/errorHandler";

export function safeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new ApiError(400, `Missing or invalid path parameter: ${name}`);
  }
  return value;
}

export function safeQuery<T extends z.ZodType>(
  schema: T,
  req: Request
): z.infer<T> {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

export function safeBody<T extends z.ZodType>(
  schema: T,
  req: Request
): z.infer<T> {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
