import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import QRCode from "qrcode";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole, AuthPayload } from "../middleware/auth";
import { getSessionVersion, bumpSessionVersion } from "../lib/sessionVersion";
import { logActivity } from "../lib/activityLog";
import { notifySecurityEvent, notifyAdmins, sendEmail, createNotification } from "../lib/notify";
import { seedDefaultDataForUser } from "../lib/startup";
import {
  WELCOME_EMAIL_HTML, REJECTION_EMAIL_HTML, PASSWORD_RESET_BY_ADMIN_EMAIL_HTML,
  UID_RESET_BY_ADMIN_EMAIL_HTML, ACCOUNT_UPDATED_BY_ADMIN_EMAIL_HTML,
} from "../lib/emailTemplates";
import type { User } from "@prisma/client";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many signup attempts. Please try again later." },
});

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "pfd-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "pfd-refresh-secret";
const IS_PROD = process.env.NODE_ENV === "production";

const ACCESS_TOKEN_TTL = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days
const CHALLENGE_TOKEN_TTL = 5 * 60; // 5 minutes
const PASSWORD_CHANGE_TOKEN_TTL = 30 * 60; // 30 minutes
const RESET_OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_OTP_ATTEMPTS = 5;

function signAccess(user: Pick<User, "id" | "uid" | "role" | "mustSetup2FA">, sv: number) {
  return jwt.sign({ userId: user.id, uid: user.uid, role: user.role, sv, mustSetup2FA: user.mustSetup2FA }, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function signRefresh(user: Pick<User, "id" | "uid" | "role" | "mustSetup2FA">, sv: number) {
  return jwt.sign({ userId: user.id, uid: user.uid, role: user.role, sv, mustSetup2FA: user.mustSetup2FA }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
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

function toUserJson(user: User) {
  return { uid: user.uid, name: user.name, email: user.email, role: user.role, mustSetup2FA: user.mustSetup2FA };
}

function isStrongPassword(pw: string): boolean {
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
  let pw = "";
  for (let i = 0; i < 12; i++) pw += chars[crypto.randomInt(chars.length)];
  return pw;
}

function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString("hex"));
}

interface SecurityState {
  twoFactorEnabled: boolean;
  twoFactorSecret?: string | null;
  twoFactorPendingSecret?: string | null;
  twoFactorBackupCodes: string[];
}

/** Verify a 2FA code against the TOTP secret, falling back to (and consuming) a backup code. */
async function verifyTwoFactorCode(userId: string, security: SecurityState, code: string): Promise<boolean> {
  if (!security.twoFactorSecret) return false;
  if (/^\d{6}$/.test(code)) {
    const { valid } = await verifyTotp({ secret: security.twoFactorSecret, token: code });
    if (valid) return true;
  }
  for (const hashedCode of security.twoFactorBackupCodes) {
    if (await bcrypt.compare(code, hashedCode)) {
      const remaining = security.twoFactorBackupCodes.filter((c) => c !== hashedCode);
      await prisma.user.update({ where: { id: userId }, data: { twoFactorBackupCodes: remaining } });
      return true;
    }
  }
  return false;
}

// ─── POST /api/auth/signup ───────────────────────────────────────────────────
router.post(
  "/signup",
  signupLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, phone } = req.body as { name?: string; email?: string; phone?: string };
    if (!name?.trim() || !email?.trim()) {
      res.status(400).json({ error: "Name and email are required" });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ error: "Please enter a valid email address" });
      return;
    }
    const existing = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    const user = await prisma.user.create({
      data: {
        uid: normalizedEmail,
        email: normalizedEmail,
        name: name.trim(),
        phone: phone?.trim() || null,
        role: "USER",
        status: "PENDING",
      },
    });
    void logActivity(req, "signup_requested", `Registration submitted for ${normalizedEmail}`, user.id);
    void notifyAdmins(
      "user_signup",
      "New user registration",
      `${user.name} (${user.email}${user.phone ? `, ${user.phone}` : ""}) has requested access and is awaiting approval.`
    );
    res.status(201).json({ ok: true, message: "Your registration has been received and is pending administrator approval." });
  })
);

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
    const user = await prisma.user.findUnique({ where: { uid: uid.trim() } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    if (user.status === "PENDING") {
      res.status(403).json({ error: "Your account is awaiting administrator approval." });
      return;
    }
    if (user.status === "REJECTED") {
      res.status(403).json({ error: "Your registration was not approved. Contact support for details." });
      return;
    }
    if (user.status === "SUSPENDED") {
      res.status(403).json({ error: "Your account has been suspended. Contact support." });
      return;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      res.status(423).json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.` });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const locked = attempts >= MAX_LOGIN_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: locked ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        },
      });
      void logActivity(req, "login_failed", locked ? "Wrong password — account locked" : "Wrong password", user.id);
      void createNotification(user.id, "security", locked ? "Account locked" : "Failed login attempt", locked
        ? `Your account was locked for ${LOCKOUT_DURATION_MS / 60000} minutes after ${attempts} failed login attempts.`
        : "A login attempt with an incorrect password was made on your account.");
      res.status(locked ? 423 : 401).json({
        error: locked
          ? `Too many failed attempts. Your account is locked for ${LOCKOUT_DURATION_MS / 60000} minutes.`
          : "Invalid credentials",
      });
      return;
    }
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      void prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    if (user.mustChangePassword) {
      const passwordChangeToken = jwt.sign({ userId: user.id, purpose: "change-password" }, ACCESS_SECRET, { expiresIn: PASSWORD_CHANGE_TOKEN_TTL });
      res.json({ requiresPasswordChange: true, passwordChangeToken });
      return;
    }

    if (user.twoFactorEnabled) {
      const challengeToken = jwt.sign({ userId: user.id, twoFactor: true }, ACCESS_SECRET, { expiresIn: CHALLENGE_TOKEN_TTL });
      res.json({ requires2FA: true, challengeToken });
      return;
    }

    const sv = bumpSessionVersion(user.id);
    setTokenCookies(res, signAccess(user, sv), signRefresh(user, sv));
    void prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    void createNotification(user.id, "security", "New sign-in", "Your account was signed in from a new session.");
    res.json({ user: toUserJson(user) });
  })
);

// ─── POST /api/auth/force-change-password ────────────────────────────────────
// Used for the mandatory first-login password change after a temporary password.
router.post(
  "/force-change-password",
  loginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { passwordChangeToken, newPassword } = req.body as { passwordChangeToken?: string; newPassword?: string };
    if (!passwordChangeToken || !newPassword) {
      res.status(400).json({ error: "Token and new password are required" });
      return;
    }
    if (!isStrongPassword(newPassword)) {
      res.status(400).json({ error: "Password must be at least 8 characters and include a letter and a number" });
      return;
    }
    let payload: { userId: string; purpose?: string };
    try {
      payload = jwt.verify(passwordChangeToken, ACCESS_SECRET) as { userId: string; purpose?: string };
    } catch {
      res.status(401).json({ error: "Invalid or expired session. Please log in again." });
      return;
    }
    if (payload.purpose !== "change-password") {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: "Account not found" });
      return;
    }
    const justOnboarded = !user.onboardedAt;
    const newHash = await bcrypt.hash(newPassword, 12);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        onboardedAt: user.onboardedAt ?? new Date(),
        lastLoginAt: new Date(),
        // New users who don't already have 2FA enabled are required to set it
        // up before reaching the dashboard — enforced server-side in
        // blockIfMustSetup2FA (backend/src/middleware/auth.ts), not just here.
        mustSetup2FA: justOnboarded && !user.twoFactorEnabled ? true : undefined,
      },
    });
    const sv = bumpSessionVersion(updated.id);
    setTokenCookies(res, signAccess(updated, sv), signRefresh(updated, sv));
    void logActivity(req, "password_changed", "Temporary password replaced on first login", user.id);
    void notifySecurityEvent(user.id, "security", "Password changed", "Your temporary password was replaced with a new password.");

    if (justOnboarded) {
      const tips: [string, string][] = [
        ["Dashboard", "See your income, expenses, savings, and net worth at a glance."],
        ["Budget Management", "Set monthly/quarterly/yearly budgets per category and track utilization."],
        ["Expense & Income Tracking", "Log transactions with categories, accounts, payment methods, and tags."],
        ["Analytics", "Build fully customizable charts across any time range and filter combination."],
        ["Reports", "Export monthly summaries, category reports, and budget comparisons."],
        ["Notifications", "Stay on top of budget alerts, bill reminders, and security events."],
        ["Security Settings", "Enable Two-Factor Authentication and review your Activity Log."],
        ["Backup Codes", "Save your 2FA backup codes somewhere safe when you enable 2FA."],
      ];
      await Promise.all(
        tips.map(([title, message]) => createNotification(user.id, "welcome_tour", title, message))
      );
      await createNotification(user.id, "welcome_tour", "Welcome to Penny Pilot", "Your account is ready. Explore the feature tour to get the most out of Penny Pilot.");
    }
    res.json({ user: toUserJson(updated), justOnboarded });
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
    let payload: { userId: string; twoFactor?: boolean };
    try {
      payload = jwt.verify(challengeToken, ACCESS_SECRET) as { userId: string; twoFactor?: boolean };
    } catch {
      res.status(401).json({ error: "Invalid or expired challenge. Please log in again." });
      return;
    }
    if (!payload.twoFactor) {
      res.status(401).json({ error: "Invalid challenge" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: "Account not found" });
      return;
    }
    const valid = await verifyTwoFactorCode(user.id, user, code);
    if (!valid) {
      void logActivity(req, "login_failed", "Invalid 2FA code", user.id);
      res.status(401).json({ error: "Invalid verification code" });
      return;
    }
    const sv = bumpSessionVersion(user.id);
    setTokenCookies(res, signAccess(user, sv), signRefresh(user, sv));
    void prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    void createNotification(user.id, "security", "New sign-in", "Your account was signed in with two-factor authentication.");
    res.json({ user: toUserJson(user) });
  })
);

// ─── GET /api/auth/2fa/status ────────────────────────────────────────────────
router.get(
  "/2fa/status",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    res.json({ enabled: user?.twoFactorEnabled ?? false });
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
    await prisma.user.update({ where: { id: req.auth!.userId }, data: { twoFactorPendingSecret: secret } });
    res.json({ secret, qrCode });
  })
);

// ─── POST /api/auth/2fa/verify ───────────────────────────────────────────────
router.post(
  "/2fa/verify",
  loginLimiter,
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.body as { code?: string };
    if (!code) {
      res.status(400).json({ error: "Code is required" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user?.twoFactorPendingSecret) {
      res.status(400).json({ error: "No pending 2FA setup. Start setup again." });
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      res.status(401).json({ error: "Invalid verification code" });
      return;
    }
    const { valid } = await verifyTotp({ secret: user.twoFactorPendingSecret, token: code });
    if (!valid) {
      res.status(401).json({ error: "Invalid verification code" });
      return;
    }
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: user.twoFactorPendingSecret,
        twoFactorPendingSecret: null,
        twoFactorBackupCodes: hashedBackupCodes,
        mustSetup2FA: false,
      },
    });
    // If this was a mandatory setup (mustSetup2FA was true), the existing
    // session cookies still carry that claim until they naturally expire —
    // re-issue them now so access unblocks immediately instead of waiting.
    if (user.mustSetup2FA) {
      const sv = getSessionVersion(updated.id);
      setTokenCookies(res, signAccess(updated, sv), signRefresh(updated, sv));
    }
    void logActivity(req, "2fa_enabled", "Two-factor authentication enabled", user.id);
    void notifySecurityEvent(user.id, "security", "2FA enabled", "Two-factor authentication was enabled on your account.");
    res.json({ ok: true, backupCodes });
  })
);

// ─── POST /api/auth/2fa/disable ──────────────────────────────────────────────
router.post(
  "/2fa/disable",
  loginLimiter,
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { password, code } = req.body as { password?: string; code?: string };
    if (!password || !code) {
      res.status(400).json({ error: "Password and verification code are required" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user?.passwordHash) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    if (!user.twoFactorEnabled) {
      res.status(400).json({ error: "2FA is not enabled" });
      return;
    }
    const validCode = await verifyTwoFactorCode(user.id, user, code);
    if (!validCode) {
      res.status(401).json({ error: "Invalid verification code" });
      return;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null, twoFactorBackupCodes: [] },
    });
    void logActivity(req, "2fa_disabled", "Two-factor authentication disabled", user.id);
    void notifySecurityEvent(user.id, "security", "2FA disabled", "Two-factor authentication was disabled on your account.");
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
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user?.passwordHash) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      void logActivity(req, "uid_change_failed", "Wrong password", user.id);
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    if (trimmed === user.uid) {
      res.status(400).json({ error: "New UID is the same as the current one" });
      return;
    }
    const conflict = await prisma.user.findUnique({ where: { uid: trimmed } });
    if (conflict) {
      res.status(409).json({ error: "That UID is already taken" });
      return;
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data: { uid: trimmed } });
    const sv = bumpSessionVersion(updated.id);
    setTokenCookies(res, signAccess(updated, sv), signRefresh(updated, sv));
    void logActivity(req, "uid_changed", `UID changed from ${user.uid} to ${trimmed}`, user.id);
    void notifySecurityEvent(user.id, "security", "User ID changed", `Your sign-in User ID was changed to "${trimmed}".`);
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
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    res.json({ ok: true });
  })
);

// ─── POST /api/auth/recovery-options ────────────────────────────────────────
// Returns which recovery methods are available for the given UID. Responds
// identically for unknown UIDs to avoid account enumeration.
router.post(
  "/recovery-options",
  loginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { uid } = req.body as { uid?: string };
    const user = uid ? await prisma.user.findUnique({ where: { uid } }) : null;
    if (!user || user.status !== "ACTIVE") {
      res.json({ email: false, totp: false, backup: false });
      return;
    }
    res.json({
      email: Boolean(process.env.RESEND_API_KEY),
      totp: user.twoFactorEnabled,
      backup: user.twoFactorEnabled && user.twoFactorBackupCodes.length > 0,
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
    const user = await prisma.user.findUnique({ where: { uid } });
    if (user && user.status === "ACTIVE") {
      const otp = generateOtp();
      const hash = await bcrypt.hash(otp, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { resetOtpHash: hash, resetOtpExpiry: new Date(Date.now() + RESET_OTP_TTL_MS), resetOtpAttempts: 0 },
      });
      void sendEmail(
        user.email,
        "Your Penny Pilot password reset code",
        `<p>Your password reset code is:</p><h2 style="letter-spacing:4px">${otp}</h2><p>This code expires in 5 minutes. If you didn't request this, you can ignore this email.</p>`
      );
      void logActivity(req, "password_reset_requested", "Email OTP requested", user.id);
    }
    res.json({ ok: true, message: "If the account exists and has an email on file, a reset code has been sent." });
  })
);

