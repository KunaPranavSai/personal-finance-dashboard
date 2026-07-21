import { Router, Request, Response } from "express";
import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middleware/validate";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { fetchAllExportData } from "../services/export";
import { getProvider, isProviderConfigured } from "../services/backup/registry";

const router = Router();

// In-memory OAuth state store (short-lived, single-use nonces tying the
// callback back to the user who started the connect flow). Fine for a
// single-instance deployment; would move to Redis for multi-instance.
const pendingStates = new Map<string, { userId: string; expiresAt: number }>();

function cleanupStates() {
  const now = Date.now();
  for (const [key, val] of pendingStates) if (val.expiresAt < now) pendingStates.delete(key);
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
      await prisma.backupConnection.upsert({
        where: { userId_provider: { userId: pending.userId, provider: "google_drive" } },
        create: {
          userId: pending.userId,
          provider: "google_drive",
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          accountEmail: tokens.accountEmail,
        },
        update: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken ?? undefined,
          tokenExpiresAt: tokens.expiresAt,
          accountEmail: tokens.accountEmail,
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

async function getValidAccessToken(userId: string) {
  const connection = await prisma.backupConnection.findUnique({
    where: { userId_provider: { userId, provider: "google_drive" } },
  });
  if (!connection) throw new ApiError(400, "Google Drive is not connected yet.");

  if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() < Date.now() + 60000) {
    if (!connection.refreshToken) throw new ApiError(401, "Google Drive session expired. Please reconnect.");
    const provider = getProvider("google_drive")!;
    const refreshed = await provider.refreshAccessToken(connection.refreshToken);
    await prisma.backupConnection.update({
      where: { id: connection.id },
      data: { accessToken: refreshed.accessToken, tokenExpiresAt: refreshed.expiresAt },
    });
    return { accessToken: refreshed.accessToken, connection };
  }
  return { accessToken: connection.accessToken, connection };
}

router.post(
  "/now",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const { accessToken } = await getValidAccessToken(userId);
    const provider = getProvider("google_drive")!;

    const data = await fetchAllExportData(userId);
    const snapshot = JSON.stringify({ version: 1, createdAt: new Date().toISOString(), data });

    const fileId = await provider.uploadBackup(accessToken, "penny-pilot-backup.json", snapshot);
    await prisma.backupConnection.update({
      where: { userId_provider: { userId, provider: "google_drive" } },
      data: { lastBackupAt: new Date(), lastBackupFileId: fileId },
    });

    res.json({ ok: true, backedUpAt: new Date().toISOString() });
  })
);

router.get(
  "/preview-restore",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const { accessToken, connection } = await getValidAccessToken(userId);
    if (!connection.lastBackupFileId) throw new ApiError(404, "No backup found in Google Drive yet.");

    const provider = getProvider("google_drive")!;
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
  validateBody(z.object({ confirm: z.literal(true) })),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const { accessToken, connection } = await getValidAccessToken(userId);
    if (!connection.lastBackupFileId) throw new ApiError(404, "No backup found in Google Drive yet.");

    const provider = getProvider("google_drive")!;
    const raw = await provider.downloadBackup(accessToken, connection.lastBackupFileId);
    const parsed = JSON.parse(raw);
    const backup = parsed.data as {
      categories?: { name: string; type: "INCOME" | "EXPENSE" }[];
      accounts?: { name: string }[];
    };

    // Conservative, additive restore: only re-creates master data that's
    // missing (categories/wallets), skipping anything that already exists by
    // name. Transactions/investments/etc. are available via preview-restore
    // for manual review rather than blind-inserted, since this database is
    // shared with the live app and duplicate financial records would be
    // worse than a partial restore.
    let categoriesRestored = 0;
    let accountsRestored = 0;

    for (const c of backup.categories ?? []) {
      const created = await prisma.category.upsert({
        where: { userId_name: { userId, name: c.name } },
        create: { userId, name: c.name, type: c.type },
        update: {},
      });
      if (created) categoriesRestored += 1;
    }
    for (const a of backup.accounts ?? []) {
      await prisma.account.upsert({
        where: { userId_name: { userId, name: a.name } },
        create: { userId, name: a.name },
        update: {},
      });
      accountsRestored += 1;
    }

    res.json({ ok: true, categoriesRestored, accountsRestored });
  })
);

export default router;
