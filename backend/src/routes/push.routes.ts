import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { pushConfigured, sendPushToUser, userTag, vapidPublicKey } from "../services/push";

/**
 * /api/push (authenticated, not Drive-gated: security alerts work for every account type).
 * Every query below is scoped to req.auth.userId, so a user can only register, read, change or remove
 * their own devices. The endpoint URL is only ever used as a lookup key together with the user id.
 */
const router = Router();

const MAX_DEVICES = 10;
const categoriesSchema = z.object({ security: z.boolean().optional(), backup: z.boolean().optional(), bills: z.boolean().optional() }).strict();
const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048).refine((u) => u.startsWith("https://"), "push endpoints are https"),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(128) }),
  userAgent: z.string().max(300).optional(),
  categories: categoriesSchema.optional(),
});
const endpointSchema = z.object({ endpoint: z.string().url().max(2048) });

router.get("/config", (req, res) => {
  res.json({ configured: pushConfigured(), publicKey: vapidPublicKey(), uidTag: userTag(req.auth!.userId) });
});

/** Is THIS device (endpoint) registered for THIS user, and with which categories? */
router.post(
  "/status",
  asyncHandler(async (req, res) => {
    const { endpoint } = endpointSchema.parse(req.body);
    const sub = await prisma.pushSubscription.findFirst({ where: { endpoint, userId: req.auth!.userId }, select: { categories: true } });
    res.json({ subscribed: Boolean(sub), categories: sub?.categories ?? {} });
  })
);

router.post(
  "/subscribe",
  asyncHandler(async (req, res) => {
    if (!pushConfigured()) throw new ApiError(503, "Push notifications are not configured on this server.", "PUSH_NOT_CONFIGURED");
    const userId = req.auth!.userId;
    const body = subscribeSchema.parse(req.body);
    // Re-registering an endpoint (same browser, new login) moves it to the current user: the device can
    // only ever belong to whoever is signed in on it.
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: { userId, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth, userAgent: body.userAgent, categories: body.categories ?? {} },
      update: { userId, p256dh: body.keys.p256dh, auth: body.keys.auth, userAgent: body.userAgent, failureCount: 0, ...(body.categories ? { categories: body.categories } : {}) },
      select: { id: true, categories: true },
    });
    // cap devices per user: drop the oldest beyond the limit
    const mine = await prisma.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true }, skip: MAX_DEVICES });
    if (mine.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: mine.map((m) => m.id) }, userId } });
    res.status(201).json({ subscribed: true, categories: sub.categories });
  })
);

router.patch(
  "/preferences",
  asyncHandler(async (req, res) => {
    const { endpoint, categories } = z.object({ endpoint: z.string().url(), categories: categoriesSchema }).parse(req.body);
    const sub = await prisma.pushSubscription.findFirst({ where: { endpoint, userId: req.auth!.userId }, select: { id: true, categories: true } });
    if (!sub) throw new ApiError(404, "This device is not registered for notifications.", "PUSH_NOT_SUBSCRIBED");
    const merged = { ...(sub.categories as Record<string, unknown>), ...categories };
    await prisma.pushSubscription.update({ where: { id: sub.id }, data: { categories: merged } });
    res.json({ categories: merged });
  })
);

router.delete(
  "/subscribe",
  asyncHandler(async (req, res) => {
    const { endpoint } = endpointSchema.parse(req.body);
    const r = await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.auth!.userId } });
    res.json({ removed: r.count });
  })
);

/** Sends one real push to the caller's own devices (the settings "Send test" button). */
const lastTest = new Map<string, number>();
router.post(
  "/test",
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const last = lastTest.get(userId) ?? 0;
    if (Date.now() - last < 10_000) throw new ApiError(429, "Please wait a few seconds before sending another test.", "RATE_LIMITED");
    lastTest.set(userId, Date.now());
    const r = await sendPushToUser(userId, { kind: "security", title: "Penny Pilot notifications are on", body: "This is a test. You'll get alerts like this on this device.", url: "/settings?tab=preferences", tag: "pp-test" }, { ignoreCategory: true });
    if (r.skipped === "not_configured") throw new ApiError(503, "Push notifications are not configured on this server.", "PUSH_NOT_CONFIGURED");
    if (r.skipped === "no_subscription") throw new ApiError(409, "Enable notifications on this device first.", "PUSH_NOT_SUBSCRIBED");
    // "accepted" = the push service took it; arrival on the device is not guaranteed
    res.json({ accepted: r.accepted, failed: r.failed, removed: r.removed });
  })
);

export default router;
