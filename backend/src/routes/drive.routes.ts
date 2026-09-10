import { Router, Request, Response } from "express";
import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middleware/validate";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { encryptSecret } from "../lib/crypto";
import { logActivity } from "../lib/activityLog";
import {
  isGoogleDriveConfigured,
  getAuthUrl,
  exchangeCode,
  getOrCreatePennyPilotFolders,
  findExistingPennyPilotRoot,
  findOrCreateFolder,
  ROOT_FOLDER_NAME,
} from "../services/drive/googleDriveClient";
import { requireConnection, DRIVE_PROVIDER } from "../services/drive/connection";
import { setupWorkspace, hasLegacyPostgresData } from "../services/drive/init";
import {
  verifyStorage,
  invalidateAllCachesForUser,
  listCollectionRevisions,
  previewCollectionRevision,
  restoreCollectionFromRevision,
} from "../services/drive/dataService";
import { COLLECTIONS, CollectionName } from "../services/drive/types";
import { requireRecent2FA } from "../middleware/auth";

function isCollectionName(value: string): value is CollectionName {
  return (COLLECTIONS as readonly string[]).includes(value);
}

const router = Router();

// In-memory OAuth state store (short-lived, single-use nonces tying the callback back to the
// user who started the connect flow). Single-instance-only, matching the existing pattern this
// codebase already relies on elsewhere.
const pendingStates = new Map<string, { userId: string; expiresAt: number }>();
function cleanupStates() {
  const now = Date.now();
  for (const [key, val] of pendingStates) if (val.expiresAt < now) pendingStates.delete(key);
}

// Short-lived record of an unresolved "you connected a different Google account" choice, so
// POST /resolve-account-change knows what to do without trusting client-supplied folder ids.
const pendingAccountChanges = new Map<string, { userId: string; accessToken: string; accountEmail: string | null; existingRootId: string; expiresAt: number }>();
function cleanupPendingAccountChanges() {
  const now = Date.now();
  for (const [key, val] of pendingAccountChanges) if (val.expiresAt < now) pendingAccountChanges.delete(key);
}

function redirectBase(): string {
  const appUrl = (process.env.APP_URL || process.env.FRONTEND_URL || "").split(",")[0]?.trim();
  // Mirrors app.ts's CORS allowlist fallback: in dev, if no APP_URL/FRONTEND_URL is configured,
  // the frontend is always localhost:3000. This response is served BY the backend, so a bare
  // relative path would (incorrectly) redirect within the backend's own origin.
  const base = appUrl || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  return `${base}/connect-drive`;
}

router.get(
  "/status",
  asyncHandler(async (req: Request, res: Response) => {
    const [connection, hasLegacyData] = await Promise.all([
      prisma.backupConnection.findUnique({
        where: { userId_provider: { userId: req.auth!.userId, provider: DRIVE_PROVIDER } },
      }),
      hasLegacyPostgresData(req.auth!.userId),
    ]);
    res.json({
      configured: isGoogleDriveConfigured(),
      connected: Boolean(connection),
      initialized: Boolean(connection?.backupFolderId),
      accountEmail: connection?.accountEmail ?? null,
      // Lets the frontend show "migrate your existing data" messaging before the user even
      // connects, for accounts created back when Postgres (not Drive) held financial data.
      hasLegacyData,
    });
  })
);

router.get(
  "/connect",
  asyncHandler(async (req: Request, res: Response) => {
    if (!isGoogleDriveConfigured()) {
      throw new ApiError(503, "Google Drive is not configured on this server yet.");
    }
    cleanupStates();
    const state = crypto.randomBytes(24).toString("hex");
    pendingStates.set(state, { userId: req.auth!.userId, expiresAt: Date.now() + 10 * 60 * 1000 });
    res.json({ authUrl: getAuthUrl(state) });
  })
);

