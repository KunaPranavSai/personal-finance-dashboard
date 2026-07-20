import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import QRCode from "qrcode";
import { Resend } from "resend";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { authenticate, AuthPayload } from "../middleware/auth";
import { getAppSettingsData, patchAppSettingsData } from "../lib/appSettings";
import { getSessionVersion, bumpSessionVersion } from "../lib/sessionVersion";
import { logActivity } from "../lib/activityLog";
import { notifySecurityEvent } from "../lib/notify";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "pfd-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "pfd-refresh-secret";
const COOKIE_SECRET = process.env.COOKIE_SECRET ?? "pfd-cookie-secret";
const ADMIN_UID = process.env.ADMIN_UID ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "password";
const IS_PROD = process.env.NODE_ENV === "production";

const ACCESS_TOKEN_TTL = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days

function signAccess(uid: string, sv: number) {
  return jwt.sign({ uid, sv }, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function signRefresh(uid: string, sv: number) {
  return jwt.sign({ uid, sv }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

function setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
  const cookieOptions = {
    httpOnly: true,
    signed: true,
    secure: IS_PROD,
    sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax",
  };
  res.cookie("access_token", accessToken, { ...cookieOptions, maxAge: ACCESS_TOKEN_TTL * 1000, path: "/" });
  res.cookie("refresh_token", refreshToken, { ...cookieOptions, maxAge: REFRESH_TOKEN_TTL * 1000, path: "/api/auth" });
}

/** Resolve the current admin UID: stored override first, env fallback. */
async function getStoredUid(): Promise<string> {
  const data = await getAppSettingsData();
  return typeof data.__adminUid === "string" && data.__adminUid.length > 0 ? data.__adminUid : ADMIN_UID;
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

interface SecurityState {
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorPendingSecret?: string;
  twoFactorBackupCodes: string[];
}

async function getSecurityState(): Promise<SecurityState> {
  const data = await getAppSettingsData();
  return {
    twoFactorEnabled: data.__twoFactorEnabled === true,
    twoFactorSecret: typeof data.__twoFactorSecret === "string" ? data.__twoFactorSecret : undefined,
    twoFactorPendingSecret: typeof data.__twoFactorPendingSecret === "string" ? data.__twoFactorPendingSecret : undefined,
    twoFactorBackupCodes: Array.isArray(data.__twoFactorBackupCodes) ? (data.__twoFactorBackupCodes as string[]) : [],
  };
}

function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString("hex"));
}

/** Verify a 2FA code against the TOTP secret, falling back to (and consuming) a backup code. Returns true if valid. */
async function verifyTwoFactorCode(security: SecurityState, code: string): Promise<boolean> {
  if (!security.twoFactorSecret) return false;
  if (/^\d{6}$/.test(code)) {
    const { valid } = await verifyTotp({ secret: security.twoFactorSecret, token: code });
    if (valid) return true;
  }

  for (const hashedCode of security.twoFactorBackupCodes) {
    if (await bcrypt.compare(code, hashedCode)) {
      const remaining = security.twoFactorBackupCodes.filter((c) => c !== hashedCode);
      await patchAppSettingsData({ __twoFactorBackupCodes: remaining });
      return true;
    }
  }
  return false;
}

const CHALLENGE_TOKEN_TTL = 5 * 60; // 5 minutes

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { uid, password } = req.body as { uid?: string; password?: string };
    if (!uid || !password) {
      res.status(400).json({ error: "UID and password are required" });
      return;
    }
    const currentUid = await getStoredUid();
    if (uid !== currentUid) {
      void logActivity(req, "login_failed", "Unknown UID");
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const hash = await getStoredPasswordHash();
    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      void logActivity(req, "login_failed", "Wrong password");
      void notifySecurityEvent("security", "Failed login attempt", "A login attempt with an incorrect password was made on your account.");
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const security = await getSecurityState();
    if (security.twoFactorEnabled) {
      const challengeToken = jwt.sign({ uid, twoFactor: true }, ACCESS_SECRET, { expiresIn: CHALLENGE_TOKEN_TTL });
      res.json({ requires2FA: true, challengeToken });
      return;
    }

    const sv = bumpSessionVersion();
    const accessToken = signAccess(uid, sv);
    const refreshToken = signRefresh(uid, sv);
    setTokenCookies(res, accessToken, refreshToken);
    void logActivity(req, "login", "Signed in with password");
    void notifySecurityEvent("security", "New sign-in", "Your account was signed in from a new session.");
    res.json({ user: { uid, name: "Admin" } });
  })
);

