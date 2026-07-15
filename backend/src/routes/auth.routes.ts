import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { authenticate, AuthPayload } from "../middleware/auth";

const router = Router();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "pfd-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "pfd-refresh-secret";
const COOKIE_SECRET = process.env.COOKIE_SECRET ?? "pfd-cookie-secret";
const ADMIN_UID = process.env.ADMIN_UID ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "password";
const IS_PROD = process.env.NODE_ENV === "production";

const ACCESS_TOKEN_TTL = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days

function signAccess(uid: string) {
  return jwt.sign({ uid }, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function signRefresh(uid: string) {
  return jwt.sign({ uid }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

function setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
  const cookieOptions = {
    httpOnly: true,
    signed: true,
    secure: IS_PROD,
    sameSite: "lax" as const,
  };
  res.cookie("access_token", accessToken, { ...cookieOptions, maxAge: ACCESS_TOKEN_TTL * 1000, path: "/" });
  res.cookie("refresh_token", refreshToken, { ...cookieOptions, maxAge: REFRESH_TOKEN_TTL * 1000, path: "/api/auth" });
}

/** GET the stored password hash (or fallback to env ADMIN_PASSWORD as plain-text on first run) */
async function getStoredPasswordHash(): Promise<string> {
  const rec = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  const data = (rec?.data ?? {}) as Record<string, unknown>;
  if (typeof data.__passwordHash === "string") return data.__passwordHash;
  // First run: hash the env password and store it
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", data: { ...data, __passwordHash: hash } },
    update: { data: { ...data, __passwordHash: hash } },
  });
  return hash;
}

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    const { uid, password } = req.body as { uid?: string; password?: string };
    if (!uid || !password) {
      res.status(400).json({ error: "UID and password are required" });
      return;
    }
    if (uid !== ADMIN_UID) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const hash = await getStoredPasswordHash();
    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const accessToken = signAccess(uid);
    const refreshToken = signRefresh(uid);
    setTokenCookies(res, accessToken, refreshToken);
    res.json({ user: { uid, name: "Admin" } });
  })
);

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/api/auth" });
  res.json({ ok: true });
});

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
router.post(
  "/refresh",
  asyncHandler(async (req: Request, res: Response) => {
    const token = (req.signedCookies as Record<string, string | undefined>)["refresh_token"];
    if (!token) {
      res.status(401).json({ error: "No refresh token" });
      return;
    }
    try {
      const payload = jwt.verify(token, REFRESH_SECRET) as AuthPayload;
      const accessToken = signAccess(payload.uid);
      const refreshToken = signRefresh(payload.uid);
      setTokenCookies(res, accessToken, refreshToken);
      res.json({ user: { uid: payload.uid, name: "Admin" } });
    } catch {
      res.clearCookie("access_token", { path: "/" });
      res.clearCookie("refresh_token", { path: "/api/auth" });
      res.status(401).json({ error: "Invalid or expired refresh token" });
    }
  })
);

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get(
  "/me",
  authenticate,
  (req: Request, res: Response) => {
    res.json({ user: { uid: req.auth!.uid, name: "Admin" } });
  }
);

// ─── PATCH /api/auth/change-password ────────────────────────────────────────
router.patch(
  "/change-password",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current and new password are required" });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters" });
      return;
    }
    const hash = await getStoredPasswordHash();
    const valid = await bcrypt.compare(currentPassword, hash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 12);
    const rec = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    const data = (rec?.data ?? {}) as Record<string, unknown>;
    await prisma.appSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", data: { ...data, __passwordHash: newHash } },
      update: { data: { ...data, __passwordHash: newHash } },
    });
    res.json({ ok: true, message: "Password changed successfully" });
  })
);

export default router;
