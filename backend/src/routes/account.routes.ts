import { Router, Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { ACCESS_SECRET } from "../lib/tokens";
import { bumpSessionVersion } from "../lib/sessionVersion";
import { markSessionsRevoked } from "../lib/sessionRevocation";
import { invalidateAccountLock } from "../lib/accountLock";
import { logActivity } from "../lib/activityLog";
import { notifySecurityEvent } from "../lib/notify";
import { sendAutomatedEmail } from "../services/email/automation";
import { completeLogin, verifyTwoFactorCode } from "./auth.routes";

/**
 * Account deletion (owner-initiated, 30-day grace period) and reactivation.
 *
 * Deleting needs FOUR independent proofs, each checked by the server and returned as a short-lived signed token:
 *   PIN (existing PIN hash) · password (existing hash) · two-factor (existing TOTP/backup-code check) · phone.
 * The platform has no SMS provider, so "phone verified" means: the full number typed matches the one on the account AND
 * a one-time code emailed to the registered address is entered. After the four proofs a server-generated puzzle must be
 * solved before the request is accepted. Nothing here is trusted from the client except the signed tokens.
 */
const router = Router();

const DELETION_DAYS = 30;
const PROOF_TTL = "10m";
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const hmac = (purpose: string, userId: string, value: string) => crypto.createHmac("sha256", ACCESS_SECRET).update(`${purpose}:${userId}:${value}`).digest("hex");
const eq = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const sign = (purpose: string, userId: string, extra: Record<string, unknown> = {}, expiresIn: string = PROOF_TTL) =>
  jwt.sign({ purpose, userId, ...extra }, ACCESS_SECRET, { expiresIn } as jwt.SignOptions);
function read(token: unknown, purpose: string, userId: string): Record<string, unknown> | null {
  if (typeof token !== "string") return null;
  try {
    const p = jwt.verify(token, ACCESS_SECRET) as Record<string, unknown>;
    return p.purpose === purpose && p.userId === userId ? p : null;
  } catch {
    return null;
  }
}

// Per-account attempt limiter for the verification steps (in-memory, same approach as the other short-lived limiters).
const attempts = new Map<string, { n: number; until: number }>();
function tooMany(key: string, limit = 6, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.until < now) { attempts.set(key, { n: 1, until: now + windowMs }); return false; }
  a.n += 1;
  return a.n > limit;
}
const publicLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Too many attempts. Please try again later.", code: "AUTH_RATE_LIMITED" } });

async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) { res.status(401).json({ error: "Account not found", code: "AUTH_EXPIRED" }); return null; }
  if (user.role !== "USER") { res.status(403).json({ error: "Administrator accounts cannot be deleted here", code: "AUTH_FORBIDDEN" }); return null; }
  return user;
}
const limited = (res: Response) => res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again.", code: "AUTH_RATE_LIMITED" });

async function emailCode(userId: string, email: string, name: string, code: string, purpose: string) {
  return sendAutomatedEmail({ triggerKey: "account_action_code", userId, to: email, vars: { name: name || "there", code, purpose } });
}

// ───────────────────────── Deletion (signed-in owner) ─────────────────────────
router.use("/deletion", authenticate);

router.get("/deletion/status", asyncHandler(async (req: Request, res: Response) => {
  const user = await me(req, res); if (!user) return;
  res.json({ hasPin: Boolean(user.pinHash), hasPassword: Boolean(user.passwordHash), twoFactorEnabled: user.twoFactorEnabled, hasPhone: digits(user.phone).length >= 6, days: DELETION_DAYS });
}));

router.post("/deletion/pin", asyncHandler(async (req: Request, res: Response) => {
  const user = await me(req, res); if (!user) return;
  if (tooMany(`pin:${user.id}`)) return limited(res);
  const pin = String((req.body as { pin?: string }).pin ?? "");
  if (!user.pinHash || !/^\d{4}$/.test(pin) || !(await bcrypt.compare(pin, user.pinHash))) {
    void logActivity(req, "account_deletion_verify_failed", "PIN check failed", user.id);
    res.status(401).json({ error: "Incorrect PIN", code: "AUTH_INVALID" }); return;
  }
  void logActivity(req, "account_deletion_verify", "PIN verified for account deletion", user.id);
  res.json({ proof: sign("del-pin", user.id) });
}));