// ─── POST /api/auth/reset-password ──────────────────────────────────────────
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
    if (!isStrongPassword(newPassword)) {
      res.status(400).json({ error: "Password must be at least 8 characters and include a letter and a number" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { uid } });
    if (!user || user.status !== "ACTIVE") {
      res.status(400).json({ error: "Invalid or expired code" });
      return;
    }

    const chosen = method === "totp" || method === "backup" ? method : "email";
    let verified = false;

    if (chosen === "email") {
      if (user.resetOtpHash && user.resetOtpExpiry && Date.now() <= user.resetOtpExpiry.getTime()) {
        if (user.resetOtpAttempts >= MAX_OTP_ATTEMPTS) {
          await prisma.user.update({ where: { id: user.id }, data: { resetOtpHash: null, resetOtpExpiry: null, resetOtpAttempts: 0 } });
          void logActivity(req, "password_reset_failed", "Too many OTP attempts — code invalidated", user.id);
          res.status(400).json({ error: "Too many attempts. Request a new code." });
          return;
        }
        if (await bcrypt.compare(code, user.resetOtpHash)) {
          verified = true;
        } else {
          await prisma.user.update({ where: { id: user.id }, data: { resetOtpAttempts: { increment: 1 } } });
        }
      }
    } else if (user.twoFactorEnabled) {
      verified = await verifyTwoFactorCode(user.id, user, code);
    }

    if (!verified) {
      void logActivity(req, "password_reset_failed", `Failed verification via ${chosen}`, user.id);
      res.status(400).json({ error: "Invalid or expired code" });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, resetOtpHash: null, resetOtpExpiry: null, resetOtpAttempts: 0, mustChangePassword: false },
    });
    bumpSessionVersion(user.id); // sign out any existing sessions after a reset
    void logActivity(req, "password_reset", `Password reset via ${chosen}`, user.id);
    void notifySecurityEvent(user.id, "security", "Password reset", `Your password was reset using ${chosen === "email" ? "an email code" : chosen === "totp" ? "an authenticator code" : "a backup code"}.`);
    res.json({ ok: true, message: "Password reset successfully" });
  })
);

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post("/logout", (req: Request, res: Response) => {
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
      if (payload.sv !== getSessionVersion(payload.userId)) {
        res.clearCookie("access_token", { path: "/" });
        res.clearCookie("refresh_token", { path: "/api/auth" });
        res.status(401).json({ error: "Session ended: you were signed in elsewhere" });
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user || user.status !== "ACTIVE") {
        res.clearCookie("access_token", { path: "/" });
        res.clearCookie("refresh_token", { path: "/api/auth" });
        res.status(401).json({ error: "Account no longer active" });
        return;
      }
      setTokenCookies(res, signAccess(user, payload.sv), signRefresh(user, payload.sv));
      res.json({ user: toUserJson(user) });
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
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) {
      res.status(401).json({ error: "Account not found" });
      return;
    }
    res.json({ user: toUserJson(user) });
  })
);

