import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { z } from "zod";

const defaultSettings = {
  applicationName: "Finance Dashboard Pro",
  defaultDashboard: "dashboard",
  startupPreferences: "last-viewed",
  dateFormat: "DD-MM-YYYY",
  weekStartsOn: "monday",
  timeFormat: "24h",
  currency: "INR",
  currencySymbol: "INR",
  numberFormat: "1,234.56",
  theme: "light",
  language: "en",
  timezone: "Asia/Kolkata",
  firstDayOfWeek: "monday",
  notifications: {
    email: true,
    push: true,
    budgetAlerts: true,
    billReminders: true,
    goalUpdates: true,
    insights: true,
    reminderFrequency: "daily",
  },
  security: {
    twoFactorEnabled: false,
    sessionTimeout: 30,
    autoLock: 15,
    changePassword: false,
  },
  export: {
    defaultFormat: "csv",
    includeAttachments: false,
  },
  backup: {
    autoBackup: false,
    backupFrequency: "weekly",
  },
  privacy: {
    shareAnonymousData: true,
    showInSuggestions: false,
    analytics: true,
    crashReporting: true,
    tracking: true,
  },
  preferences: {
    compactMode: false,
    showTips: true,
    confirmBeforeDelete: true,
    defaultTransactionType: "EXPENSE",
    defaultCharts: "income-expense",
    defaultFilters: "all",
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

async function getOrCreateSettings(): Promise<Record<string, unknown>> {
  let row = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!row) {
    row = await prisma.appSettings.create({
      data: { id: "singleton", data: defaultSettings as object },
    });
  }
  const data = row.data as Record<string, unknown>;
  if (!data.dateFormat || Object.keys(data).length === 0) {
    return defaultSettings as unknown as Record<string, unknown>;
  }
  return deepMerge(defaultSettings as unknown as Record<string, unknown>, data);
}

async function updateSettings(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const current = await getOrCreateSettings();
  const merged = deepMerge(current, data);
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: { data: merged as object },
    create: { id: "singleton", data: merged as object },
  });
  return merged;
}

const updateSettingsSchema = z.object({}).passthrough();

/** Strip internal (double-underscore-prefixed) fields such as password hashes and 2FA secrets before returning settings to the client. */
function stripInternal(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("__")) continue;
    result[key] = value;
  }
  return result;
}

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const settings = await getOrCreateSettings();
    res.json(stripInternal(settings));
  })
);

router.patch(
  "/",
  asyncHandler(async (req, res) => {
    const data = updateSettingsSchema.parse(req.body);
    const updated = await updateSettings(data);
    res.json(stripInternal(updated));
  })
);

export default router;
