import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getSessionVersion } from "../lib/sessionVersion";

export interface AuthPayload {
  userId: string;
  uid: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  sv: number;
  /** Whether 2FA is enabled for this account — drives requireRecent2FA below. */
  tfaEnabled?: boolean;
  /** Epoch ms of the last successful TOTP verification (login or step-up reverify). */
  tfaVerifiedAt?: number;
  iat?: number;
  exp?: number;
}

const TFA_REVERIFY_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

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
 * Guards sensitive actions (export, backup/restore, profile changes, security
 * settings, password/UID changes, disabling 2FA) behind a TOTP re-verification
 * no older than 12 hours. Users who never enabled 2FA are unaffected — this
 * only ever blocks accounts that opted into 2FA in the first place. Must run
 * after `authenticate`.
 */
export function requireRecent2FA(req: Request, res: Response, next: NextFunction): void {
  const auth = req.auth;
  if (!auth?.tfaEnabled) {
    next();
    return;
  }
  const verifiedAt = auth.tfaVerifiedAt ?? 0;
  if (Date.now() - verifiedAt > TFA_REVERIFY_WINDOW_MS) {
    res.status(403).json({
      error: "Please re-verify your two-factor authentication code to continue.",
      code: "2FA_REVERIFICATION_REQUIRED",
    });
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