// ─── PATCH /api/auth/change-password ────────────────────────────────────────
router.patch(
  "/change-password",
  loginLimiter,
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
    if (!isStrongPassword(newPassword)) {
      res.status(400).json({ error: "Password must be at least 8 characters and include a letter and a number" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
    void logActivity(req, "password_changed", "Password changed from settings", user.id);
    void notifySecurityEvent(user.id, "security", "Password changed", "Your account password was changed.");
    res.json({ ok: true, message: "Password changed successfully" });
  })
);

// ══════════════════════════ Admin: user management ═══════════════════════════

// ─── GET /api/auth/users ─────────────────────────────────────────────────────
router.get(
  "/users",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, uid: true, email: true, name: true, phone: true, role: true, status: true,
        createdAt: true, approvedAt: true, rejectedAt: true, rejectionReason: true,
        lastLoginAt: true, twoFactorEnabled: true,
      },
    });
    res.json({ items: users });
  })
);

// ─── GET /api/auth/users/pending ─────────────────────────────────────────────
router.get(
  "/users/pending",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    });
    res.json({ items: users });
  })
);

// ─── GET /api/auth/users/generate-temp-password ──────────────────────────────
// Stateless helper for the admin approval/reset-password forms — generates a
// candidate strong password without writing anything to the database.
router.get(
  "/users/generate-temp-password",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ password: generateTempPassword() });
  })
);

