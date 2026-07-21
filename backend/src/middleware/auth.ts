import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getSessionVersion } from "../lib/sessionVersion";

export interface AuthPayload {
  userId: string;
  uid: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  sv: number;
  mustSetup2FA?: boolean;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token =
    (req.signedCookies as Record<string, string | undefined>)["access_token"] ||
    (req.headers["authorization"]?.replace("Bearer ", "") ?? "");

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const secret = process.env.JWT_ACCESS_SECRET ?? "pfd-access-secret";
    const payload = jwt.verify(token, secret) as AuthPayload;
    if (payload.sv !== getSessionVersion(payload.userId)) {
      res.status(401).json({ error: "Session ended: you were signed in elsewhere" });
      return;
    }
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Blocks access to everything except the auth routes themselves (2FA setup/
 * verify, /me, logout — all handled inside auth.routes.ts, which never
 * mounts this middleware) until a user who is required to set up 2FA has
 * actually done so. Applied after `authenticate` on every other route group
 * in app.ts. The flag lives in the JWT claims (refreshed on login/refresh/
 * 2FA-verify) rather than a DB read per request, matching how `role`/`sv`
 * are already handled.
 */
export function blockIfMustSetup2FA(req: Request, res: Response, next: NextFunction): void {
  if (req.auth?.mustSetup2FA) {
    res.status(403).json({ error: "Two-factor authentication setup is required before continuing.", code: "2FA_SETUP_REQUIRED" });
    return;
  }
  next();
}

/** Restrict a route to one or more roles. Must run after `authenticate`. */
export function requireRole(...roles: AuthPayload["role"][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}