router.post("/deletion/password", asyncHandler(async (req: Request, res: Response) => {
  const user = await me(req, res); if (!user) return;
  if (tooMany(`pw:${user.id}`)) return limited(res);
  const password = String((req.body as { password?: string }).password ?? "");
  if (!user.passwordHash || !password || !(await bcrypt.compare(password, user.passwordHash))) {
    void logActivity(req, "account_deletion_verify_failed", "Password check failed", user.id);
    res.status(401).json({ error: "Incorrect password", code: "AUTH_INVALID" }); return;
  }
  void logActivity(req, "account_deletion_verify", "Password verified for account deletion", user.id);
  res.json({ proof: sign("del-pw", user.id) });
}));

router.post("/deletion/2fa", asyncHandler(async (req: Request, res: Response) => {
  const user = await me(req, res); if (!user) return;
  if (!user.twoFactorEnabled) { res.status(400).json({ error: "Turn on two-factor authentication in Security settings first, then come back.", code: "TWO_FACTOR_REQUIRED" }); return; }
  if (tooMany(`2fa:${user.id}`)) return limited(res);
  const code = String((req.body as { code?: string }).code ?? "").trim();
  if (!code || !(await verifyTwoFactorCode(user.id, user, code))) {
    void logActivity(req, "account_deletion_verify_failed", "Two-factor check failed", user.id);
    res.status(401).json({ error: "Invalid two-factor code", code: "AUTH_INVALID" }); return;
  }
  void logActivity(req, "account_deletion_verify", "Two-factor verified for account deletion", user.id);
  res.json({ proof: sign("del-2fa", user.id) });
}));

router.post("/deletion/phone/send", asyncHandler(async (req: Request, res: Response) => {
  const user = await me(req, res); if (!user) return;
  if (tooMany(`phs:${user.id}`, 5)) return limited(res);
  const onFile = digits(user.phone);
  if (onFile.length < 6) { res.status(400).json({ error: "Add a phone number to your profile first, then come back.", code: "PHONE_NOT_ON_FILE" }); return; }
  if (digits((req.body as { phone?: string }).phone) !== onFile) { res.status(400).json({ error: "That doesn't match the phone number on this account.", code: "PHONE_MISMATCH" }); return; }
  const code = String(crypto.randomInt(100000, 1000000));
  const sent = await emailCode(user.id, user.email, user.name, code, "confirming your phone number to delete your account");
  if (!sent) { res.status(503).json({ error: "We couldn't send the confirmation code. Please try again shortly.", code: "EMAIL_SEND_FAILED" }); return; }
  void logActivity(req, "account_deletion_verify", "Phone confirmation code sent to the registered email", user.id);
  res.json({ challenge: sign("del-phone-ch", user.id, { h: hmac("del-phone", user.id, code) }), sentTo: user.email.replace(/^(.).*(@.*)$/, "$1***$2") });
}));

router.post("/deletion/phone/verify", asyncHandler(async (req: Request, res: Response) => {
  const user = await me(req, res); if (!user) return;
  if (tooMany(`phv:${user.id}`)) return limited(res);
  const { challenge, code } = req.body as { challenge?: string; code?: string };
  const p = read(challenge, "del-phone-ch", user.id);
  if (!p || !/^\d{6}$/.test(String(code ?? "")) || !eq(String(p.h), hmac("del-phone", user.id, String(code)))) {
    void logActivity(req, "account_deletion_verify_failed", "Phone confirmation code was wrong or expired", user.id);
    res.status(401).json({ error: "That code is wrong or has expired.", code: "AUTH_INVALID" }); return;
  }
  void logActivity(req, "account_deletion_verify", "Phone number verified for account deletion", user.id);
  res.json({ proof: sign("del-phone", user.id) });
}));

function checkProofs(userId: string, proofs: Record<string, unknown> | undefined): boolean {
  return Boolean(proofs) && read(proofs!.pin, "del-pin", userId) !== null && read(proofs!.password, "del-pw", userId) !== null
    && read(proofs!.twofa, "del-2fa", userId) !== null && read(proofs!.phone, "del-phone", userId) !== null;
}

// Step after the slider: a server-made puzzle, only handed out once all four proofs are valid.
router.post("/deletion/puzzle", asyncHandler(async (req: Request, res: Response) => {
  const user = await me(req, res); if (!user) return;
  if (!checkProofs(user.id, (req.body as { proofs?: Record<string, unknown> }).proofs)) { res.status(403).json({ error: "Finish all four verifications first.", code: "VERIFICATION_INCOMPLETE" }); return; }
  const a = crypto.randomInt(12, 60), b = crypto.randomInt(3, 12), c = crypto.randomInt(5, 90);
  const answer = String(a * b + c);
  void logActivity(req, "account_deletion_requested", "Account deletion confirmation puzzle issued", user.id);
  res.json({ prompt: `Solve to confirm: ${a} × ${b} + ${c}`, puzzleToken: sign("del-puzzle", user.id, { h: hmac("del-puzzle", user.id, answer) }, "5m") });
}));