router.get(
  "/callback",
  asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.query as { code?: string; state?: string };
    const base = redirectBase();

    if (!code || !state) {
      res.redirect(`${base}?driveError=missing_code`);
      return;
    }
    const pending = pendingStates.get(state);
    pendingStates.delete(state);
    if (!pending || pending.expiresAt < Date.now()) {
      res.redirect(`${base}?driveError=expired_state`);
      return;
    }

    try {
      const tokens = await exchangeCode(code);
      const priorConnection = await prisma.backupConnection.findUnique({
        where: { userId_provider: { userId: pending.userId, provider: DRIVE_PROVIDER } },
      });
      const accountChanged = Boolean(priorConnection?.accountEmail && tokens.accountEmail && priorConnection.accountEmail !== tokens.accountEmail);

      // Tokens are always saved to this user's own row — this can never touch another
      // Penny Pilot user's connection or any shared credential.
      await prisma.backupConnection.upsert({
        where: { userId_provider: { userId: pending.userId, provider: DRIVE_PROVIDER } },
        create: {
          userId: pending.userId,
          provider: DRIVE_PROVIDER,
          accessToken: encryptSecret(tokens.accessToken),
          refreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
          tokenExpiresAt: tokens.expiresAt,
          accountEmail: tokens.accountEmail,
        },
        update: {
          accessToken: encryptSecret(tokens.accessToken),
          refreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : undefined,
          tokenExpiresAt: tokens.expiresAt,
          accountEmail: tokens.accountEmail,
          // Cleared until initialization (below, or the account-change resolution endpoint)
          // completes — this is exactly what keeps requireDriveConnected blocking access to a
          // half-finished account switch.
          ...(accountChanged && { backupFolderId: null }),
        },
      });
      invalidateAllCachesForUser(pending.userId);
      void logActivity(req, "drive_connected", `Connected Google Drive (${tokens.accountEmail ?? "unknown account"})`, pending.userId);

      if (accountChanged) {
        // Never auto-merge or silently reuse a different Google account's data — find out
        // whether this "new" account already has a Penny Pilot workspace in it (e.g. it was
        // used before, possibly by a different Penny Pilot account) and let the user decide.
        const existingRootId = await findExistingPennyPilotRoot(tokens.accessToken);
        if (existingRootId) {
          cleanupPendingAccountChanges();
          const choiceToken = crypto.randomBytes(24).toString("hex");
          pendingAccountChanges.set(choiceToken, {
            userId: pending.userId,
            accessToken: tokens.accessToken,
            accountEmail: tokens.accountEmail ?? null,
            existingRootId,
            expiresAt: Date.now() + 10 * 60 * 1000,
          });
          res.redirect(`${base}?accountChanged=1&choiceToken=${choiceToken}`);
          return;
        }
        // No prior Penny Pilot data in this account — safe to initialize fresh automatically.
      }

      // `backupFolderId` is what requireDriveConnected/isDriveReady treat as "Drive is ready" —
      // it's deliberately only persisted AFTER setupWorkspace succeeds (which itself verifies
      // the written data before returning), never before. That ordering is what prevents a
      // user from ever being routed to the dashboard against a workspace that a transient
      // failure left only partially set up: if setupWorkspace throws, this connection stays
      // "connected" (tokens saved) but not "initialized", so the mandatory-onboarding gate
      // keeps showing the migrate/connect screen — with a safe, idempotent retry — instead of
      // ever letting the app render against incomplete data.
      const folders = await getOrCreatePennyPilotFolders(tokens.accessToken);
      const result = await setupWorkspace(pending.userId, tokens.accessToken, folders.rootId, tokens.accountEmail ?? null);
      await prisma.backupConnection.update({
        where: { userId_provider: { userId: pending.userId, provider: DRIVE_PROVIDER } },
        data: { backupFolderId: folders.rootId },
      });
      invalidateAllCachesForUser(pending.userId);
      res.redirect(`${base}?driveConnected=1&migrated=${result.migrated ? "1" : "0"}`);
    } catch (err) {
      console.error("Google Drive connect failed:", err);
      res.redirect(`${base}?driveError=connect_failed`);
    }
  })
);

