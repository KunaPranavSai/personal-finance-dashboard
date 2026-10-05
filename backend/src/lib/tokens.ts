import jwt from "jsonwebtoken";
import type { Response } from "express";
import type { User } from "@prisma/client";

function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — refusing to start with a default JWT secret.`);
  }
  return value;
}

export const ACCESS_SECRET = requireSecret("JWT_ACCESS_SECRET");
export const REFRESH_SECRET = requireSecret("JWT_REFRESH_SECRET");
const IS_PROD = process.env.NODE_ENV === "production";

export const ACCESS_TOKEN_TTL = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days
export const REMEMBER_REFRESH_TOKEN_TTL = 365 * 24 * 60 * 60; // remember-me sessions

export interface TfaClaims {
  tfaEnabled?: boolean;
  tfaVerifiedAt?: number;
  /**
   * Absolute epoch-ms deadline for this session's current inactivity window
   * (see lib/sessionExpiry.ts). Continuously slid forward by authenticated
   * activity (see middleware/auth.ts) — undefined means the account's
   * inactivity timeout is set to "Never".
   */
  sessionExpiresAt?: number;
  /** The Session row (lib/activityLog.ts createSessionRecord) this token belongs to, when one
   * was created at login — lets authenticate() enforce a single revoked device instead of only
   * the whole-account sessionVersion bump. Absent on tokens issued before this existed. */
  sessionId?: string;
  /** "Remember me": no inactivity/daily deadline; refresh cookie lasts a year and rolls on every refresh. Ends on explicit logout, revoke, or sign-in elsewhere. */
  remember?: boolean;
}

export function signAccess(user: Pick<User, "id" | "uid" | "role">, sv: number, tfa?: TfaClaims) {
  return jwt.sign({ userId: user.id, uid: user.uid, role: user.role, sv, ...tfa }, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefresh(user: Pick<User, "id" | "uid" | "role">, sv: number, tfa?: TfaClaims) {
  return jwt.sign({ userId: user.id, uid: user.uid, role: user.role, sv, ...tfa }, REFRESH_SECRET, { expiresIn: tfa?.remember ? REMEMBER_REFRESH_TOKEN_TTL : REFRESH_TOKEN_TTL });
}

export function setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
  const cookieOptions = {
    httpOnly: true,
    signed: true,
    secure: IS_PROD,
    sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax",
  };
  res.cookie("access_token", accessToken, { ...cookieOptions, maxAge: ACCESS_TOKEN_TTL * 1000, path: "/" });
  const remember = (jwt.decode(refreshToken) as { remember?: boolean } | null)?.remember === true;
  res.cookie("refresh_token", refreshToken, { ...cookieOptions, maxAge: (remember ? REMEMBER_REFRESH_TOKEN_TTL : REFRESH_TOKEN_TTL) * 1000, path: "/api/auth" });
}

// "Access as User" — separate, short-lived, never overwrites access_token/refresh_token.
export const IMPERSONATION_TTL = 20 * 60; // 20 minutes

export function signImpersonation(adminId: string, targetUserId: string, requestId: string) {
  return jwt.sign({ imp: true, adminId, targetUserId, requestId }, ACCESS_SECRET, { expiresIn: IMPERSONATION_TTL });
}

export function setImpersonationCookie(res: Response, token: string) {
  res.cookie("impersonation_token", token, {
    httpOnly: true, signed: true, secure: IS_PROD,
    sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax",
    maxAge: IMPERSONATION_TTL * 1000, path: "/",
  });
}

export function clearImpersonationCookie(res: Response) {
  res.clearCookie("impersonation_token", { path: "/" });
}

// Remembers which account PIN sign-in is offered for on this device. Not a credential by itself:
// the PIN is still required, and it is only issued after a password login or PIN setup.
const PIN_DEVICE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const pinDeviceOptions = { httpOnly: true, signed: true, secure: IS_PROD, sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax", path: "/api/auth" };

// Two cookies so the user sign-in and the admin sign-in each remember their own last account.
export const deviceCookieName = (admin: boolean) => (admin ? "pin_device_admin" : "pin_device");

export function setPinDeviceCookie(res: Response, userId: string, admin = false) {
  res.cookie(deviceCookieName(admin), userId, { ...pinDeviceOptions, maxAge: PIN_DEVICE_TTL_MS });
}

export function clearPinDeviceCookie(res: Response, admin = false) {
  res.clearCookie(deviceCookieName(admin), pinDeviceOptions);
}
