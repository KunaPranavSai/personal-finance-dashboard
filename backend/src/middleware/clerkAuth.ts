import type { Request, Response, NextFunction } from "express";
import { verifyToken, clerkClient } from "@clerk/express";
import { prisma } from "../lib/prisma";
import { notifyAdmins } from "../lib/notify";
import type { AuthPayload } from "./auth";

/**
 * Additive Clerk authentication path — see backend/src/middleware/auth.ts,
 * which delegates here when AUTH_PROVIDER=clerk. Nothing in the legacy
 * password/JWT/2FA/session system is modified or removed by this file; it is
 * a parallel path that produces the exact same `req.auth` shape
 * (AuthPayload) so every existing route handler, and authorization/business
 * logic, works completely unchanged regardless of which provider verified
 * the request.
 */

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

function extractSessionToken(req: Request): string | null {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (bearer) return bearer;
  // Clerk's Next.js client stores the session JWT in the `__session` cookie.
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.__session ?? null;
}

/** UID must match /^[a-zA-Z0-9_.@-]{4,50}$/ (see auth.routes.ts) — email already satisfies this. */
async function generateUniqueUid(preferred: string): Promise<string> {
  const base = preferred.slice(0, 50);
  let candidate = base;
  let suffix = 0;
  while (await prisma.user.findUnique({ where: { uid: candidate } })) {
    suffix += 1;
    candidate = `${base.slice(0, 46)}-${suffix}`;
  }
  return candidate;
}

/**
 * Resolves (or creates) the User row — the same row every financial table
 * already references via userId — for a verified Clerk identity. Mirrors the
 * legacy /api/auth/signup business rule: brand-new accounts land in PENDING
 * status awaiting admin approval, same as password-based signup. An existing
 * legacy account with a matching email is linked (not duplicated) the first
 * time its owner signs in with Clerk, preserving all of their existing data.
 */
async function resolveOrProvisionUser(clerkUserId: string) {
  const existingByClerkId = await prisma.user.findUnique({ where: { clerkUserId } });
  if (existingByClerkId) return existingByClerkId;

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;
  if (!primaryEmail) {
    throw new Error("Clerk account has no email address on file");
  }
  const normalizedEmail = primaryEmail.trim().toLowerCase();
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || normalizedEmail.split("@")[0];
  const avatarUrl = clerkUser.imageUrl || null;

  const existingByEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingByEmail) {
    // Same person, previously created via the legacy flow — link the Clerk
    // identity onto their existing (and possibly already-approved) account.
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: { clerkUserId, avatarUrl: avatarUrl ?? existingByEmail.avatarUrl },
    });
  }

  const uid = await generateUniqueUid(normalizedEmail);
  const user = await prisma.user.create({
    data: {
      uid,
      email: normalizedEmail,
      name,
      clerkUserId,
      avatarUrl,
      role: "USER",
      status: "PENDING",
    },
  });
  void notifyAdmins(
    "user_signup",
    "New user registration",
    `${user.name} (${user.email}) signed up via Clerk and is awaiting approval.`
  );
  return user;
}

export async function authenticateClerk(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!CLERK_SECRET_KEY) {
    res.status(500).json({ error: "Clerk is not configured on the server (missing CLERK_SECRET_KEY)" });
    return;
  }
  const token = extractSessionToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const { data: claims, errors } = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    if (errors || !claims?.sub) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    const user = await resolveOrProvisionUser(claims.sub);
    if (user.status !== "ACTIVE") {
      res.status(403).json({ error: user.status === "PENDING" ? "Your account is awaiting administrator approval." : "This account is not available." });
      return;
    }
    const payload: AuthPayload = {
      userId: user.id,
      uid: user.uid,
      role: user.role,
      sv: user.sessionVersion,
      tfaEnabled: user.twoFactorEnabled,
      // Clerk owns this session's lifetime/expiry directly (its own session
      // token `exp`, already checked by verifyToken above) — the legacy
      // sessionExpiresAt/tfaVerifiedAt claims below are specific to the JWT
      // issued by the legacy provider and don't apply to a Clerk session.
      tfaVerifiedAt: undefined,
      sessionExpiresAt: undefined,
    };
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
