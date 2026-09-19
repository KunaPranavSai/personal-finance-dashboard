import { Request, Response } from "express";
import type { User } from "@prisma/client";
import { logActivity } from "./activityLog";

/**
 * Shared portal-separation gate — the single source of truth for "which door did this login
 * attempt come through, and is this account allowed to use it." Used by every login-completing
 * path (password /login, passkey /passkey/login/verify) so there's exactly one implementation to
 * audit, not one per auth method. Must be called after the account is resolved but BEFORE any
 * JWT/session token is issued.
 *
 * `portal === "admin"` is the exact string /admin-login sends; anything else (including
 * undefined, or the explicit "user" /login now sends) is treated as the normal-user portal.
 *
 * Returns true (and has already written the 403 response + logged the rejection) if the request
 * was rejected — callers must `return` immediately when this returns true.
 */
export function enforcePortalOrReject(
  req: Request,
  res: Response,
  user: Pick<User, "id" | "role" | "email">,
  portal: string | undefined
): boolean {
  if (portal === "admin" && user.role === "USER") {
    void logActivity(req, "login_failed", "Rejected: USER account attempted admin-portal sign-in", user.id);
    res.status(403).json({ error: "This sign-in is for Penny Pilot administrators only.", code: "AUTH_FORBIDDEN" });
    return true;
  }
  if (portal !== "admin" && user.role !== "USER") {
    void logActivity(req, "login_failed", "Rejected: administrator account attempted user-portal sign-in", user.id);
    res.status(403).json({ error: "Administrators sign in at the Admin Console.", code: "AUTH_WRONG_PORTAL" });
    return true;
  }
  return false;
}
