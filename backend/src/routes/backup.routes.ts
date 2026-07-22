import { Router, Request, Response } from "express";
import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middleware/validate";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { encryptSecret, decryptSecret } from "../lib/crypto";
import { fetchAllExportData } from "../services/export";
import { getProvider, isProviderConfigured } from "../services/backup/registry";
import { requireRecent2FA } from "../middleware/auth";
import type { BackupConnection, BudgetPeriod } from "@prisma/client";

const router = Router();

const RETENTION_LIMIT = 10; // max backup files kept per user in their own Drive
const HISTORY_LIMIT = 50; // max BackupHistory rows kept per connection
const MAX_ATTEMPTS = 3;

// In-memory OAuth state store (short-lived, single-use nonces tying the
// callback back to the user who started the connect flow). Fine for a
// single-instance deployment; would move to Redis for multi-instance.
const pendingStates = new Map<string, { userId: string; expiresAt: number }>();

function cleanupStates() {
  const now = Date.now();
  for (const [key, val] of pendingStates) if (val.expiresAt < now) pendingStates.delete(key);
}

function backupFilename(): string {
  const ds = new Date().toISOString().replace(/[:.]/g, "-");
  return `penny-pilot-backup-${ds}.json`;
}

router.get(
  "/status",
  asyncHandler(async (req: Request, res: Response) => {
    const connection = await prisma.backupConnection.findUnique({
      where: { userId_provider: { userId: req.auth!.userId, provider: "google_drive" } },
    });
    res.json({
      configured: isProviderConfigured("google_drive"),
      connected: Boolean(connection),
      accountEmail: connection?.accountEmail ?? null,
      lastBackupAt: connection?.lastBackupAt ?? null,
    });
  })
);

router.get(
  "/history",
  asyncHandler(async (req: Request, res: Response) => {
    const items = await prisma.backupHistory.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, status: true, errorMessage: true, attempt: true, triggeredBy: true, createdAt: true },
    });
    res.json({ items });
  })
);

router.get(
  "/connect",
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = (req.query.provider as string) || "google_drive";
    if (!isProviderConfigured(providerId)) {
      throw new ApiError(503, "Google Drive backup is not configured on this server yet.");
    }
    const provider = getProvider(providerId);
    if (!provider) throw new ApiError(400, "Unknown backup provider");

    cleanupStates();
    const state = crypto.randomBytes(24).toString("hex");
    pendingStates.set(state, { userId: req.auth!.userId, expiresAt: Date.now() + 10 * 60 * 1000 });

    // prompt=consent (set in the provider) ensures a fresh refresh token is
    // issued every time — this is also how a user "changes" their connected
    // Google account: connecting again simply overwrites their own row below.
    res.json({ authUrl: provider.getAuthUrl(state) });
  })
);

router.get(
  "/callback",
  asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.query as { code?: string; state?: string };
    const appUrl = (process.env.APP_URL || "").split(",")[0]?.trim() || "";
    const redirectBase = appUrl ? `${appUrl}/settings?tab=backup` : "/settings?tab=backup";

    if (!code || !state) {
      res.redirect(`${redirectBase}&backupError=missing_code`);
      return;
    }
    const pending = pendingStates.get(state);
    pendingStates.delete(state);
    if (!pending || pending.expiresAt < Date.now()) {
      res.redirect(`${redirectBase}&backupError=expired_state`);
      return;
    }

    try {
      const provider = getProvider("google_drive")!;
      const tokens = await provider.exchangeCode(code);
      // Each user's tokens are written only to THEIR OWN row (keyed by their
      // own userId), encrypted at rest — this can never touch another
      // user's connection or any shared/service-account credential.
      await prisma.backupConnection.upsert({
        where: { userId_provider: { userId: pending.userId, provider: "google_drive" } },
        create: {
          userId: pending.userId,
          provider: "google_drive",
          accessToken: encryptSecret(tokens.accessToken),
          refreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
          tokenExpiresAt: tokens.expiresAt,
          accountEmail: tokens.accountEmail,
          backupFolderId: null,
        },
        update: {
          accessToken: encryptSecret(tokens.accessToken),
          // Google only issues a refresh token on first consent / when
          // prompt=consent forces re-consent (always, here) — keep the new
          // one so reconnecting or switching Google accounts fully replaces it.
          refreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : undefined,
          tokenExpiresAt: tokens.expiresAt,
          accountEmail: tokens.accountEmail,
          backupFolderId: null, // re-resolve on next backup in case the account changed
        },
      });
      res.redirect(`${redirectBase}&backupConnected=1`);
    } catch (err) {
      console.error("Google Drive connect failed:", err);
      res.redirect(`${redirectBase}&backupError=connect_failed`);
    }
  })
);

