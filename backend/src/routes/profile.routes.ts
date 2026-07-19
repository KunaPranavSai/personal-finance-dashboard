import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { z } from "zod";

const defaultProfile = {
  name: "User",
  email: "user@example.com",
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

async function getOrCreateProfile(): Promise<Record<string, unknown>> {
  let row = await prisma.appProfile.findUnique({ where: { id: "singleton" } });
  if (!row) {
    row = await prisma.appProfile.create({
      data: { id: "singleton", data: defaultProfile as object },
    });
  }
  const data = row.data as Record<string, unknown>;
  if (!data.name || Object.keys(data).length === 0) {
    return defaultProfile as unknown as Record<string, unknown>;
  }
  return deepMerge(defaultProfile as unknown as Record<string, unknown>, data);
}

async function updateProfile(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const current = await getOrCreateProfile();
  const merged = deepMerge(current, data);
  await prisma.appProfile.upsert({
    where: { id: "singleton" },
    update: { data: merged as object },
    create: { id: "singleton", data: merged as object },
  });
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
  asyncHandler(async (_req, res) => {
    const profile = await getOrCreateProfile();
    res.json(profile);
  })
);

router.patch(
  "/",
  asyncHandler(async (req, res) => {
    const data = updateProfileSchema.parse(req.body);
    const updated = await updateProfile(data);
    res.json(updated);
  })
);

export default router;
