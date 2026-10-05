import { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";

/** 1 = explorer (email not verified), 2 = email verified, 3 = profile + consent completed. */
export type AuthLevel = 1 | 2 | 3;

export function levelOf(u: { emailVerifiedAt: Date | null; profileCompletedAt: Date | null }): AuthLevel {
  if (!u.emailVerifiedAt) return 1;
  return u.profileCompletedAt ? 3 : 2;
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

async function enforce(req: Request, res: Response, next: NextFunction, needed: AuthLevel) {
  // Admin/staff accounts are not part of the progressive flow.
  if (req.auth!.role !== "USER") return next();
  const u = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { emailVerifiedAt: true, profileCompletedAt: true } });
  const have = u ? levelOf(u) : 1;
  if (have >= needed) return next();
  res.status(403).json({ error: have < 2 ? "Verify your email to continue" : "Complete your profile to continue", code: "STEP_UP", needed, have });
}

/** Reads are open to explorers; every write needs a verified email AND a completed profile (consent is recorded before any data is stored). */
export function requireLevelForWrites(req: Request, res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  void enforce(req, res, next, 3).catch(next);
}

export function requireLevel(needed: AuthLevel) {
  return (req: Request, res: Response, next: NextFunction) => {
    void enforce(req, res, next, needed).catch(next);
  };
}