router.delete(
  "/disconnect",
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.backupConnection.deleteMany({ where: { userId: req.auth!.userId, provider: "google_drive" } });
    res.json({ ok: true });
  })
);

/** Decrypts a connection's tokens and refreshes the access token if it's expired/near-expiry. */
async function getValidAccessToken(connection: BackupConnection): Promise<string> {
  const provider = getProvider("google_drive")!;
  const decryptedAccess = decryptSecret(connection.accessToken);

  if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() < Date.now() + 60000) {
    if (!connection.refreshToken) throw new ApiError(401, "Google Drive session expired. Please reconnect.");
    const refreshed = await provider.refreshAccessToken(decryptSecret(connection.refreshToken));
    await prisma.backupConnection.update({
      where: { id: connection.id },
      data: { accessToken: encryptSecret(refreshed.accessToken), tokenExpiresAt: refreshed.expiresAt },
    });
    return refreshed.accessToken;
  }
  return decryptedAccess;
}

async function loadConnection(userId: string): Promise<BackupConnection> {
  const connection = await prisma.backupConnection.findUnique({
    where: { userId_provider: { userId, provider: "google_drive" } },
  });
  if (!connection) throw new ApiError(400, "Google Drive is not connected yet.");
  return connection;
}

/** Runs one backup attempt for a single user's connection, with automatic retry and full history logging. */
async function performBackup(connection: BackupConnection, triggeredBy: "manual" | "scheduled"): Promise<void> {
  const provider = getProvider("google_drive")!;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const accessToken = await getValidAccessToken(connection);
      let folderId = connection.backupFolderId;
      if (!folderId) {
        folderId = await provider.getOrCreateBackupFolder(accessToken);
        await prisma.backupConnection.update({ where: { id: connection.id }, data: { backupFolderId: folderId } });
      }

      const data = await fetchAllExportData(connection.userId);
      const snapshot = JSON.stringify({ version: 1, createdAt: new Date().toISOString(), data });
      const fileId = await provider.uploadBackup(accessToken, folderId, backupFilename(), snapshot);

      await prisma.backupConnection.update({
        where: { id: connection.id },
        data: { lastBackupAt: new Date(), lastBackupFileId: fileId },
      });
      await prisma.backupHistory.create({
        data: { connectionId: connection.id, userId: connection.userId, status: "success", fileId, attempt, triggeredBy },
      });

      // Prune old snapshots beyond the retention limit, best-effort.
      try {
        const files = await provider.listBackups(accessToken, folderId);
        const toDelete = files.slice(RETENTION_LIMIT);
        for (const f of toDelete) await provider.deleteBackup(accessToken, f.id);
      } catch (pruneErr) {
        console.error("Backup pruning failed (non-fatal):", pruneErr);
      }

      // Trim old history rows beyond the retention limit, best-effort.
      const historyRows = await prisma.backupHistory.findMany({
        where: { connectionId: connection.id },
        orderBy: { createdAt: "desc" },
        skip: HISTORY_LIMIT,
        select: { id: true },
      });
      if (historyRows.length > 0) {
        await prisma.backupHistory.deleteMany({ where: { id: { in: historyRows.map((h) => h.id) } } });
      }

      return;
    } catch (err) {
      lastError = err;
      console.error(`Backup attempt ${attempt} failed for user ${connection.userId}:`, err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }
  }

  await prisma.backupHistory.create({
    data: {
      connectionId: connection.id,
      userId: connection.userId,
      status: "failed",
      attempt: MAX_ATTEMPTS,
      triggeredBy,
      errorMessage: lastError instanceof Error ? lastError.message : "Unknown error",
    },
  });
  throw lastError instanceof Error ? lastError : new Error("Backup failed");
}

router.post(
  "/now",
  requireRecent2FA,
  asyncHandler(async (req: Request, res: Response) => {
    const connection = await loadConnection(req.auth!.userId);
    try {
      await performBackup(connection, "manual");
      res.json({ ok: true, backedUpAt: new Date().toISOString() });
    } catch {
      throw new ApiError(500, "Backup failed after multiple attempts. Please try again shortly.");
    }
  })
);