router.post(
  "/resolve-account-change",
  validateBody(z.object({ choiceToken: z.string().min(1), choice: z.enum(["use_existing", "start_fresh"]) })),
  asyncHandler(async (req: Request, res: Response) => {
    const { choiceToken, choice } = req.body as { choiceToken: string; choice: "use_existing" | "start_fresh" };
    const pending = pendingAccountChanges.get(choiceToken);
    pendingAccountChanges.delete(choiceToken);
    if (!pending || pending.expiresAt < Date.now() || pending.userId !== req.auth!.userId) {
      throw new ApiError(400, "This choice has expired. Please reconnect Google Drive.");
    }

    let rootId: string;
    if (choice === "use_existing") {
      rootId = pending.existingRootId;
    } else {
      // Can't reuse the exact "Penny Pilot" name — it's already taken by the data the user
      // chose NOT to use — so start a distinctly-named, genuinely empty workspace instead.
      rootId = await findOrCreateFolder(pending.accessToken, `${ROOT_FOLDER_NAME} (${new Date().toISOString().slice(0, 10)})`);
    }

    // Same ordering as the /callback flow: only mark this connection "initialized" once
    // setupWorkspace has actually verified the workspace, never before.
    const result = await setupWorkspace(pending.userId, pending.accessToken, rootId, pending.accountEmail);
    await prisma.backupConnection.update({
      where: { userId_provider: { userId: pending.userId, provider: DRIVE_PROVIDER } },
      data: { backupFolderId: rootId },
    });
    invalidateAllCachesForUser(pending.userId);
    void logActivity(req, "drive_account_change_resolved", `Resolved account change: ${choice}`, pending.userId);
    res.json({ ok: true, migrated: result.migrated, counts: result.counts });
  })
);

router.delete(
  "/disconnect",
  requireRecent2FA,
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.backupConnection.deleteMany({ where: { userId: req.auth!.userId, provider: DRIVE_PROVIDER } });
    invalidateAllCachesForUser(req.auth!.userId);
    void logActivity(req, "drive_disconnected", "Disconnected Google Drive", req.auth!.userId);
    res.json({ ok: true });
  })
);

router.post(
  "/verify",
  asyncHandler(async (req: Request, res: Response) => {
    await requireConnection(req.auth!.userId);
    const result = await verifyStorage(req.auth!.userId);
    res.json(result);
  })
);

// ─── Restore ──────────────────────────────────────────────────────────────────
// Restoring means reverting one data collection to an earlier point in its own Drive
// revision history — Drive already keeps every previous version of a file it overwrites, so
// this needs no separate backup-snapshot system, and nothing is ever destroyed: restoring
// itself just writes yet another new revision on top.

router.get(
  "/restore/:collection/revisions",
  asyncHandler(async (req: Request, res: Response) => {
    const collection = String(req.params.collection);
    if (!isCollectionName(collection)) throw new ApiError(400, "Unknown data collection.");
    await requireConnection(req.auth!.userId);
    const revisions = await listCollectionRevisions(req.auth!.userId, collection);
    res.json({ items: revisions });
  })
);

router.get(
  "/restore/:collection/preview",
  asyncHandler(async (req: Request, res: Response) => {
    const collection = String(req.params.collection);
    const revisionId = String(req.query.revisionId ?? "");
    if (!isCollectionName(collection)) throw new ApiError(400, "Unknown data collection.");
    if (!revisionId) throw new ApiError(400, "revisionId is required.");
    await requireConnection(req.auth!.userId);
    const file = await previewCollectionRevision(req.auth!.userId, collection, revisionId);
    res.json({ recordCount: file.records.length, lastUpdated: file.lastUpdated, schemaVersion: file.schemaVersion });
  })
);

router.post(
  "/restore/:collection",
  requireRecent2FA,
  validateBody(z.object({ revisionId: z.string().min(1), confirm: z.literal(true) })),
  asyncHandler(async (req: Request, res: Response) => {
    const collection = String(req.params.collection);
    if (!isCollectionName(collection)) throw new ApiError(400, "Unknown data collection.");
    const { revisionId } = req.body as { revisionId: string };
    await requireConnection(req.auth!.userId);
    const file = await restoreCollectionFromRevision(req.auth!.userId, collection, revisionId);
    void logActivity(req, "drive_data_restored", `Restored ${collection} to a previous version (${file.records.length} records)`, req.auth!.userId);
    res.json({ ok: true, recordCount: file.records.length });
  })
);

export default router;
