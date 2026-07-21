import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", details: err.flatten() });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Prisma known error shape (duck-typed to avoid hard dependency on error classes here)
  const prismaErr = err as { code?: string; meta?: unknown };
  if (prismaErr?.code === "P2002") {
    return res.status(409).json({ error: "A record with these unique fields already exists", meta: prismaErr.meta });
  }
  if (prismaErr?.code === "P2025") {
    return res.status(404).json({ error: "Record not found" });
  }
  if (err instanceof Error && err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Request origin not allowed" });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