router.get(
  "/preview-restore",
  asyncHandler(async (req: Request, res: Response) => {
    const connection = await loadConnection(req.auth!.userId);
    if (!connection.lastBackupFileId) throw new ApiError(404, "No backup found in Google Drive yet.");

    const provider = getProvider("google_drive")!;
    const accessToken = await getValidAccessToken(connection);
    const raw = await provider.downloadBackup(accessToken, connection.lastBackupFileId);
    const parsed = JSON.parse(raw);

    res.json({
      createdAt: parsed.createdAt,
      counts: {
        transactions: parsed.data?.transactions?.length ?? 0,
        budgets: parsed.data?.budgets?.length ?? 0,
        investments: parsed.data?.investments?.length ?? 0,
        bills: parsed.data?.bills?.length ?? 0,
        goals: parsed.data?.goals?.length ?? 0,
        categories: parsed.data?.categories?.length ?? 0,
        accounts: parsed.data?.accounts?.length ?? 0,
      },
    });
  })
);

router.post(
  "/restore",
  requireRecent2FA,
  validateBody(z.object({ confirm: z.literal(true) })),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const connection = await loadConnection(userId);
    if (!connection.lastBackupFileId) throw new ApiError(404, "No backup found in Google Drive yet.");

    const provider = getProvider("google_drive")!;
    const accessToken = await getValidAccessToken(connection);
    const raw = await provider.downloadBackup(accessToken, connection.lastBackupFileId);
    const parsed = JSON.parse(raw);
    const backup = parsed.data as {
      categories?: { name: string; type: "INCOME" | "EXPENSE" }[];
      accounts?: { name: string }[];
      paymentMethods?: { name: string }[];
      transactions?: {
        date: string; description: string; amount: number; type: "INCOME" | "EXPENSE";
        category?: { name: string } | null; account?: { name: string } | null; paymentMethod?: string | null;
        merchant?: string | null; notes?: string | null;
      }[];
      budgets?: { category?: { name: string } | null; period: string; periodKey: string; amount: number }[];
      investments?: {
        instrument: string; category: string; currentValue: number; investedAmount?: number;
        purchaseDate?: string; monthlyContribution: number; annualReturnPct: number; platform?: string | null; notes?: string | null;
      }[];
      settings?: Record<string, unknown> | null;
      profile?: Record<string, unknown> | null;
    };

    const result = {
      categoriesRestored: 0,
      accountsRestored: 0,
      paymentMethodsRestored: 0,
      transactionsRestored: 0,
      budgetsRestored: 0,
      investmentsRestored: 0,
      settingsRestored: false,
    };

    // 1) Master data first (categories, wallets, money sources) — additive
    // upserts by name, safe to run repeatedly without creating duplicates.
    const categoryIdByName = new Map<string, string>();
    for (const c of backup.categories ?? []) {
      const category = await prisma.category.upsert({
        where: { userId_name: { userId, name: c.name } },
        create: { userId, name: c.name, type: c.type },
        update: {},
      });
      categoryIdByName.set(c.name, category.id);
      result.categoriesRestored += 1;
    }

    const accountIdByName = new Map<string, string>();
    for (const a of backup.accounts ?? []) {
      const account = await prisma.account.upsert({
        where: { userId_name: { userId, name: a.name } },
        create: { userId, name: a.name },
        update: {},
      });
      accountIdByName.set(a.name, account.id);
      result.accountsRestored += 1;
    }

    const paymentMethodIdByName = new Map<string, string>();
    for (const pm of backup.paymentMethods ?? []) {
      const method = await prisma.paymentMethodType.upsert({
        where: { userId_name: { userId, name: pm.name } },
        create: { userId, name: pm.name },
        update: {},
      });
      paymentMethodIdByName.set(pm.name, method.id);
      result.paymentMethodsRestored += 1;
    }

    // 2) Expenses & income — de-duplicated against existing rows by
    // (date, description, amount, type) so re-running a restore never
    // creates doubled financial records.
    for (const t of backup.transactions ?? []) {
      const date = new Date(t.date);
      const exists = await prisma.transaction.findFirst({
        where: { userId, date, description: t.description, amount: t.amount, type: t.type },
        select: { id: true },
      });
      if (exists) continue;

      let categoryId = t.category ? categoryIdByName.get(t.category.name) : undefined;
      if (!categoryId && t.category) {
        const created = await prisma.category.upsert({
          where: { userId_name: { userId, name: t.category.name } },
          create: { userId, name: t.category.name, type: t.type },
          update: {},
        });
        categoryId = created.id;
        categoryIdByName.set(t.category.name, categoryId);
      }
      if (!categoryId) continue; // categoryId is required on Transaction — skip unrestorable rows rather than guessing

      const accountId = t.account ? accountIdByName.get(t.account.name) : undefined;
      const paymentMethodTypeId = t.paymentMethod ? paymentMethodIdByName.get(t.paymentMethod) : undefined;

      await prisma.transaction.create({
        data: {
          userId, date, description: t.description, amount: t.amount, type: t.type,
          categoryId, accountId, paymentMethodTypeId,
          merchant: t.merchant ?? null, notes: t.notes ?? null,
        },
      });
      result.transactionsRestored += 1;
    }

    // 3) Budgets — upserted on (categoryId, period, periodKey), the same
    // compound key this app already enforces as unique per budget.
    for (const b of backup.budgets ?? []) {
      const categoryId = b.category ? categoryIdByName.get(b.category.name) : undefined;
      if (!categoryId) continue;
      const period = b.period as BudgetPeriod;
      await prisma.budget.upsert({
        where: { categoryId_period_periodKey: { categoryId, period, periodKey: b.periodKey } },
        create: { userId, categoryId, period, periodKey: b.periodKey, amount: b.amount },
        update: {},
      });
      result.budgetsRestored += 1;
    }

    // 4) Investments — de-duplicated by (instrument, purchaseDate) since
    // there's no natural unique constraint on this model.
    for (const inv of backup.investments ?? []) {
      const purchaseDate = inv.purchaseDate ? new Date(inv.purchaseDate) : new Date();
      const exists = await prisma.investment.findFirst({
        where: { userId, instrument: inv.instrument, purchaseDate },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.investment.create({
        data: {
          userId,
          instrument: inv.instrument,
          category: inv.category,
          currentValue: inv.currentValue,
          investedAmount: inv.investedAmount ?? 0,
          purchaseDate,
          monthlyContribution: inv.monthlyContribution,
          annualReturnPct: inv.annualReturnPct,
          platform: inv.platform ?? null,
          notes: inv.notes ?? null,
        },
      });
      result.investmentsRestored += 1;
    }

    // 5) Settings & preferences — merged into (not overwriting) whatever
    // the user currently has, so a restore can't blow away changes made
    // since the backup was taken.
    if (backup.settings) {
      const existing = await prisma.appSettings.findUnique({ where: { userId } });
      const merged = { ...(backup.settings as object), ...((existing?.data as object) ?? {}) };
      await prisma.appSettings.upsert({
        where: { userId },
        create: { userId, data: merged },
        update: { data: merged },
      });
      result.settingsRestored = true;
    }

    res.json({ ok: true, ...result });
  })
);

