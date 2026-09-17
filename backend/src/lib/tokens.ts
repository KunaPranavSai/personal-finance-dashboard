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
}

export function signAccess(user: Pick<User, "id" | "uid" | "role">, sv: number, tfa?: TfaClaims) {
  return jwt.sign({ userId: user.id, uid: user.uid, role: user.role, sv, ...tfa }, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefresh(user: Pick<User, "id" | "uid" | "role">, sv: number, tfa?: TfaClaims) {
  return jwt.sign({ userId: user.id, uid: user.uid, role: user.role, sv, ...tfa }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

export function setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
  const cookieOptions = {
    httpOnly: true,
    signed: true,
    secure: IS_PROD,
    sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax",
  };
  res.cookie("access_token", accessToken, { ...cookieOptions, maxAge: ACCESS_TOKEN_TTL * 1000, path: "/" });
  res.cookie("refresh_token", refreshToken, { ...cookieOptions, maxAge: REFRESH_TOKEN_TTL * 1000, path: "/api/auth" });
}
