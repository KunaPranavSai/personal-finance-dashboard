import type { Request, Response } from "express";

// The recovery credential lives ONLY in this cookie — never in a JSON
// response body, localStorage, sessionStorage, or a URL. It is HttpOnly (no
// JavaScript can read it, on either origin) and signed (tamper-evident via
// cookie-parser's HMAC, same mechanism already used for access_token /
// refresh_token). Same-origin/cross-origin cookie attributes deliberately
// mirror setTokenCookies in lib/tokens.ts: this deployment's frontend and
// backend are different origins (Vercel/Render), so SameSite=Strict (or even
// Lax) would simply never be attached to the frontend's fetch requests and
// the whole recovery flow would break in production. CSRF exposure from the
// resulting SameSite=None is covered by the same origin-allowlist check
// app.ts already applies to every state-changing request (see the comment
// there) — that check runs before this cookie is ever read.
const RECOVERY_COOKIE_NAME = "recovery_token";
const IS_PROD = process.env.NODE_ENV === "production";
export const RECOVERY_COOKIE_MAX_AGE_MS = 15 * 60 * 1000; // must match RECOVERY_SESSION_TTL_MS

function cookieOptions() {
  return {
    httpOnly: true,
    signed: true,
    secure: IS_PROD,
    sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax",
    path: "/api/auth",
  };
}

export function setRecoveryCookie(res: Response, token: string): void {
  res.cookie(RECOVERY_COOKIE_NAME, token, { ...cookieOptions(), maxAge: RECOVERY_COOKIE_MAX_AGE_MS });
}

export function clearRecoveryCookie(res: Response): void {
  res.clearCookie(RECOVERY_COOKIE_NAME, { path: "/api/auth" });
}

export function readRecoveryToken(req: Request): string | undefined {
  const signed = req.signedCookies as Record<string, string | undefined>;
  return signed[RECOVERY_COOKIE_NAME];
}
