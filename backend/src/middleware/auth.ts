import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getSessionVersion } from "../lib/sessionVersion";
import { ACCESS_SECRET, signAccess, signRefresh, setTokenCookies } from "../lib/tokens";
import { computeSessionExpiryForUser } from "../lib/sessionExpiry";

export interface AuthPayload {
  userId: string;
  uid: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  sv: number;
  /** Whether 2FA is enabled for this account — drives requireRecent2FA below. */
  tfaEnabled?: boolean;
  /** Epoch ms of the last successful TOTP verification (login or step-up reverify). */
  tfaVerifiedAt?: number;
  /**
   * Absolute epoch-ms deadline for this session (per-session timeout, clamped to the
   * next daily IST midnight — see lib/sessionExpiry.ts). Set once at login/step-up
   * re-auth and carried forward unchanged by ordinary /api/auth/refresh calls, so a
   * page reload or PWA relaunch can never silently mint a fresh session window.
   */
  sessionExpiresAt?: number;
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

// How often (at most) a valid request re-signs and re-sets the session
// cookies to slide the inactivity deadline forward. Sliding on literally
// every request would mean an extra settings lookup + JWT sign per call;
// throttling to once a minute per session is enough to make the deadline
// track activity closely while keeping the steady-state cost negligible.
const SLIDE_THROTTLE_MS = 60 * 1000;

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token =
    (req.signedCookies as Record<string, string | undefined>)["access_token"] ||
    (req.headers["authorization"]?.replace("Bearer ", "") ?? "");

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, ACCESS_SECRET) as AuthPayload;
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  if (payload.sv !== getSessionVersion(payload.userId)) {
    res.status(401).json({ error: "Session ended: you were signed in elsewhere" });
    return;
  }
  // undefined sessionExpiresAt means the account's inactivity timeout is "Never".
  if (payload.sessionExpiresAt !== undefined && Date.now() > payload.sessionExpiresAt) {
    res.status(401).json({ error: "Session expired due to inactivity", code: "SESSION_EXPIRED" });
    return;
  }
  req.auth = payload;

  // This is the core of the inactivity-based session: every authenticated
  // request is user activity, so (throttled) it slides the deadline forward
  // by re-signing fresh cookies before the response is sent. A session that
  // stops receiving requests — no mouse/keyboard/API activity — simply stops
  // getting its deadline pushed out and lapses on its own.
  const tokenAgeMs = Date.now() - (payload.iat ?? 0) * 1000;
  if (payload.sessionExpiresAt !== undefined && tokenAgeMs > SLIDE_THROTTLE_MS) {
    try {
      const sessionExpiresAt = await computeSessionExpiryForUser(payload.userId);
      if (sessionExpiresAt !== undefined) {
        const tfa = { tfaEnabled: payload.tfaEnabled, tfaVerifiedAt: payload.tfaVerifiedAt, sessionExpiresAt };
        const user = { id: payload.userId, uid: payload.uid, role: payload.role };
        setTokenCookies(res, signAccess(user, payload.sv, tfa), signRefresh(user, payload.sv, tfa));
        req.auth = { ...payload, sessionExpiresAt };
      }
    } catch {
      // Non-fatal: the request proceeds on its already-validated token; the
      // deadline simply won't have slid forward this time.
    }
  }

  next();
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
