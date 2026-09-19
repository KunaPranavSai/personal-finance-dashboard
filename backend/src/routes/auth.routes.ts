import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import QRCode from "qrcode";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole, requireRecent2FA, AuthPayload } from "../middleware/auth";
import { getSessionVersion, bumpSessionVersion } from "../lib/sessionVersion";
import { logActivity, createSessionRecord } from "../lib/activityLog";
import { isSessionRevoked } from "../lib/sessionRevocation";
import { enforcePortalOrReject } from "../lib/portal";
import { isRestricted } from "../services/entitlements";
import { sendAutomatedEmail } from "../services/email/automation";
import { notifySecurityEvent, sendEmail, createNotification } from "../lib/notify";
import { RP_ID, RP_NAME, RP_ORIGINS } from "../lib/webauthn";
import { computeSessionExpiryForUser } from "../lib/sessionExpiry";
import { ACCESS_SECRET, REFRESH_SECRET, signAccess, signRefresh, setTokenCookies, TfaClaims } from "../lib/tokens";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import {
  PASSWORD_RESET_BY_ADMIN_EMAIL_HTML,
  UID_RESET_BY_ADMIN_EMAIL_HTML, ACCOUNT_UPDATED_BY_ADMIN_EMAIL_HTML,
} from "../lib/emailTemplates";
import type { User } from "@prisma/client";
import { TERMS_VERSION, PRIVACY_VERSION } from "../lib/legalVersions";
import { generateConsentPdf } from "../services/consent/consentPdf";
import { generateRecoveryToken, hashRecoveryToken } from "../lib/recoveryToken";
import { setRecoveryCookie, clearRecoveryCookie, readRecoveryToken } from "../lib/recoveryCookie";
import { SECURITY_QUESTIONS, SECURITY_QUESTION_KEYS, securityQuestionText, normalizeSecurityAnswer } from "../lib/securityQuestions";
import { RECOVERY_OTP_EMAIL_HTML, PASSWORD_CHANGED_NOTIFICATION_EMAIL_HTML } from "../lib/emailTemplates";
import type { RecoverySession } from "@prisma/client";

const router = Router();

const SIGNATURE_NAME_MAX = 150;
// Letters (incl. accented/Unicode), marks, spaces, hyphens, apostrophes, periods —
// deliberately permissive so legitimate names in any script are accepted.
const SIGNATURE_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u;

function isValidSignatureName(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= SIGNATURE_NAME_MAX && SIGNATURE_NAME_PATTERN.test(trimmed);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later.", code: "AUTH_RATE_LIMITED" },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many signup attempts. Please try again later." },
});

// Account-recovery v2 limiters — deliberately stricter/hourly, independent
// of loginLimiter, since these guard the entire recovery surface.
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
const resendOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
const recoveryVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

const CHALLENGE_TOKEN_TTL = 5 * 60; // 5 minutes
const PASSWORD_CHANGE_TOKEN_TTL = 30 * 60; // 30 minutes
const RESET_OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_OTP_ATTEMPTS = 5;
const RECOVERY_SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes — overall ceiling for the whole recovery flow
const MAX_SECURITY_ANSWER_ATTEMPTS = 5;
const MAX_OTP_RESENDS = 3;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const RECOVERY_GENERIC_ERROR = "This recovery session is invalid or has expired. Please start over.";

function toUserJson(user: User) {
  return { uid: user.uid, name: user.name, email: user.email, role: user.role };
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

/** Resolves a client-supplied recoveryToken to its RecoverySession, or null
 * if it doesn't exist, is consumed, is locked, or its overall TTL has
 * elapsed — every case collapses to the same generic response at the call
 * site, so a guessed/expired/consumed/locked token is indistinguishable. */
async function loadActiveRecoverySession(recoveryToken: unknown): Promise<RecoverySession | null> {
  if (typeof recoveryToken !== "string" || !recoveryToken) return null;
  const tokenHash = hashRecoveryToken(recoveryToken);
  const session = await prisma.recoverySession.findUnique({ where: { tokenHash } });
  if (!session) return null;
  if (session.consumedAt) return null;
  if (session.state === "LOCKED" || session.state === "EXPIRED") return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.recoverySession.update({ where: { id: session.id }, data: { state: "EXPIRED" } }).catch(() => {});
    return null;
  }
  return session;
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
// Accounts are activated immediately on signup — there is no admin approval
// step. The user sets their own password here (instead of an admin issuing a
// temporary one), so the account is usable right away.
router.post(
  "/signup",
  signupLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, phone, password, termsAccepted, privacyAccepted, signedName } = req.body as {
      name?: string; email?: string; phone?: string; password?: string;
      termsAccepted?: boolean; privacyAccepted?: boolean; signedName?: string;
    };
    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ error: "Please enter a valid email address" });
      return;
    }
    if (!isStrongPassword(password)) {
      res.status(400).json({ error: "Password must be at least 8 characters and include a letter and a number" });
      return;
    }
    // Consent is enforced server-side — never trust the frontend's disabled-button state alone.
    if (termsAccepted !== true) {
      res.status(400).json({ error: "You must accept the Terms of Service to create an account" });
      return;
    }
    if (privacyAccepted !== true) {
      res.status(400).json({ error: "You must acknowledge the Privacy Policy to create an account" });
      return;
    }
    if (!isValidSignatureName(signedName)) {
      res.status(400).json({ error: "Please type your full name as your electronic signature" });
      return;
    }
    const trimmedSignature = (signedName as string).trim();

    const existing = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);

    // User + consent record are created together so an account can never exist
    // without a corresponding consent record, and vice versa.
    const { user, consent } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          uid: normalizedEmail,
          email: normalizedEmail,
          name: name.trim(),
          phone: phone?.trim() || null,
          role: "USER",
          status: "ACTIVE",
          passwordHash,
          mustChangePassword: false,
        },
      });
      const createdConsent = await tx.consentRecord.create({
        data: {
          userId: createdUser.id,
          signedName: trimmedSignature,
          termsAccepted: true,
          privacyAccepted: true,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
        },
      });
      return { user: createdUser, consent: createdConsent };
    });
    // No default categories/accounts are seeded here — that now happens once the user
    // connects Google Drive (see services/drive/init.ts), since that data belongs in their
    // Drive, not Postgres.
    void logActivity(req, "signup_requested", `Account created for ${normalizedEmail}`, user.id);
    void logActivity(req, "consent_recorded", `Terms v${TERMS_VERSION} and Privacy Policy v${PRIVACY_VERSION} accepted`, user.id);

    // Best-effort: generate the signed consent PDF now so the frontend can trigger an
    // immediate download right after signup, before the user has an authenticated session
    // (signup does not auto-login). If PDF generation fails for any reason, account
    // creation still succeeds — the user can always re-download after logging in via
    // GET /api/auth/consent/download.
    let consentPdfBase64: string | null = null;
    try {
      const pdfBuffer = await generateConsentPdf({
        name: user.name,
        email: user.email,
        signedName: consent.signedName,
        termsVersion: consent.termsVersion,
        privacyVersion: consent.privacyVersion,
        acceptedAt: consent.acceptedAt,
      });
      consentPdfBase64 = pdfBuffer.toString("base64");
    } catch (err) {
      console.error("Consent PDF generation failed during signup:", err);
    }

    res.status(201).json({
      ok: true,
      message: "Your account has been created. You can sign in now.",
      consent: {
        signedName: consent.signedName,
        termsVersion: consent.termsVersion,
        privacyVersion: consent.privacyVersion,
        acceptedAt: consent.acceptedAt,
      },
      consentPdfBase64,
    });
  })
);

