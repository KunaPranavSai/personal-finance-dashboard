import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";

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
    res.json({ supportEmail: settings?.supportEmail || null });
  })
);

export default router;