// ─── POST /api/auth/2fa/login-verify ─────────────────────────────────────────
router.post(
  "/2fa/login-verify",
  loginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { challengeToken, code } = req.body as { challengeToken?: string; code?: string };
    if (!challengeToken || !code) {
      res.status(400).json({ error: "Challenge token and code are required" });
      return;
    }
    let payload: AuthPayload & { twoFactor?: boolean };
    try {
      payload = jwt.verify(challengeToken, ACCESS_SECRET) as AuthPayload & { twoFactor?: boolean };
    } catch {
      res.status(401).json({ error: "Invalid or expired challenge. Please log in again." });
      return;
    }
    if (!payload.twoFactor) {
      res.status(401).json({ error: "Invalid challenge" });
      return;
    }
    const security = await getSecurityState();
    const valid = await verifyTwoFactorCode(security, code);
    if (!valid) {
      void logActivity(req, "login_failed", "Invalid 2FA code");
      res.status(401).json({ error: "Invalid verification code" });
      return;
    }
    const sv = bumpSessionVersion();
    const accessToken = signAccess(payload.uid, sv);
    const refreshToken = signRefresh(payload.uid, sv);
    setTokenCookies(res, accessToken, refreshToken);
    void logActivity(req, "login", "Signed in with 2FA");
    void notifySecurityEvent("security", "New sign-in", "Your account was signed in with two-factor authentication.");
    res.json({ user: { uid: payload.uid, name: "Admin" } });
  })
);

// ─── GET /api/auth/2fa/status ────────────────────────────────────────────────
router.get(
  "/2fa/status",
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const security = await getSecurityState();
    res.json({ enabled: security.twoFactorEnabled });
  })
);

// ─── POST /api/auth/2fa/setup ────────────────────────────────────────────────
router.post(
  "/2fa/setup",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const secret = generateSecret();
    const otpauth = generateURI({ strategy: "totp", issuer: "Penny Pilot", label: req.auth!.uid, secret });
    const qrCode = await QRCode.toDataURL(otpauth);
    await patchAppSettingsData({ __twoFactorPendingSecret: secret });
    res.json({ secret, qrCode });
  })
);

// ─── POST /api/auth/2fa/verify ───────────────────────────────────────────────
router.post(
  "/2fa/verify",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.body as { code?: string };
    if (!code) {
      res.status(400).json({ error: "Code is required" });
      return;
    }
    const security = await getSecurityState();
    if (!security.twoFactorPendingSecret) {
      res.status(400).json({ error: "No pending 2FA setup. Start setup again." });
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      res.status(401).json({ error: "Invalid verification code" });
      return;
    }
    const { valid } = await verifyTotp({ secret: security.twoFactorPendingSecret, token: code });
    if (!valid) {
      res.status(401).json({ error: "Invalid verification code" });
      return;
    }
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));
    await patchAppSettingsData({
      __twoFactorEnabled: true,
      __twoFactorSecret: security.twoFactorPendingSecret,
      __twoFactorPendingSecret: null,
      __twoFactorBackupCodes: hashedBackupCodes,
    });
    void logActivity(req, "2fa_enabled", "Two-factor authentication enabled");
    void notifySecurityEvent("security", "2FA enabled", "Two-factor authentication was enabled on your account.");
    res.json({ ok: true, backupCodes });
  })
);

