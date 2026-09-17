import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  code?: string;
  /** Machine-readable recovery hint (e.g. "RECONNECT_DRIVE", "RETRY",
   * "FREE_DRIVE_SPACE") — lets the frontend show the right action button(s)
   * without string-matching the message. Optional and purely additive; existing
   * callers that only pass (status, message, code) are unaffected. */
  action?: string;
  constructor(status: number, message: string, code?: string, action?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.action = action;
  }
}

/** Short, safe reference the user can quote to support, and the same string
 * to grep for in server logs — never contains any request/user data. */
function generateReferenceId(): string {
  return `PP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", code: "VALIDATION_INVALID_INPUT", details: err.flatten() });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.code && { code: err.code }),
      ...(err.action && { action: err.action }),
    });
  }
  // Prisma known error shape (duck-typed to avoid hard dependency on error classes here)
  const prismaErr = err as { code?: string; meta?: unknown };
  if (prismaErr?.code === "P2002") {
    return res.status(409).json({ error: "A record with these unique fields already exists", code: "VALIDATION_INVALID_INPUT", meta: prismaErr.meta });
  }
  if (prismaErr?.code === "P2025") {
    return res.status(404).json({ error: "Record not found" });
  }
  // Prisma connection-level failures (can't reach Postgres) — distinct from a
  // query-level error, since the safe user-facing action here is "try again
  // shortly," not "check your input."
  if (typeof prismaErr?.code === "string" && ["P1001", "P1002", "P1008", "P1017"].includes(prismaErr.code)) {
    const reference = generateReferenceId();
    console.error(`[${reference}] Database unavailable:`, prismaErr.code);
    return res.status(503).json({ error: "The database is temporarily unavailable. Please try again shortly.", code: "DATABASE_UNAVAILABLE", reference });
  }
  if (err instanceof Error && err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Request origin not allowed", code: "AUTH_FORBIDDEN" });
  }
  const reference = generateReferenceId();
  console.error(`[${reference}]`, err);
  return res.status(500).json({ error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR", reference });
}