// ─── POST /api/auth/users/:id/approve ────────────────────────────────────────
router.post(
  "/users/:id/approve",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { uid, password, sendEmail: shouldSendEmail } = req.body as { uid?: string; password?: string; sendEmail?: boolean };
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.status !== "PENDING") {
      res.status(400).json({ error: "User not found or not pending approval" });
      return;
    }
    const finalUid = (uid?.trim() || target.email).trim();
    if (!/^[a-zA-Z0-9_.@-]{4,50}$/.test(finalUid)) {
      res.status(400).json({ error: "UID must be 4-50 characters (letters, numbers, _ . @ -)" });
      return;
    }
    const finalPassword = password?.trim() || generateTempPassword();
    if (!isStrongPassword(finalPassword)) {
      res.status(400).json({ error: "Password must be at least 8 characters and include a letter and a number" });
      return;
    }
    if (finalUid !== target.uid) {
      const conflict = await prisma.user.findFirst({ where: { uid: finalUid, id: { not: id } } });
      if (conflict) {
        res.status(409).json({ error: "That UID is already taken" });
        return;
      }
    }
    const hash = await bcrypt.hash(finalPassword, 12);
    const updated = await prisma.user.update({
      where: { id },
      data: {
        uid: finalUid,
        status: "ACTIVE",
        passwordHash: hash,
        mustChangePassword: true,
        approvedAt: new Date(),
        approvedById: req.auth!.userId,
      },
    });
    void seedDefaultDataForUser(updated.id);
    void logActivity(req, "user_approved", `Approved ${updated.email}`, req.auth!.userId);

    let emailSent = false;
    if (shouldSendEmail !== false) {
      emailSent = await sendEmail(updated.email, "Welcome to Penny Pilot — your account is approved", WELCOME_EMAIL_HTML(updated.name, updated.uid, finalPassword));
    }
    res.json({
      ok: true,
      emailSent,
      message: emailSent
        ? `${updated.name} has been approved and notified by email.`
        : `${updated.name} has been approved. Share these credentials with them directly — the email was not sent.`,
      uid: updated.uid,
      password: emailSent ? undefined : finalPassword,
    });
  })
);