// ─── POST /api/auth/2fa/disable ──────────────────────────────────────────────
router.post(
  "/2fa/disable",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { password, code } = req.body as { password?: string; code?: string };
    if (!password || !code) {
      res.status(400).json({ error: "Password and verification code are required" });
      return;
    }
    const hash = await getStoredPasswordHash();
    const validPassword = await bcrypt.compare(password, hash);
    if (!validPassword) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    const security = await getSecurityState();
    if (!security.twoFactorEnabled) {
      res.status(400).json({ error: "2FA is not enabled" });
      return;
    }
    const validCode = await verifyTwoFactorCode(security, code);
    if (!validCode) {
      res.status(401).json({ error: "Invalid verification code" });
      return;
    }
    await patchAppSettingsData({
      __twoFactorEnabled: false,
      __twoFactorSecret: null,
      __twoFactorPendingSecret: null,
      __twoFactorBackupCodes: [],
    });
    void logActivity(req, "2fa_disabled", "Two-factor authentication disabled");
    void notifySecurityEvent("security", "2FA disabled", "Two-factor authentication was disabled on your account.");
    res.json({ ok: true });
  })
);

// ─── POST /api/auth/change-uid ──────────────────────────────────────────────
router.post(
  "/change-uid",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { password, newUid } = req.body as { password?: string; newUid?: string };
    if (!password || !newUid) {
      res.status(400).json({ error: "Password and new UID are required" });
      return;
    }
    const trimmed = newUid.trim();
    if (!/^[a-zA-Z0-9_.@-]{4,50}$/.test(trimmed)) {
      res.status(400).json({ error: "UID must be 4-50 characters (letters, numbers, _ . @ -)" });
      return;
    }
    const hash = await getStoredPasswordHash();
    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      void logActivity(req, "uid_change_failed", "Wrong password");
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    const currentUid = await getStoredUid();
    if (trimmed === currentUid) {
      res.status(400).json({ error: "New UID is the same as the current one" });
      return;
    }
    await patchAppSettingsData({ __adminUid: trimmed });
    // Invalidate all existing sessions and issue fresh tokens for this one.
    const sv = bumpSessionVersion();
    const accessToken = signAccess(trimmed, sv);
    const refreshToken = signRefresh(trimmed, sv);
    setTokenCookies(res, accessToken, refreshToken);
    void logActivity(req, "uid_changed", `UID changed from ${currentUid} to ${trimmed}`);
    void notifySecurityEvent("security", "User ID changed", `Your sign-in User ID was changed to "${trimmed}".`);
    res.json({ ok: true, uid: trimmed });
  })
);

// ─── POST /api/auth/verify-password ─────────────────────────────────────────
router.post(
  "/verify-password",
  loginLimiter,
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };
    if (!password) {
      res.status(400).json({ error: "Password is required" });
      return;
    }
    const hash = await getStoredPasswordHash();
    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    res.json({ ok: true });
  })
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESET_OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getProfileEmail(): Promise<string | null> {
  const rec = await prisma.appProfile.findUnique({ where: { id: "singleton" } });
  const data = (rec?.data ?? {}) as Record<string, unknown>;
  const email = typeof data.email === "string" ? data.email : null;
  return email && email !== "user@example.com" ? email : null;
}

function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

