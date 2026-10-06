import { Request, Response, NextFunction } from "express";
import { ZodError, ZodIssue } from "zod";

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
  res.status(404).json({ error: "We couldn't find what you were looking for.", code: "NOT_FOUND" });
}

/** "monthlyIncome" -> "Monthly income" */
function humanField(path: PropertyKey[]): string {
  const last = [...path].reverse().find((p) => typeof p === "string") as string | undefined;
  if (!last) return "This field";
  const words = last.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Turns a Zod issue into a sentence a person can act on. Messages the schema author wrote are kept as-is.
 * (Typed loosely on purpose: the issue shape differs slightly between Zod majors.) */
export function friendlyIssue(raw: ZodIssue): string {
  const issue = raw as unknown as Record<string, unknown> & { path: PropertyKey[]; message: string; code: string };
  const field = humanField(issue.path);
  const msg = issue.message;
  const isDefault = /^(Required|Invalid|Too small|Too big|Expected|String must|Number must|Array must)/.test(msg);
  if (!isDefault) return msg;
  const kind = String(issue.origin ?? issue.type ?? "");
  const min = issue.minimum, max = issue.maximum;
  switch (issue.code) {
    case "invalid_type": {
      const received = String(issue.received ?? "");
      if (/undefined|null/i.test(received) || /received undefined|received null/i.test(msg)) return `${field} is required.`;
      if (issue.expected === "number") return `${field} must be a number.`;
      if (issue.expected === "date") return `${field} must be a valid date.`;
      return `${field} isn't in the expected format.`;
    }
    case "too_small":
      if (kind === "string") return min === 1 || min === 1n ? `${field} is required.` : `${field} must be at least ${String(min)} characters.`;
      if (kind === "number") return `${field} must be ${issue.inclusive ? "at least" : "more than"} ${String(min)}.`;
      return `${field} needs at least ${String(min)} item${String(min) === "1" ? "" : "s"}.`;
    case "too_big":
      if (kind === "string") return `${field} is too long (max ${String(max)} characters).`;
      if (kind === "number") return `${field} must be ${issue.inclusive ? "at most" : "less than"} ${String(max)}.`;
      return `${field} has too many items (max ${String(max)}).`;
    case "invalid_format":
    case "invalid_string":
      if (issue.format === "email" || issue.validation === "email") return `${field} must be a valid email address.`;
      if (issue.format === "url" || issue.validation === "url") return `${field} must be a valid link.`;
      return `${field} isn't in the expected format.`;
    case "invalid_date":
      return `${field} must be a valid date.`;
    case "invalid_value":
    case "invalid_enum_value":
      return `${field} must be one of the available options.`;
    default:
      return `${field} isn't valid.`;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    // fieldErrors: { field: [friendly messages] } so the UI can mark the exact input; error: the first one, in plain words.
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.length ? issue.path.map(String).join(".") : "_";
      (fieldErrors[key] ??= []).push(friendlyIssue(issue));
    }
    const first = err.issues[0] ? friendlyIssue(err.issues[0]) : "Please check the highlighted fields.";
    return res.status(400).json({
      error: err.issues.length > 1 ? `${first} (and ${err.issues.length - 1} more to fix)` : first,
      code: "VALIDATION_INVALID_INPUT",
      details: { formErrors: fieldErrors._ ?? [], fieldErrors },
    });
  }
  // body-parser: oversize and malformed bodies are the caller's problem, not a server fault
  const bp = err as { type?: string; status?: number; statusCode?: number };
  if (bp?.type === "entity.too.large") {
    return res.status(413).json({ error: "That is too large to send. Try a smaller file or less data.", code: "PAYLOAD_TOO_LARGE" });
  }
  if (bp?.type === "entity.parse.failed" || (err instanceof SyntaxError && (bp?.status === 400 || bp?.statusCode === 400))) {
    return res.status(400).json({ error: "We couldn't read that request. Refresh the page and try again.", code: "INVALID_JSON" });
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
    return res.status(409).json({ error: "That already exists. Choose a different name or value.", code: "ALREADY_EXISTS" });
  }
  if (prismaErr?.code === "P2025") {
    return res.status(404).json({ error: "We couldn't find that record. It may have been deleted.", code: "NOT_FOUND" });
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
    return res.status(403).json({ error: "This request came from a site we don't recognise. Open Penny Pilot from its own address and try again.", code: "ORIGIN_NOT_ALLOWED" });
  }
  const reference = generateReferenceId();
  console.error(`[${reference}]`, err);
  return res.status(500).json({ error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR", reference });
}