// ─── POST /api/auth/users/:id/reject ─────────────────────────────────────────
router.post(
  "/users/:id/reject",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { reason } = req.body as { reason?: string };
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.status !== "PENDING") {
      res.status(400).json({ error: "User not found or not pending approval" });
      return;
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { status: "REJECTED", rejectedAt: new Date(), rejectionReason: reason?.trim() || null },
    });
    void sendEmail(updated.email, "Penny Pilot registration update", REJECTION_EMAIL_HTML(updated.name, updated.rejectionReason ?? undefined));
    void logActivity(req, "user_rejected", `Rejected ${updated.email}${reason ? `: ${reason}` : ""}`, req.auth!.userId);
    res.json({ ok: true, message: `${updated.name}'s registration has been rejected.` });
  })
);

// ─── PATCH /api/auth/users/:id ───────────────────────────────────────────────
router.patch(
  "/users/:id",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { name, email, phone, role, status } = req.body as {
      name?: string; email?: string; phone?: string; role?: string; status?: string;
    };
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const data: Record<string, unknown> = {};
    const changes: string[] = [];

    if (name?.trim() && name.trim() !== target.name) {
      data.name = name.trim();
      changes.push(`Name changed to ${name.trim()}`);
    }
    if (email?.trim()) {
      const normalized = email.trim().toLowerCase();
      if (normalized !== target.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
          res.status(400).json({ error: "Please enter a valid email address" });
          return;
        }
        const conflict = await prisma.user.findFirst({ where: { email: normalized, id: { not: id } } });
        if (conflict) {
          res.status(409).json({ error: "That email is already in use" });
          return;
        }
        data.email = normalized;
        changes.push(`Email changed to ${normalized}`);
      }
    }
    if (phone !== undefined && phone.trim() !== (target.phone ?? "")) {
      data.phone = phone.trim() || null;
      changes.push("Phone number updated");
    }
    if (role && role !== target.role) {
      if (!["SUPER_ADMIN", "ADMIN", "USER"].includes(role)) {
        res.status(400).json({ error: "Invalid role" });
        return;
      }
      if (req.auth!.role !== "SUPER_ADMIN" && (role === "SUPER_ADMIN" || target.role === "SUPER_ADMIN")) {
        res.status(403).json({ error: "Only a Super Admin can grant or modify Super Admin access" });
        return;
      }
      if (target.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
        const otherSuperAdmins = await prisma.user.count({ where: { role: "SUPER_ADMIN", id: { not: id } } });
        if (otherSuperAdmins === 0) {
          res.status(400).json({ error: "Cannot remove the last Super Admin" });
          return;
        }
      }
      data.role = role;
      changes.push(`Role changed to ${role.replace("_", " ")}`);
    }
    if (status && status !== target.status) {
      if (!["ACTIVE", "SUSPENDED", "REJECTED"].includes(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      if (target.status === "SUSPENDED" || target.status === "ACTIVE") {
        data.status = status;
        changes.push(`Status changed to ${status}`);
        if (status !== "ACTIVE") data.sessionVersion = { increment: 1 };
      }
    }

    if (Object.keys(data).length === 0) {
      res.json({ ok: true, message: "No changes to apply." });
      return;
    }

    const updated = await prisma.user.update({ where: { id }, data });
    if (typeof data.sessionVersion === "object") bumpSessionVersion(updated.id);
    void logActivity(req, "user_updated", `${changes.join(", ")} for ${updated.email}`, req.auth!.userId);
    void sendEmail(updated.email, "Your Penny Pilot account was updated", ACCOUNT_UPDATED_BY_ADMIN_EMAIL_HTML(updated.name, changes));
    res.json({ ok: true, message: "User updated successfully." });
  })
);