// ─── POST /api/auth/recovery-options ────────────────────────────────────────
// Returns which recovery methods are available for the given UID. Responds
// identically (all false) for unknown UIDs to avoid account enumeration.
router.post(
  "/recovery-options",
  loginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { uid } = req.body as { uid?: string };
    const currentUid = await getStoredUid();
    if (!uid || uid !== currentUid) {
      res.json({ email: false, totp: false, backup: false });
      return;
    }
    const [email, security] = await Promise.all([getProfileEmail(), getSecurityState()]);
    res.json({
      email: Boolean(email && resend),
      totp: security.twoFactorEnabled,
      backup: security.twoFactorEnabled && security.twoFactorBackupCodes.length > 0,
    });
  })
);

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
router.post(
  "/forgot-password",
  loginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { uid } = req.body as { uid?: string };
    if (!uid) {
      res.status(400).json({ error: "UID is required" });
      return;
    }
    const currentUid = await getStoredUid();
    if (uid === currentUid) {
      const email = await getProfileEmail();
      if (email && resend) {
        const otp = generateOtp();
        const hash = await bcrypt.hash(otp, 10);
        await patchAppSettingsData({ __resetOtpHash: hash, __resetOtpExpiry: Date.now() + RESET_OTP_TTL_MS });
        try {
          await resend.emails.send({
            from: "Penny Pilot <onboarding@resend.dev>",
            to: email,
            subject: "Your Penny Pilot password reset code",
            html: `<p>Your password reset code is:</p><h2 style="letter-spacing:4px">${otp}</h2><p>This code expires in 5 minutes. If you didn't request this, you can ignore this email.</p>`,
          });
        } catch (err) {
          console.error("Failed to send password reset email:", err);
        }
      }
      void logActivity(req, "password_reset_requested", "Email OTP requested");
    }
    // Always respond identically so we don't leak whether the UID or email exists.
    res.json({ ok: true, message: "If the account exists and has an email on file, a reset code has been sent." });
  })
);

// ─── POST /api/auth/reset-password ──────────────────────────────────────────
// method: "email" (default) verifies the emailed OTP; "totp" verifies an
// authenticator code; "backup" consumes a one-time backup code.
router.post(
  "/reset-password",
  loginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { uid, code, newPassword, method } = req.body as {
      uid?: string; code?: string; newPassword?: string; method?: string;
    };
    if (!uid || !code || !newPassword) {
      res.status(400).json({ error: "UID, code, and new password are required" });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters" });
      return;
    }
    const currentUid = await getStoredUid();
    if (uid !== currentUid) {
      res.status(400).json({ error: "Invalid or expired code" });
      return;
    }

    const chosen = method === "totp" || method === "backup" ? method : "email";
    let verified = false;

    if (chosen === "email") {
      const data = await getAppSettingsData();
      const hash = typeof data.__resetOtpHash === "string" ? data.__resetOtpHash : null;
      const expiry = typeof data.__resetOtpExpiry === "number" ? data.__resetOtpExpiry : 0;
      if (hash && Date.now() <= expiry && (await bcrypt.compare(code, hash))) {
        verified = true;
      }
    } else {
      const security = await getSecurityState();
      if (security.twoFactorEnabled) {
        verified = await verifyTwoFactorCode(security, code);
      }
    }

    if (!verified) {
      void logActivity(req, "password_reset_failed", `Failed verification via ${chosen}`);
      res.status(400).json({ error: "Invalid or expired code" });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await patchAppSettingsData({ __passwordHash: newHash, __resetOtpHash: null, __resetOtpExpiry: null });
    bumpSessionVersion(); // sign out any existing sessions after a reset
    void logActivity(req, "password_reset", `Password reset via ${chosen}`);
    void notifySecurityEvent("security", "Password reset", `Your password was reset using ${chosen === "email" ? "an email code" : chosen === "totp" ? "an authenticator code" : "a backup code"}.`);
    res.json({ ok: true, message: "Password reset successfully" });
  })
);

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/api/auth" });
  void logActivity(req, "logout", "Signed out");
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
      if (payload.sv !== getSessionVersion()) {
        res.clearCookie("access_token", { path: "/" });
        res.clearCookie("refresh_token", { path: "/api/auth" });
        res.status(401).json({ error: "Session ended: you were signed in elsewhere" });
        return;
      }
      const accessToken = signAccess(payload.uid, payload.sv);
      const refreshToken = signRefresh(payload.uid, payload.sv);
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
    void logActivity(req, "password_changed", "Password changed from settings");
    void notifySecurityEvent("security", "Password changed", "Your account password was changed.");
    res.json({ ok: true, message: "Password changed successfully" });
  })
);

export default router;
