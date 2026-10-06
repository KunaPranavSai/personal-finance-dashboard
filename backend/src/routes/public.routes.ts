import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { platformConfig } from "../lib/platformConfig";

const router = Router();

// ─── GET /api/public/settings ─────────────────────────────────────────────────
// Unauthenticated by design (mounted with no `authenticate` in app.ts, same as
// /api/auth and /api/voice-greeting) — the public landing page needs the
// Super Admin-configured support email before a user has ever logged in.
// Deliberately hand-picks only the one field that's safe to expose; never
// forwards the full PlatformSettings row (siteName, session-timeout policy,
// password-length policy, 2FA-enforcement flag are internal configuration).
router.get(
  "/settings",
  asyncHandler(async (_req: Request, res: Response) => {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "singleton" },
      select: { supportEmail: true },
    });
    const c = platformConfig();
    // The storage policy is public on purpose: the sign-up / storage-choice screens need it before a session exists.
    res.json({ supportEmail: settings?.supportEmail || null, storage: { drive: c.driveStorageEnabled, device: c.deviceStorageEnabled } });
  })
);

export default router;