router.post("/deletion/schedule", asyncHandler(async (req: Request, res: Response) => {
  const user = await me(req, res); if (!user) return;
  if (tooMany(`sch:${user.id}`, 8)) return limited(res);
  const { proofs, puzzleToken, answer } = req.body as { proofs?: Record<string, unknown>; puzzleToken?: string; answer?: string };
  const pz = read(puzzleToken, "del-puzzle", user.id);
  if (!checkProofs(user.id, proofs) || !pz || !eq(String(pz.h), hmac("del-puzzle", user.id, String(answer ?? "").trim()))) {
    res.status(403).json({ error: "The confirmation could not be verified. Please start again.", code: "VERIFICATION_INCOMPLETE" }); return;
  }
  const now = new Date();
  const when = new Date(now.getTime() + DELETION_DAYS * 86_400_000);
  await prisma.user.update({ where: { id: user.id }, data: { deletionRequestedAt: now, scheduledDeletionAt: when } });
  invalidateAccountLock(user.id);
  // Close every session now, on every device.
  bumpSessionVersion(user.id);
  const open = await prisma.session.findMany({ where: { userId: user.id, revokedAt: null }, select: { id: true } });
  markSessionsRevoked(open.map((s) => s.id));
  await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/api/auth" });
  void logActivity(req, "account_deletion_scheduled", `Account deletion scheduled for ${when.toISOString()}`, user.id);
  void notifySecurityEvent(user.id, "security", "Account deletion scheduled", `Your account will be permanently deleted on ${when.toDateString()} unless you reactivate it before then.`, { req });
  res.json({ ok: true, scheduledDeletionAt: when });
}));

// ───────────────────────── Reactivation (public, fresh authentication) ─────────────────────────
// Needs the registered email, the account PASSWORD (never a PIN or remembered device) and the registered phone number,
// confirmed by a code emailed to the registered address.
const fail = (res: Response) => res.status(401).json({ error: "Those details don't match a recoverable account.", code: "AUTH_INVALID" });

router.post("/reactivate/start", publicLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { email, password, phone } = req.body as { email?: string; password?: string; phone?: string };
  const user = typeof email === "string" ? await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } }) : null;
  const fakeHash = "$2a$10$abcdefghijklmnopqrstuuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01"; // equalise timing for unknown accounts
  const okPw = await bcrypt.compare(String(password ?? ""), user?.passwordHash ?? fakeHash);
  if (!user || !user.scheduledDeletionAt || user.scheduledDeletionAt <= new Date() || !okPw || digits(phone) !== digits(user.phone) || digits(user.phone).length < 6) { fail(res); return; }
  const code = String(crypto.randomInt(100000, 1000000));
  const sent = await emailCode(user.id, user.email, user.name, code, "reactivating your Penny Pilot account");
  if (!sent) { res.status(503).json({ error: "We couldn't send the confirmation code. Please try again shortly.", code: "EMAIL_SEND_FAILED" }); return; }
  void logActivity(req, "account_reactivation_started", "Reactivation verification started", user.id);
  res.json({ challenge: sign("react-ch", user.id, { h: hmac("react", user.id, code) }) });
}));

router.post("/reactivate/verify", publicLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { challenge, code } = req.body as { challenge?: string; code?: string };
  let userId = "";
  try { userId = String((jwt.verify(String(challenge), ACCESS_SECRET) as { userId?: string }).userId ?? ""); } catch { fail(res); return; }
  const p = read(challenge, "react-ch", userId);
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!p || !user || !user.scheduledDeletionAt || user.scheduledDeletionAt <= new Date() || !/^\d{6}$/.test(String(code ?? "")) || !eq(String(p.h), hmac("react", userId, String(code)))) { fail(res); return; }
  const restored = await prisma.user.update({ where: { id: user.id }, data: { deletionRequestedAt: null, scheduledDeletionAt: null, failedLoginAttempts: 0, lockedUntil: null } });
  invalidateAccountLock(user.id);
  void logActivity(req, "account_reactivated", "Account deletion cancelled; account reactivated", user.id);
  void notifySecurityEvent(user.id, "security", "Account reactivated", "Your account deletion was cancelled and your account is active again.", { req });
  // Fresh sign-in: the shared login completion issues a new session (and still honours 2FA / forced password change).
  await completeLogin(req, res, restored, false);
}));

export default router;