// ─── POST /api/auth/users/:id/reset-password ─────────────────────────────────
router.post(
  "/users/:id/reset-password",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { password, sendEmail: shouldSendEmail } = req.body as { password?: string; sendEmail?: boolean };
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const finalPassword = password?.trim() || generateTempPassword();
    if (!isStrongPassword(finalPassword)) {
      res.status(400).json({ error: "Password must be at least 8 characters and include a letter and a number" });
      return;
    }
    const hash = await bcrypt.hash(finalPassword, 12);
    const updated = await prisma.user.update({
      where: { id },
      data: { passwordHash: hash, mustChangePassword: true },
    });
    bumpSessionVersion(updated.id);
    void logActivity(req, "password_reset_by_admin", `Password reset for ${updated.email}`, req.auth!.userId);

    let emailSent = false;
    if (shouldSendEmail !== false) {
      emailSent = await sendEmail(updated.email, "Your Penny Pilot password was reset", PASSWORD_RESET_BY_ADMIN_EMAIL_HTML(updated.name, updated.uid, finalPassword));
    }
    res.json({ ok: true, emailSent, password: emailSent ? undefined : finalPassword });
  })
);

// ─── POST /api/auth/users/:id/reset-uid ──────────────────────────────────────
router.post(
  "/users/:id/reset-uid",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { uid, sendEmail: shouldSendEmail } = req.body as { uid?: string; sendEmail?: boolean };
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const trimmed = uid?.trim();
    if (!trimmed || !/^[a-zA-Z0-9_.@-]{4,50}$/.test(trimmed)) {
      res.status(400).json({ error: "UID must be 4-50 characters (letters, numbers, _ . @ -)" });
      return;
    }
    if (trimmed !== target.uid) {
      const conflict = await prisma.user.findUnique({ where: { uid: trimmed } });
      if (conflict) {
        res.status(409).json({ error: "That UID is already taken" });
        return;
      }
    }
    const updated = await prisma.user.update({ where: { id }, data: { uid: trimmed } });
    bumpSessionVersion(updated.id);
    void logActivity(req, "uid_reset_by_admin", `UID reset to ${trimmed} for ${updated.email}`, req.auth!.userId);

    let emailSent = false;
    if (shouldSendEmail !== false) {
      emailSent = await sendEmail(updated.email, "Your Penny Pilot User ID was changed", UID_RESET_BY_ADMIN_EMAIL_HTML(updated.name, trimmed));
    }
    res.json({ ok: true, emailSent, uid: trimmed });
  })
);

