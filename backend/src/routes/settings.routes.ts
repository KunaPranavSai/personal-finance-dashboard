import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { getRecord, upsertRecordWithId } from "../services/drive/dataService";
import { DriveRecord } from "../services/drive/types";

const SETTINGS_RECORD_ID = "app_settings";

const defaultSettings = {
  applicationName: "Penny Pilot",
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

interface SettingsRecord extends DriveRecord {
  [key: string]: unknown;
}

/** Financial/application preferences live in the user's own Google Drive — admin accounts
 * don't have a personal financial workspace, so their settings stay Postgres-backed. */
async function getOrCreateSettings(userId: string, isAdmin: boolean): Promise<Record<string, unknown>> {
  if (isAdmin) {
    let row = await prisma.appSettings.findUnique({ where: { userId } });
    if (!row) row = await prisma.appSettings.create({ data: { userId, data: defaultSettings as object } });
    const data = row.data as Record<string, unknown>;
    if (!data.dateFormat || Object.keys(data).length === 0) return defaultSettings as unknown as Record<string, unknown>;
    return deepMerge(defaultSettings as unknown as Record<string, unknown>, data);
  }
  const record = await getRecord<SettingsRecord>(userId, "settings", SETTINGS_RECORD_ID);
  if (!record) return defaultSettings as unknown as Record<string, unknown>;
  return deepMerge(defaultSettings as unknown as Record<string, unknown>, record);
}

async function updateSettings(userId: string, isAdmin: boolean, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const current = await getOrCreateSettings(userId, isAdmin);
  const merged = deepMerge(current, data);
  if (isAdmin) {
    await prisma.appSettings.upsert({ where: { userId }, update: { data: merged as object }, create: { userId, data: merged as object } });
  } else {
    await upsertRecordWithId(userId, "settings", SETTINGS_RECORD_ID, merged);
  }
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
  asyncHandler(async (req, res) => {
    const settings = await getOrCreateSettings(req.auth!.userId, req.auth!.role !== "USER");
    res.json(stripInternal(settings));
  })
);

router.patch(
  "/",
  asyncHandler(async (req, res) => {
    const data = updateSettingsSchema.parse(req.body);
    const updated = await updateSettings(req.auth!.userId, req.auth!.role !== "USER", data);
    res.json(stripInternal(updated));
  })
);

export default router;