const CRON_SECRET_HEADER = "x-cron-secret";

function isDue(frequency: string, lastBackupAt: Date | null): boolean {
  if (!lastBackupAt) return true;
  const daysSince = (Date.now() - lastBackupAt.getTime()) / (1000 * 60 * 60 * 24);
  if (frequency === "daily") return daysSince >= 1;
  if (frequency === "weekly") return daysSince >= 7;
  if (frequency === "monthly") return daysSince >= 30;
  return false;
}

/**
 * Intended to be invoked by an external scheduler (e.g. a Render Cron Job
 * hitting this endpoint once a day) rather than running its own timer inside
 * the web process. Safe to call more often than needed — `isDue` makes it a
 * no-op for users who aren't due yet, so nothing double-backs-up.
 */
router.post(
  "/run-scheduled",
  asyncHandler(async (req: Request, res: Response) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new ApiError(503, "Scheduled backups are not configured (CRON_SECRET is unset).");
    if (req.headers[CRON_SECRET_HEADER] !== secret) {
      throw new ApiError(401, "Invalid cron secret");
    }

    const connections = await prisma.backupConnection.findMany({ where: { provider: "google_drive" } });
    const results = { attempted: 0, succeeded: 0, failed: 0, skipped: 0 };

    await Promise.allSettled(
      connections.map(async (connection) => {
        const settings = await prisma.appSettings.findUnique({ where: { userId: connection.userId } });
        const backupSettings = (settings?.data as { backup?: { autoBackup?: boolean; backupFrequency?: string } })?.backup;
        if (!backupSettings?.autoBackup) {
          results.skipped += 1;
          return;
        }
        const frequency = backupSettings.backupFrequency || "weekly";
        if (!isDue(frequency, connection.lastBackupAt)) {
          results.skipped += 1;
          return;
        }
        results.attempted += 1;
        try {
          await performBackup(connection, "scheduled");
          results.succeeded += 1;
        } catch {
          results.failed += 1;
        }
      })
    );

    res.json(results);
  })
);

export default router;