// ─── GET /api/auth/consent ────────────────────────────────────────────────────
// Consent metadata for the signed-in user — legal/account metadata, so this
// lives under /api/auth (Postgres-backed) rather than the Drive-gated routes.
router.get(
  "/consent",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const consent = await prisma.consentRecord.findUnique({ where: { userId: req.auth!.userId } });
    if (!consent) {
      res.status(404).json({ error: "No consent record found for this account" });
      return;
    }
    res.json({
      signedName: consent.signedName,
      termsAccepted: consent.termsAccepted,
      privacyAccepted: consent.privacyAccepted,
      termsVersion: consent.termsVersion,
      privacyVersion: consent.privacyVersion,
      acceptedAt: consent.acceptedAt,
    });
  })
);

// ─── GET /api/auth/consent/download ───────────────────────────────────────────
// Re-generates the signed consent PDF for the signed-in user — used for the
// "Download Signed Consent" action on the signup confirmation screen (as a
// fallback if the automatic download was blocked) and from Profile/Settings.
// Requires authentication; a user can only ever download their own record.
router.get(
  "/consent/download",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const [user, consent] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.auth!.userId } }),
      prisma.consentRecord.findUnique({ where: { userId: req.auth!.userId } }),
    ]);
    if (!user || !consent) {
      res.status(404).json({ error: "No consent record found for this account" });
      return;
    }
    try {
      const pdfBuffer = await generateConsentPdf({
        name: user.name,
        email: user.email,
        signedName: consent.signedName,
        termsVersion: consent.termsVersion,
        privacyVersion: consent.privacyVersion,
        acceptedAt: consent.acceptedAt,
      });
      const dateStr = consent.acceptedAt.toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Penny-Pilot-Signed-Consent-${dateStr}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      console.error("Consent PDF generation failed:", err);
      res.status(500).json({ error: "Failed to generate your signed consent document. Please try again." });
    }
  })
);

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, portal } = req.body as { email?: string; password?: string; portal?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid credentials", code: "AUTH_INVALID" });
      return;
    }
    if (user.status === "SUSPENDED") {
      res.status(403).json({ error: "Your account has been suspended. Contact support.", code: "AUTH_FORBIDDEN" });
      return;
    }
    // Portal separation (backend-enforced, not just hidden nav) — shared with passkey login,
    // see lib/portal.ts.
    if (enforcePortalOrReject(req, res, user, portal)) return;
    // Entitlement-level restriction (Access & Entitlements) — a real backend gate, separate
    // from account status. See services/entitlements.
    if (await isRestricted(user.id)) {
      res.status(403).json({ error: "Your account access has been restricted. Contact support.", code: "AUTH_FORBIDDEN" });
      return;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      res.status(423).json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`, code: "AUTH_RATE_LIMITED" });
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
        code: locked ? "AUTH_RATE_LIMITED" : "AUTH_INVALID",
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
    const sessionExpiresAt = await computeSessionExpiryForUser(user.id);
    const sessionId = (await createSessionRecord(req, user.id)) ?? undefined;
    setTokenCookies(res, signAccess(user, sv, { sessionExpiresAt, sessionId }), signRefresh(user, sv, { sessionExpiresAt, sessionId }));
    // Captured before the update fires, so this reflects the account's real
    // login history — a null value here means this is genuinely the first
    // successful login ever (no existing field/flag was added for this; it
    // reuses the User model's existing lastLoginAt).
    const isFirstLogin = user.lastLoginAt === null;
    void prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    void createNotification(user.id, "security", "New sign-in", "Your account was signed in from a new session.");
    res.json({ user: toUserJson(user), sessionExpiresAt, isFirstLogin });
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
      res.status(401).json({ error: "Invalid or expired session. Please log in again.", code: "AUTH_EXPIRED" });
      return;
    }
    if (payload.purpose !== "change-password") {
      res.status(401).json({ error: "Invalid token", code: "AUTH_INVALID" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: "Account not found", code: "AUTH_EXPIRED" });
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
      },
    });
    const sv = bumpSessionVersion(updated.id);
    const sessionExpiresAt = await computeSessionExpiryForUser(updated.id);
    setTokenCookies(res, signAccess(updated, sv, { sessionExpiresAt }), signRefresh(updated, sv, { sessionExpiresAt }));
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
    // This flow's own existing "first login" signal (mandatory temp-password
    // change) — reused as-is rather than adding a second one.
    res.json({ user: toUserJson(updated), justOnboarded, sessionExpiresAt, isFirstLogin: justOnboarded });
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
      res.status(401).json({ error: "Invalid or expired challenge. Please log in again.", code: "AUTH_EXPIRED" });
      return;
    }
    if (!payload.twoFactor) {
      res.status(401).json({ error: "Invalid challenge", code: "AUTH_INVALID" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: "Account not found", code: "AUTH_EXPIRED" });
      return;
    }
    const valid = await verifyTwoFactorCode(user.id, user, code);
    if (!valid) {
      void logActivity(req, "login_failed", "Invalid 2FA code", user.id);
      res.status(401).json({ error: "Invalid verification code", code: "AUTH_INVALID" });
      return;
    }
    const sv = bumpSessionVersion(user.id);
    const sessionExpiresAt = await computeSessionExpiryForUser(user.id);
    const sessionId = (await createSessionRecord(req, user.id)) ?? undefined;
    const tfa = { tfaEnabled: true, tfaVerifiedAt: Date.now(), sessionExpiresAt, sessionId };
    const isFirstLogin = user.lastLoginAt === null;
    setTokenCookies(res, signAccess(user, sv, tfa), signRefresh(user, sv, tfa));
    void prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    void createNotification(user.id, "security", "New sign-in", "Your account was signed in with two-factor authentication.");
    res.json({ user: toUserJson(user), sessionExpiresAt, isFirstLogin });
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
      res.status(401).json({ error: "Invalid verification code", code: "AUTH_INVALID" });
      return;
    }
    const { valid } = await verifyTotp({ secret: user.twoFactorPendingSecret, token: code });
    if (!valid) {
      res.status(401).json({ error: "Invalid verification code", code: "AUTH_INVALID" });
      return;
    }
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: user.twoFactorPendingSecret,
        twoFactorPendingSecret: null,
        twoFactorBackupCodes: hashedBackupCodes,
      },
    });
    // Reissue tokens immediately with tfaEnabled/tfaVerifiedAt set — otherwise the
    // stale claim in their current token would say tfaEnabled:false until it next
    // refreshes, and requireRecent2FA wouldn't know to start the 12h window yet.
    const sv = getSessionVersion(user.id);
    const tfa = { tfaEnabled: true, tfaVerifiedAt: Date.now(), sessionExpiresAt: req.auth!.sessionExpiresAt };
    setTokenCookies(res, signAccess(user, sv, tfa), signRefresh(user, sv, tfa));
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
  requireRecent2FA,
  asyncHandler(async (req: Request, res: Response) => {
    const { password, code } = req.body as { password?: string; code?: string };
    if (!password || !code) {
      res.status(400).json({ error: "Password and verification code are required" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user?.passwordHash) {
      res.status(401).json({ error: "Incorrect password", code: "AUTH_INVALID" });
      return;
    }
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: "Incorrect password", code: "AUTH_INVALID" });
      return;
    }
    if (!user.twoFactorEnabled) {
      res.status(400).json({ error: "2FA is not enabled" });
      return;
    }
    const validCode = await verifyTwoFactorCode(user.id, user, code);
    if (!validCode) {
      res.status(401).json({ error: "Invalid verification code", code: "AUTH_INVALID" });
      return;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null, twoFactorBackupCodes: [] },
    });
    const sv = getSessionVersion(user.id);
    const tfa = { tfaEnabled: false, sessionExpiresAt: req.auth!.sessionExpiresAt };
    setTokenCookies(res, signAccess(user, sv, tfa), signRefresh(user, sv, tfa));
    void logActivity(req, "2fa_disabled", "Two-factor authentication disabled", user.id);
    void notifySecurityEvent(user.id, "security", "2FA disabled", "Two-factor authentication was disabled on your account.");
    res.json({ ok: true });
  })
);

// ─── POST /api/auth/2fa/reverify ─────────────────────────────────────────────
// Step-up re-authentication: proves the user still has their authenticator
// without asking for their password again. Used by requireRecent2FA's 12h
// window on sensitive routes (export, backup/restore, profile, security,
// password/UID changes). No-op for accounts without 2FA enabled.
router.post(
  "/2fa/reverify",
  loginLimiter,
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.body as { code?: string };
    if (!code) {
      res.status(400).json({ error: "Verification code is required" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user?.twoFactorEnabled) {
      res.status(400).json({ error: "Two-factor authentication is not enabled on this account" });
      return;
    }
    const valid = await verifyTwoFactorCode(user.id, user, code);
    if (!valid) {
      void logActivity(req, "login_failed", "Invalid 2FA re-verification code", user.id);
      res.status(401).json({ error: "Invalid verification code", code: "AUTH_INVALID" });
      return;
    }
    const sv = getSessionVersion(user.id);
    const tfa = { tfaEnabled: true, tfaVerifiedAt: Date.now(), sessionExpiresAt: req.auth!.sessionExpiresAt };
    setTokenCookies(res, signAccess(user, sv, tfa), signRefresh(user, sv, tfa));
    res.json({ ok: true });
  })
);

// ─── POST /api/auth/change-uid ──────────────────────────────────────────────
router.post(
  "/change-uid",
  authenticate,
  requireRecent2FA,
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
      res.status(401).json({ error: "Incorrect password", code: "AUTH_INVALID" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      void logActivity(req, "uid_change_failed", "Wrong password", user.id);
      res.status(401).json({ error: "Incorrect password", code: "AUTH_INVALID" });
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
    const tfa: TfaClaims = { tfaEnabled: req.auth!.tfaEnabled, tfaVerifiedAt: req.auth!.tfaVerifiedAt, sessionExpiresAt: req.auth!.sessionExpiresAt };
    setTokenCookies(res, signAccess(updated, sv, tfa), signRefresh(updated, sv, tfa));
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
      res.status(401).json({ error: "Incorrect password", code: "AUTH_INVALID" });
      return;
    }
    res.json({ ok: true });
  })
);

// ═══ Account recovery v3 — choice-based, cookie-bound ════════════════════════
// The recovery credential (an opaque, high-entropy token) never appears in a
// JSON response, localStorage, sessionStorage, or a URL — it lives only in a
// Secure(prod)+HttpOnly+signed `recovery_token` cookie (see
// lib/recoveryCookie.ts), so no frontend JavaScript can read or exfiltrate
// it. Every recovery endpoint below re-derives the session, its state, and
// its chosen method purely from that cookie via loadActiveRecoverySession —
// never from anything the client sends in the request body. The user picks
// exactly ONE recovery method up front; only that method's verify endpoint
// can ever advance the session to AUTHORIZED (no sequential chaining through
// multiple factors).

const RECOVERY_METHODS = ["email_otp", "totp", "security_questions"] as const;
type RecoveryMethod = (typeof RECOVERY_METHODS)[number];
const METHOD_TO_STATE_FIELD: Record<RecoveryMethod, string> = {
  email_otp: "EMAIL_OTP",
  totp: "TOTP",
  security_questions: "SECURITY_QUESTIONS",
};
const MAX_TOTP_ATTEMPTS = 5;

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
// Starts a recovery session for the given email. Always enumeration-safe:
// the JSON response is identical whether or not the account exists, no
// method availability is revealed, and the SAME cookie shape is set either
// way (for a nonexistent/inactive account no RecoverySession row backs it,
// so every later step behaves exactly like an expired/invalid session).
// Starting a new session invalidates any previous active session for the
// same user — only the newest stays valid.
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    const recoveryToken = generateRecoveryToken();

    if (user && user.status === "ACTIVE") {
      await prisma.recoverySession.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: new Date(), state: "EXPIRED" },
      });
      await prisma.recoverySession.create({
        data: {
          userId: user.id,
          tokenHash: hashRecoveryToken(recoveryToken),
          state: "STARTED",
          expiresAt: new Date(Date.now() + RECOVERY_SESSION_TTL_MS),
        },
      });
      void logActivity(req, "password_reset_requested", "Account recovery started", user.id);
    }
    // The cookie is set unconditionally with the same shape either way; the
    // JSON body carries no token and no hint of account existence.
    setRecoveryCookie(res, recoveryToken);
    res.json({ ok: true, message: "If an account exists for that email, recovery options are now available." });
  })
);

// ─── POST /api/auth/recovery/select-method ──────────────────────────────────
// The user picks exactly one method. Availability (does this account have
// TOTP / security questions configured?) is checked silently server-side —
// an unavailable method returns the SAME generic error as a missing/expired
// session, so a caller can never tell "no such account" apart from "account
// exists but that method isn't configured for it".
router.post(
  "/recovery/select-method",
  recoveryVerifyLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { method } = req.body as { method?: string };
    const session = await loadActiveRecoverySession(readRecoveryToken(req));
    if (!session || (session.state !== "STARTED" && session.state !== "METHOD_SELECTED") || !RECOVERY_METHODS.includes(method as RecoveryMethod)) {
      res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
      return;
    }
    const chosen = method as RecoveryMethod;
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
      return;
    }

    if (chosen === "totp") {
      if (!user.twoFactorEnabled) {
        res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
        return;
      }
      await prisma.recoverySession.update({
        where: { id: session.id },
        data: { state: "METHOD_SELECTED", method: METHOD_TO_STATE_FIELD.totp, totpAttempts: 0 },
      });
      res.json({ ok: true, method: "totp" });
      return;
    }

    if (chosen === "security_questions") {
      const questions = await prisma.securityQuestion.findMany({ where: { userId: user.id }, orderBy: { position: "asc" } });
      if (questions.length < 2) {
        res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
        return;
      }
      await prisma.recoverySession.update({
        where: { id: session.id },
        data: { state: "METHOD_SELECTED", method: METHOD_TO_STATE_FIELD.security_questions, securityAttempts: 0 },
      });
      res.json({
        ok: true,
        method: "security_questions",
        questions: questions.map((q) => ({ key: q.questionKey, text: securityQuestionText(q.questionKey) ?? q.questionKey })),
      });
      return;
    }

    // email_otp — every active account can always use this path, so
    // generate and send the code immediately on selection.
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + RESET_OTP_TTL_MS);
    await prisma.recoverySession.update({
      where: { id: session.id },
      data: {
        state: "METHOD_SELECTED",
        method: METHOD_TO_STATE_FIELD.email_otp,
        otpHash, otpExpiresAt, otpAttempts: 0, otpResendCount: 0, otpLastSentAt: new Date(),
      },
    });
    void sendAutomatedEmail({
      req, triggerKey: "recovery_otp", userId: user.id, to: user.email,
      defaultSubject: "Your Penny Pilot password reset code",
      defaultHtml: RECOVERY_OTP_EMAIL_HTML(user.name, otp),
      vars: { name: user.name, code: otp },
    });
    void logActivity(req, "password_reset_requested", "Email OTP requested", user.id);
    res.json({ ok: true, method: "email_otp" });
  })
);

// ─── POST /api/auth/recovery/resend-otp ─────────────────────────────────────
router.post(
  "/recovery/resend-otp",
  resendOtpLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const session = await loadActiveRecoverySession(readRecoveryToken(req));
    if (!session || session.state !== "METHOD_SELECTED" || session.method !== METHOD_TO_STATE_FIELD.email_otp) {
      res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
      return;
    }
    if (session.otpResendCount >= MAX_OTP_RESENDS) {
      await prisma.recoverySession.update({ where: { id: session.id }, data: { state: "LOCKED" } });
      res.status(429).json({ error: "Too many resend requests for this session. Please start over." });
      return;
    }
    if (session.otpLastSentAt && Date.now() - session.otpLastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      res.status(429).json({ error: "Please wait before requesting another code." });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
      return;
    }
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + RESET_OTP_TTL_MS);
    await prisma.recoverySession.update({
      where: { id: session.id },
      data: { otpHash, otpExpiresAt, otpAttempts: 0, otpResendCount: { increment: 1 }, otpLastSentAt: new Date() },
    });
    void sendAutomatedEmail({
      req, triggerKey: "recovery_otp", userId: user.id, to: user.email,
      defaultSubject: "Your Penny Pilot password reset code",
      defaultHtml: RECOVERY_OTP_EMAIL_HTML(user.name, otp),
      vars: { name: user.name, code: otp },
    });
    void logActivity(req, "password_reset_otp_resent", "Recovery OTP resent", user.id);
    res.json({ ok: true, message: "A new code has been sent." });
  })
);

// ─── POST /api/auth/recovery/verify-otp ─────────────────────────────────────
router.post(
  "/recovery/verify-otp",
  recoveryVerifyLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.body as { code?: string };
    const session = await loadActiveRecoverySession(readRecoveryToken(req));
    if (!session || session.state !== "METHOD_SELECTED" || session.method !== METHOD_TO_STATE_FIELD.email_otp || !code) {
      res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
      return;
    }
    if (!session.otpHash || !session.otpExpiresAt || Date.now() > session.otpExpiresAt.getTime()) {
      res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
      return;
    }
    if (session.otpAttempts >= MAX_OTP_ATTEMPTS) {
      await prisma.recoverySession.update({ where: { id: session.id }, data: { state: "LOCKED" } });
      void logActivity(req, "password_reset_failed", "Too many OTP attempts — recovery session locked", session.userId);
      res.status(429).json({ error: "Too many attempts. Please start over." });
      return;
    }
    const ok = await bcrypt.compare(code, session.otpHash);
    if (!ok) {
      await prisma.recoverySession.update({ where: { id: session.id }, data: { otpAttempts: { increment: 1 } } });
      res.status(400).json({ error: "Incorrect or expired code." });
      return;
    }
    await prisma.recoverySession.update({
      where: { id: session.id },
      data: { state: "AUTHORIZED", otpHash: null, otpExpiresAt: null, otpAttempts: 0 },
    });
    void logActivity(req, "password_reset_otp_verified", "Recovery OTP verified", session.userId);
    res.json({ ok: true, state: "AUTHORIZED" });
  })
);

// ─── POST /api/auth/recovery/verify-totp ────────────────────────────────────
// Reuses the existing verifyTwoFactorCode helper, so a saved backup code
// also satisfies this step (that's exactly what backup codes are for).
router.post(
  "/recovery/verify-totp",
  recoveryVerifyLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.body as { code?: string };
    const session = await loadActiveRecoverySession(readRecoveryToken(req));
    if (!session || session.state !== "METHOD_SELECTED" || session.method !== METHOD_TO_STATE_FIELD.totp || !code) {
      res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
      return;
    }
    if (session.totpAttempts >= MAX_TOTP_ATTEMPTS) {
      await prisma.recoverySession.update({ where: { id: session.id }, data: { state: "LOCKED" } });
      void logActivity(req, "password_reset_failed", "Too many authenticator attempts — recovery session locked", session.userId);
      res.status(429).json({ error: "Too many attempts. Please start over." });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !user.twoFactorEnabled) {
      res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
      return;
    }
    const valid = await verifyTwoFactorCode(user.id, user, code);
    if (!valid) {
      await prisma.recoverySession.update({ where: { id: session.id }, data: { totpAttempts: { increment: 1 } } });
      void logActivity(req, "password_reset_failed", "Invalid authenticator code during recovery", user.id);
      res.status(400).json({ error: "Incorrect verification code." });
      return;
    }
    await prisma.recoverySession.update({ where: { id: session.id }, data: { state: "AUTHORIZED", totpAttempts: 0 } });
    void logActivity(req, "password_reset_totp_verified", "Recovery authenticator code verified", user.id);
    res.json({ ok: true, state: "AUTHORIZED" });
  })
);

// ─── POST /api/auth/recovery/verify-security-answers ────────────────────────
router.post(
  "/recovery/verify-security-answers",
  recoveryVerifyLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { answer1, answer2 } = req.body as { answer1?: string; answer2?: string };
    const session = await loadActiveRecoverySession(readRecoveryToken(req));
    if (!session || session.state !== "METHOD_SELECTED" || session.method !== METHOD_TO_STATE_FIELD.security_questions || !answer1 || !answer2) {
      res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
      return;
    }
    if (session.securityAttempts >= MAX_SECURITY_ANSWER_ATTEMPTS) {
      await prisma.recoverySession.update({ where: { id: session.id }, data: { state: "LOCKED" } });
      void logActivity(req, "security_question_failed", "Too many security-answer attempts — recovery session locked", session.userId);
      res.status(429).json({ error: "Too many attempts. Please start over." });
      return;
    }
    const questions = await prisma.securityQuestion.findMany({ where: { userId: session.userId }, orderBy: { position: "asc" } });
    if (questions.length < 2) {
      res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
      return;
    }
    // Both answers must be correct — no 1-of-2 recovery, per product decision.
    const [q1, q2] = questions;
    const [match1, match2] = await Promise.all([
      bcrypt.compare(normalizeSecurityAnswer(answer1), q1.answerHash),
      bcrypt.compare(normalizeSecurityAnswer(answer2), q2.answerHash),
    ]);
    if (!match1 || !match2) {
      await prisma.recoverySession.update({ where: { id: session.id }, data: { securityAttempts: { increment: 1 } } });
      void logActivity(req, "security_question_failed", "Incorrect security answer(s)", session.userId);
      res.status(400).json({ error: "One or more answers are incorrect." });
      return;
    }
    await prisma.recoverySession.update({ where: { id: session.id }, data: { state: "AUTHORIZED", securityAttempts: 0 } });
    void logActivity(req, "security_question_verified", "Security questions verified", session.userId);
    res.json({ ok: true, state: "AUTHORIZED" });
  })
);

// ─── POST /api/auth/recovery/reset-password ─────────────────────────────────
router.post(
  "/recovery/reset-password",
  recoveryVerifyLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { newPassword } = req.body as { newPassword?: string };
    const session = await loadActiveRecoverySession(readRecoveryToken(req));
    if (!session || session.state !== "AUTHORIZED" || !newPassword) {
      res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
      return;
    }
    if (!isStrongPassword(newPassword)) {
      res.status(400).json({ error: "Password must be at least 8 characters and include a letter and a number" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      res.status(400).json({ error: RECOVERY_GENERIC_ERROR });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash, mustChangePassword: false },
      }),
      prisma.recoverySession.update({ where: { id: session.id }, data: { state: "COMPLETED", consumedAt: new Date() } }),
    ]);
    bumpSessionVersion(user.id); // sign out any existing sessions after a reset
    clearRecoveryCookie(res);
    void logActivity(req, "password_reset", `Password reset via account recovery (${session.method ?? "unknown"})`, user.id);
    void notifySecurityEvent(user.id, "security", "Password reset", "Your password was reset via account recovery.");
    void sendAutomatedEmail({
      req, triggerKey: "password_changed", userId: user.id, to: user.email,
      defaultSubject: "Your Penny Pilot password was changed",
      defaultHtml: PASSWORD_CHANGED_NOTIFICATION_EMAIL_HTML(user.name),
      vars: { name: user.name },
    });
    res.json({ ok: true, message: "Password reset successfully" });
  })
);

// NOTE: the legacy POST /api/auth/reset-password and POST
// /api/auth/recovery-options endpoints (uid + code + method body) have been
// removed. They had zero remaining frontend callers (confirmed by searching
// the frontend source), and — critically — they offered a bypass around the
// new choice-based recovery model: a caller who knew a valid email OTP or
// TOTP code could reset a password through them without ever touching a
// configured security-question requirement, since neither endpoint checked
// SecurityQuestion rows at all. Removing them (rather than patching them to
// also enforce security questions) eliminates that bypass surface entirely
// instead of maintaining two parallel, easy-to-desync reset implementations.
// User.resetOtpHash / resetOtpExpiry / resetOtpAttempts are left in the
// schema, unused, per the "don't touch unrelated schema" constraint.

// ─── Security questions (authenticated) ─────────────────────────────────────
// GET returns configured question KEYS only — never answers or hashes.
router.get(
  "/security-questions",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const questions = await prisma.securityQuestion.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { position: "asc" },
      select: { questionKey: true, position: true },
    });
    res.json({
      configured: questions.length >= 2,
      questions: questions.map((q) => ({ key: q.questionKey, position: q.position })),
      available: SECURITY_QUESTIONS,
    });
  })
);

// Setting/changing security questions requires the account's current
// password plus a recent 2FA re-verification (same bar as /change-uid),
// since this is a sensitive recovery-factor change on an already
// authenticated session.
router.patch(
  "/security-questions",
  authenticate,
  requireRecent2FA,
  asyncHandler(async (req: Request, res: Response) => {
    const { password, question1, answer1, question2, answer2 } = req.body as {
      password?: string; question1?: string; answer1?: string; question2?: string; answer2?: string;
    };
    if (!password || !question1 || !answer1 || !question2 || !answer2) {
      res.status(400).json({ error: "Both questions and answers, and your current password, are required" });
      return;
    }
    if (question1 === question2) {
      res.status(400).json({ error: "Please choose two different questions" });
      return;
    }
    if (!SECURITY_QUESTION_KEYS.has(question1) || !SECURITY_QUESTION_KEYS.has(question2)) {
      res.status(400).json({ error: "Please choose from the provided list of questions" });
      return;
    }
    if (normalizeSecurityAnswer(answer1).length === 0 || normalizeSecurityAnswer(answer2).length === 0) {
      res.status(400).json({ error: "Answers cannot be empty" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid password", code: "AUTH_INVALID" });
      return;
    }
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: "Invalid password", code: "AUTH_INVALID" });
      return;
    }
    const [hash1, hash2] = await Promise.all([
      bcrypt.hash(normalizeSecurityAnswer(answer1), 12),
      bcrypt.hash(normalizeSecurityAnswer(answer2), 12),
    ]);
    await prisma.$transaction([
      prisma.securityQuestion.upsert({
        where: { userId_position: { userId: user.id, position: 1 } },
        create: { userId: user.id, position: 1, questionKey: question1, answerHash: hash1 },
        update: { questionKey: question1, answerHash: hash1 },
      }),
      prisma.securityQuestion.upsert({
        where: { userId_position: { userId: user.id, position: 2 } },
        create: { userId: user.id, position: 2, questionKey: question2, answerHash: hash2 },
        update: { questionKey: question2, answerHash: hash2 },
      }),
    ]);
    void logActivity(req, "security_questions_updated", "Security questions configured/changed", user.id);
    void notifySecurityEvent(user.id, "security", "Security questions updated", "Your account-recovery security questions were changed.");
    res.json({ ok: true });
  })
);

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
// A hard logout: cookies are cleared unconditionally below, but that alone
// is a "soft" logout — a stale refresh cookie left behind by a race (e.g.
// the tab reloads before this request finishes) or lingering in another tab
// would still work with /api/auth/refresh. Bumping the session version here
// makes every outstanding access/refresh token cryptographically invalid
// immediately, closing that gap regardless of cookie-clearing mechanics.
router.post("/logout", (req: Request, res: Response) => {
  const signed = req.signedCookies as Record<string, string | undefined>;
  const token = signed["access_token"] || signed["refresh_token"];
  if (token) {
    try {
      // decode (not verify) — the cookie's HMAC signature already proves it
      // came from us via express's signed-cookie parsing; we only need the
      // userId claim, and the JWT itself may already be expired.
      const payload = jwt.decode(token) as { userId?: string } | null;
      if (payload?.userId) bumpSessionVersion(payload.userId);
    } catch {
      // ignore — cookies are still cleared below regardless
    }
  }
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
      res.status(401).json({ error: "No refresh token", code: "AUTH_REQUIRED" });
      return;
    }
    try {
      const payload = jwt.verify(token, REFRESH_SECRET) as AuthPayload;
      if (payload.sv !== getSessionVersion(payload.userId)) {
        res.clearCookie("access_token", { path: "/" });
        res.clearCookie("refresh_token", { path: "/api/auth" });
        res.status(401).json({ error: "Session ended: you were signed in elsewhere", code: "AUTH_EXPIRED" });
        return;
      }
      if (payload.sessionId && isSessionRevoked(payload.sessionId)) {
        res.clearCookie("access_token", { path: "/" });
        res.clearCookie("refresh_token", { path: "/api/auth" });
        res.status(401).json({ error: "This session was signed out by an administrator", code: "AUTH_EXPIRED" });
        return;
      }
      // Inactivity deadline, enforced independently of token cryptographic
      // validity — see lib/sessionExpiry.ts. undefined means the user's
      // configured timeout is "Never".
      if (payload.sessionExpiresAt !== undefined && Date.now() > payload.sessionExpiresAt) {
        res.clearCookie("access_token", { path: "/" });
        res.clearCookie("refresh_token", { path: "/api/auth" });
        res.status(401).json({ error: "Session expired due to inactivity", code: "AUTH_EXPIRED" });
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user || user.status !== "ACTIVE") {
        res.clearCookie("access_token", { path: "/" });
        res.clearCookie("refresh_token", { path: "/api/auth" });
        res.status(401).json({ error: "Account no longer active", code: "AUTH_FORBIDDEN" });
        return;
      }
      // Every refresh call — silent (background token renewal) or explicit
      // ("Stay Logged In") — is itself a signal of user activity, so it always
      // slides the inactivity deadline forward. Continuous inactivity is what
      // lets the deadline lapse; there is no longer a fixed absolute cutoff.
      const sessionExpiresAt = await computeSessionExpiryForUser(user.id);
      // Re-derive tfaEnabled from the DB for freshness, but carry forward
      // tfaVerifiedAt from the old token so refreshing never resets the 12h clock.
      const tfa: TfaClaims = { tfaEnabled: user.twoFactorEnabled, tfaVerifiedAt: payload.tfaVerifiedAt, sessionExpiresAt, sessionId: payload.sessionId };
      setTokenCookies(res, signAccess(user, payload.sv, tfa), signRefresh(user, payload.sv, tfa));
      res.json({ user: toUserJson(user), sessionExpiresAt });
    } catch (err) {
      res.clearCookie("access_token", { path: "/" });
      res.clearCookie("refresh_token", { path: "/api/auth" });
      const code = err instanceof jwt.TokenExpiredError ? "AUTH_EXPIRED" : "AUTH_INVALID";
      res.status(401).json({ error: "Invalid or expired refresh token", code });
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
      res.status(401).json({ error: "Account not found", code: "AUTH_EXPIRED" });
      return;
    }
    res.json({ user: toUserJson(user), sessionExpiresAt: req.auth!.sessionExpiresAt });
  })
);

// ─── PATCH /api/auth/change-password ────────────────────────────────────────
router.patch(
  "/change-password",
  loginLimiter,
  authenticate,
  requireRecent2FA,
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
      res.status(401).json({ error: "Current password is incorrect", code: "AUTH_INVALID" });
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

// ─── GET /api/auth/users/generate-temp-password ──────────────────────────────
// Stateless helper for the admin reset-password form — generates a candidate
// strong password without writing anything to the database.
router.get(
  "/users/generate-temp-password",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ password: generateTempPassword() });
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
        res.status(403).json({ error: "Only a Super Admin can grant or modify Super Admin access", code: "AUTH_FORBIDDEN" });
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
      // PENDING is included so any account created before this workflow was
      // removed can still be manually activated from here.
      if (target.status === "SUSPENDED" || target.status === "ACTIVE" || target.status === "PENDING") {
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
    void sendAutomatedEmail({
      req, triggerKey: "account_updated", userId: updated.id, to: updated.email,
      defaultSubject: "Your Penny Pilot account was updated",
      defaultHtml: ACCOUNT_UPDATED_BY_ADMIN_EMAIL_HTML(updated.name, changes),
      vars: { name: updated.name, changes: changes.join("; ") },
    });
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
    if (target.role === "SUPER_ADMIN" && req.auth!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Only a Super Admin can reset another Super Admin's password", code: "AUTH_FORBIDDEN" });
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
      emailSent = await sendAutomatedEmail({
        req, triggerKey: "password_reset_by_admin", userId: updated.id, to: updated.email,
        defaultSubject: "Your Penny Pilot password was reset",
        defaultHtml: PASSWORD_RESET_BY_ADMIN_EMAIL_HTML(updated.name, updated.uid, finalPassword),
        vars: { name: updated.name, uid: updated.uid, tempPassword: finalPassword },
      });
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
    if (target.role === "SUPER_ADMIN" && req.auth!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Only a Super Admin can reset another Super Admin's UID", code: "AUTH_FORBIDDEN" });
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
      emailSent = await sendAutomatedEmail({
        req, triggerKey: "uid_reset_by_admin", userId: updated.id, to: updated.email,
        defaultSubject: "Your Penny Pilot User ID was changed",
        defaultHtml: UID_RESET_BY_ADMIN_EMAIL_HTML(updated.name, trimmed),
        vars: { name: updated.name, uid: trimmed },
      });
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
    // Financial-model counts (transactions/budgets/etc.) are deliberately not included here —
    // that data lives solely in the user's own Google Drive, which the platform (and its
    // admins) has no visibility into by design.
    const [notifications, activityLogs] = await Promise.all([
      prisma.notification.count({ where: { userId: id } }),
      prisma.activityLog.count({ where: { userId: id } }),
    ]);
    res.json({
      counts: { notifications, activityLogs },
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
      // Mirrors PATCH /users/:id's role-change guard: a plain Admin must never be able to
      // remove a Super Admin account, only a Super Admin can.
      if (req.auth!.role !== "SUPER_ADMIN") {
        res.status(403).json({ error: "Only a Super Admin can delete a Super Admin account", code: "AUTH_FORBIDDEN" });
        return;
      }
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

// ─── PASSKEYS (WebAuthn) ─────────────────────────────────────────────────────
// Registration/authentication challenges are handed to the client as a
// short-lived signed JWT (same pattern as CHALLENGE_TOKEN_TTL above) rather
// than server-side session state, so this works statelessly across restarts
// and multiple instances.
const PASSKEY_CHALLENGE_TTL = 5 * 60; // 5 minutes

interface PasskeyChallengePayload {
  purpose: "passkey-register" | "passkey-login";
  challenge: string;
  userId?: string; // present for registration; absent for usernameless login
}

function signPasskeyChallenge(payload: PasskeyChallengePayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: PASSKEY_CHALLENGE_TTL });
}

function readPasskeyChallenge(token: string): PasskeyChallengePayload {
  return jwt.verify(token, ACCESS_SECRET) as PasskeyChallengePayload;
}

// POST /api/auth/passkey/register/options — start enrolling a new passkey.
// Requires the account password (and current 2FA code, if enabled) so an
// attacker with a hijacked session can't silently add a persistent backdoor credential.
router.post(
  "/passkey/register/options",
  loginLimiter,
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { password, code } = req.body as { password?: string; code?: string };
    if (!password) {
      res.status(400).json({ error: "Password is required" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, include: { passkeys: true } });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Incorrect password", code: "AUTH_INVALID" });
      return;
    }
    if (user.twoFactorEnabled) {
      if (!code || !(await verifyTwoFactorCode(user.id, user, code))) {
        res.status(401).json({ error: "Invalid or missing verification code", code: "AUTH_INVALID" });
        return;
      }
    }
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.uid,
      userDisplayName: user.name,
      userID: new TextEncoder().encode(user.id),
      attestationType: "none",
      excludeCredentials: user.passkeys.map((p) => ({
        id: p.credentialId,
        transports: p.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });
    const challengeToken = signPasskeyChallenge({ purpose: "passkey-register", challenge: options.challenge, userId: user.id });
    res.json({ options, challengeToken });
  })
);

// POST /api/auth/passkey/register/verify — complete enrollment and store the credential.
router.post(
  "/passkey/register/verify",
  loginLimiter,
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { response, challengeToken, name } = req.body as {
      response?: RegistrationResponseJSON;
      challengeToken?: string;
      name?: string;
    };
    if (!response || !challengeToken || !name?.trim()) {
      res.status(400).json({ error: "Missing registration response" });
      return;
    }
    let payload: PasskeyChallengePayload;
    try {
      payload = readPasskeyChallenge(challengeToken);
    } catch {
      res.status(400).json({ error: "Registration challenge expired. Please try again." });
      return;
    }
    if (payload.purpose !== "passkey-register" || payload.userId !== req.auth!.userId) {
      res.status(400).json({ error: "Invalid registration challenge." });
      return;
    }
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: payload.challenge,
        expectedOrigin: RP_ORIGINS,
        expectedRPID: RP_ID,
      });
    } catch {
      res.status(400).json({ error: "Could not verify passkey registration." });
      return;
    }
    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: "Could not verify passkey registration." });
      return;
    }
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    await prisma.passkey.create({
      data: {
        userId: req.auth!.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports ?? [],
        name: name.trim().slice(0, 60),
      },
    });
    void logActivity(req, "passkey_registered", `Passkey "${name.trim().slice(0, 60)}" registered`, req.auth!.userId);
    void notifySecurityEvent(req.auth!.userId, "security", "Passkey added", `A new passkey ("${name.trim().slice(0, 60)}") was registered on your account.`);
    res.json({ ok: true });
  })
);

// GET /api/auth/passkey — list the current user's registered passkeys.
router.get(
  "/passkey",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const passkeys = await prisma.passkey.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, deviceType: true, backedUp: true, transports: true, lastUsedAt: true, createdAt: true },
    });
    res.json({ passkeys });
  })
);

// PATCH /api/auth/passkey/:id — rename a passkey.
router.patch(
  "/passkey/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    const passkey = await prisma.passkey.findUnique({ where: { id: String(req.params.id) } });
    if (!passkey || passkey.userId !== req.auth!.userId) {
      res.status(404).json({ error: "Passkey not found" });
      return;
    }
    await prisma.passkey.update({ where: { id: passkey.id }, data: { name: name.trim().slice(0, 60) } });
    res.json({ ok: true });
  })
);

// DELETE /api/auth/passkey/:id — remove a passkey. Same password (+2FA) bar as enrollment.
router.delete(
  "/passkey/:id",
  loginLimiter,
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { password, code } = req.body as { password?: string; code?: string };
    if (!password) {
      res.status(400).json({ error: "Password is required" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Incorrect password", code: "AUTH_INVALID" });
      return;
    }
    if (user.twoFactorEnabled) {
      if (!code || !(await verifyTwoFactorCode(user.id, user, code))) {
        res.status(401).json({ error: "Invalid or missing verification code", code: "AUTH_INVALID" });
        return;
      }
    }
    const passkey = await prisma.passkey.findUnique({ where: { id: String(req.params.id) } });
    if (!passkey || passkey.userId !== req.auth!.userId) {
      res.status(404).json({ error: "Passkey not found" });
      return;
    }
    await prisma.passkey.delete({ where: { id: passkey.id } });
    void logActivity(req, "passkey_removed", `Passkey "${passkey.name}" removed`, req.auth!.userId);
    void notifySecurityEvent(req.auth!.userId, "security", "Passkey removed", `The passkey "${passkey.name}" was removed from your account.`);
    res.json({ ok: true });
  })
);

// POST /api/auth/passkey/login/options — start a usernameless ("discoverable
// credential") passkey sign-in. No uid needed: the authenticator itself
// surfaces which of the user's stored passkeys apply to this site.
router.post(
  "/passkey/login/options",
  loginLimiter,
  asyncHandler(async (_req: Request, res: Response) => {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: "preferred",
    });
    const challengeToken = signPasskeyChallenge({ purpose: "passkey-login", challenge: options.challenge });
    res.json({ options, challengeToken });
  })
);

// POST /api/auth/passkey/login/verify — complete passkey sign-in and issue session tokens.
router.post(
  "/passkey/login/verify",
  loginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { response, challengeToken, portal } = req.body as { response?: AuthenticationResponseJSON; challengeToken?: string; portal?: string };
    if (!response || !challengeToken) {
      res.status(400).json({ error: "Missing authentication response" });
      return;
    }
    let payload: PasskeyChallengePayload;
    try {
      payload = readPasskeyChallenge(challengeToken);
    } catch {
      res.status(400).json({ error: "Sign-in challenge expired. Please try again." });
      return;
    }
    if (payload.purpose !== "passkey-login") {
      res.status(400).json({ error: "Invalid sign-in challenge." });
      return;
    }
    const passkey = await prisma.passkey.findUnique({ where: { credentialId: response.id } });
    if (!passkey) {
      res.status(401).json({ error: "This passkey is not registered with any account.", code: "AUTH_INVALID" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: passkey.userId } });
    if (!user || user.status !== "ACTIVE") {
      res.status(403).json({ error: "This account is not available for sign-in.", code: "AUTH_FORBIDDEN" });
      return;
    }
    // Portal separation (backend-enforced) — same gate and same shared helper as password
    // /login, checked before any WebAuthn verification or token issuance. See lib/portal.ts.
    if (enforcePortalOrReject(req, res, user, portal)) return;
    if (await isRestricted(user.id)) {
      res.status(403).json({ error: "Your account access has been restricted. Contact support.", code: "AUTH_FORBIDDEN" });
      return;
    }
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: payload.challenge,
        expectedOrigin: RP_ORIGINS,
        expectedRPID: RP_ID,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64url")),
          counter: Number(passkey.counter),
          transports: passkey.transports as AuthenticatorTransportFuture[],
        },
      });
    } catch {
      res.status(401).json({ error: "Could not verify passkey sign-in.", code: "AUTH_INVALID" });
      return;
    }
    if (!verification.verified) {
      res.status(401).json({ error: "Could not verify passkey sign-in.", code: "AUTH_INVALID" });
      return;
    }
    await prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter), lastUsedAt: new Date() },
    });
    const sv = bumpSessionVersion(user.id);
    const sessionExpiresAt = await computeSessionExpiryForUser(user.id);
    const sessionId = (await createSessionRecord(req, user.id)) ?? undefined;
    // A successful WebAuthn assertion is itself strong, device-bound, user-verified proof
    // of identity — for accounts with 2FA enabled we treat it as satisfying the recent-2FA
    // window too (same trust level as a fresh TOTP check), so it starts its own 12h clock.
    const tfa: TfaClaims = user.twoFactorEnabled
      ? { tfaEnabled: true, tfaVerifiedAt: Date.now(), sessionExpiresAt, sessionId }
      : { tfaEnabled: false, sessionExpiresAt, sessionId };
    const isFirstLogin = user.lastLoginAt === null;
    setTokenCookies(res, signAccess(user, sv, tfa), signRefresh(user, sv, tfa));
    void prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    void createNotification(user.id, "security", "New sign-in", "Your account was signed in with a passkey.");
    res.json({ user: toUserJson(user), sessionExpiresAt, isFirstLogin });
  })
);

export default router;
