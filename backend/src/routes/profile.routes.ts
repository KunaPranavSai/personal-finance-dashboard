import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { requireRecent2FA } from "../middleware/auth";
import { z } from "zod";
import { getRecord, upsertRecordWithId } from "../services/drive/dataService";
import { DriveRecord } from "../services/drive/types";

const PROFILE_RECORD_ID = "app_profile";

const defaultProfile = {
  name: "",
  email: "",
  phone: "",
  occupation: "",
  monthlyIncome: 0,
  country: "India",
  state: "",
  city: "",
  currency: "INR",
  timezone: "Asia/Kolkata",
  language: "en",
  theme: "light",
  financialGoal: "",
  riskAppetite: "moderate",
  investmentExperience: "beginner",
  emergencyFundTarget: 0,
  bio: "",
  avatar: null as string | null,
  dateFormat: "DD-MM-YYYY",
  weekStartsOn: "monday",
  notifications: {
    email: true,
    push: true,
    budgetAlerts: true,
    billReminders: true,
    goalUpdates: true,
    insights: true,
  },
  financialPreferences: {
    savingsGoal: 20,
    emergencyFundMonths: 6,
    riskTolerance: "moderate",
    budgetMethod: "envelope",
  },
};

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value) && typeof result[key] === "object" && result[key] !== null) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

interface ProfileRecord extends DriveRecord {
  [key: string]: unknown;
}

/** Whether this account has a personal Drive-backed financial workspace at
 * all. Admins never do (they manage the platform, not personal finances).
 * A regular USER who hasn't connected Drive — most commonly because they
 * chose "This Device Only" storage — doesn't either, even though role-wise
 * they're a normal user; this is the same check requireDriveConnected uses
 * (backend/src/middleware/auth.ts), duplicated here rather than imported
 * since profile intentionally never blocks on it, only branches on it. */
async function hasDriveWorkspace(userId: string, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return false;
  const connection = await prisma.backupConnection.findUnique({
    where: { userId_provider: { userId, provider: "google_drive" } },
    select: { backupFolderId: true },
  });
  return Boolean(connection?.backupFolderId);
}

/** Profile lives in the user's own Google Drive when they have one (see
 * services/drive) — everyone else (admins, and USER accounts that chose
 * Local-Only storage and never connected Drive) gets a Postgres-backed
 * profile instead, via the same AppProfile table already used for admins.
 * Local-Only users' actual financial data still never leaves their device;
 * this is just the small non-financial profile record (name/email/bio/etc.),
 * which has nowhere else to live for an account with no Drive workspace. */
async function getOrCreateProfile(userId: string, usePostgres: boolean): Promise<Record<string, unknown>> {
  // The account's own name/email (set at signup) are the real values for a
  // user who hasn't filled in a Profile record yet — never a placeholder
  // like "User"/"user@example.com", which would otherwise get silently
  // saved as real data the first time the user hits Save without editing
  // anything.
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  const seed = { ...defaultProfile, name: account?.name ?? "", email: account?.email ?? "" };
  if (usePostgres) {
    let row = await prisma.appProfile.findUnique({ where: { userId } });
    if (!row) row = await prisma.appProfile.create({ data: { userId, data: seed as object } });
    const data = row.data as Record<string, unknown>;
    if (!data.name || Object.keys(data).length === 0) return seed as unknown as Record<string, unknown>;
    return deepMerge(seed as unknown as Record<string, unknown>, data);
  }
  const record = await getRecord<ProfileRecord>(userId, "settings", PROFILE_RECORD_ID);
  if (!record) return seed as unknown as Record<string, unknown>;
  return deepMerge(seed as unknown as Record<string, unknown>, record);
}

async function updateProfile(userId: string, usePostgres: boolean, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const current = await getOrCreateProfile(userId, usePostgres);
  const merged = deepMerge(current, data);
  if (usePostgres) {
    await prisma.appProfile.upsert({ where: { userId }, update: { data: merged as object }, create: { userId, data: merged as object } });
  } else {
    await upsertRecordWithId(userId, "settings", PROFILE_RECORD_ID, merged);
  }
  // Keep the account's own `name` (used by /api/auth/me, greetings, the topbar, etc.) in sync
  // with the profile's display name — this is auth-account data, so it always stays in Postgres.
  if (typeof data.name === "string" && data.name.trim()) {
    await prisma.user.update({ where: { id: userId }, data: { name: data.name.trim() } });
  }
  return merged;
}

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  occupation: z.string().max(100).optional(),
  monthlyIncome: z.coerce.number().nonnegative().optional(),
  country: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  language: z.string().length(2).optional(),
  theme: z.enum(["light", "dark"]).optional(),
  financialGoal: z.string().max(200).optional(),
  riskAppetite: z.string().optional(),
  investmentExperience: z.string().optional(),
  emergencyFundTarget: z.coerce.number().nonnegative().optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().nullable().optional(),
  dateFormat: z.string().optional(),
  weekStartsOn: z.enum(["monday", "sunday"]).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    budgetAlerts: z.boolean().optional(),
    billReminders: z.boolean().optional(),
    goalUpdates: z.boolean().optional(),
    insights: z.boolean().optional(),
  }).optional(),
  financialPreferences: z.object({
    savingsGoal: z.number().min(0).max(100).optional(),
    emergencyFundMonths: z.number().min(0).optional(),
    riskTolerance: z.string().optional(),
    budgetMethod: z.string().optional(),
  }).optional(),
});

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const usePostgres = await hasDriveWorkspace(req.auth!.userId, req.auth!.role !== "USER").then((has) => !has);
    const profile = await getOrCreateProfile(req.auth!.userId, usePostgres);
    res.json(profile);
  })
);

router.patch(
  "/",
  requireRecent2FA,
  asyncHandler(async (req, res) => {
    const data = updateProfileSchema.parse(req.body);
    const usePostgres = await hasDriveWorkspace(req.auth!.userId, req.auth!.role !== "USER").then((has) => !has);
    const updated = await updateProfile(req.auth!.userId, usePostgres, data);
    res.json(updated);
  })
);

export default router;