// ─── GET /api/auth/users/:id/usage ───────────────────────────────────────────
router.get(
  "/users/:id/usage",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [
      transactions, budgets, investments, bills, goals,
      categories, accounts, paymentMethods, notifications, activityLogs,
    ] = await Promise.all([
      prisma.transaction.count({ where: { userId: id } }),
      prisma.budget.count({ where: { userId: id } }),
      prisma.investment.count({ where: { userId: id } }),
      prisma.bill.count({ where: { userId: id } }),
      prisma.goal.count({ where: { userId: id } }),
      prisma.category.count({ where: { userId: id } }),
      prisma.account.count({ where: { userId: id } }),
      prisma.paymentMethodType.count({ where: { userId: id } }),
      prisma.notification.count({ where: { userId: id } }),
      prisma.activityLog.count({ where: { userId: id } }),
    ]);
    res.json({
      counts: { transactions, budgets, investments, bills, goals, categories, accounts, paymentMethods, notifications, activityLogs },
      createdAt: target.createdAt,
      approvedAt: target.approvedAt,
    });
  })
);

// ─── DELETE /api/auth/users/:id ──────────────────────────────────────────────
router.delete(
  "/users/:id",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (id === req.auth!.userId) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (target.role === "SUPER_ADMIN") {
      const otherSuperAdmins = await prisma.user.count({ where: { role: "SUPER_ADMIN", id: { not: id } } });
      if (otherSuperAdmins === 0) {
        res.status(400).json({ error: "Cannot delete the last Super Admin" });
        return;
      }
    }
    await prisma.user.delete({ where: { id } });
    void logActivity(req, "user_deleted", `Deleted ${target.email}`, req.auth!.userId);
    res.json({ ok: true, message: `${target.name}'s account has been permanently deleted.` });
  })
);

export default router;
