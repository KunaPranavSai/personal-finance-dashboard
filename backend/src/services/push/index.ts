import crypto from "node:crypto";
import webpush from "web-push";
import { prisma } from "../../lib/prisma";

/**
 * Web Push delivery (VAPID). Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https: URL).
 * Without them push is simply off (`pushConfigured()` false); nothing else in the app depends on it.
 *
 * A provider "accepted" response (HTTP 201 from the push service) means the push was queued for the
 * device. It does not mean the user saw it, so deliveries are recorded as "accepted", never "delivered".
 */
export type PushKind = "security" | "backup" | "bills";

export interface PushMessage {
  kind: PushKind;
  title: string;
  body: string;
  /** In-app path opened when the notification is tapped. Must be same-origin (starts with "/"). */
  url: string;
  /** Same tag = the OS replaces instead of stacking. */
  tag?: string;
  /** Claims (userId, dedupeKey) before sending; a second send with the same key is skipped. */
  dedupeKey?: string;
  urgency?: "high" | "normal";
}

export interface PushResult {
  accepted: number;
  failed: number;
  removed: number;
  skipped?: "not_configured" | "no_subscription" | "duplicate" | "category_off";
}

let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return (configured = false);
  try {
    webpush.setVapidDetails(subject, pub, priv);
    return (configured = true);
  } catch (err) {
    console.error("Web Push disabled: invalid VAPID configuration:", (err as Error).message);
    return (configured = false);
  }
}

export const vapidPublicKey = () => (pushConfigured() ? process.env.VAPID_PUBLIC_KEY! : null);

/** Opaque per-user tag put in every payload. The service worker compares it to the signed-in user so a push
 * for the previous account on a shared device is dropped instead of displayed. Not reversible to the user id. */
export const userTag = (userId: string) => crypto.createHash("sha256").update(`pp-push:${userId}`).digest("hex").slice(0, 16);

const RETRIES = 2; // 3 attempts total
const BACKOFF_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const _retry = { sleep }; // swapped in tests

type Sub = { id: string; endpoint: string; p256dh: string; auth: string; categories: unknown };

const categoryOn = (s: Sub, kind: PushKind) => (s.categories as Record<string, unknown> | null)?.[kind] !== false;

/** Sends to every device of a user that has this category enabled. Never throws. */
export async function sendPushToUser(userId: string, msg: PushMessage, opts: { ignoreCategory?: boolean } = {}): Promise<PushResult> {
  const result: PushResult = { accepted: 0, failed: 0, removed: 0 };
  if (!pushConfigured()) return { ...result, skipped: "not_configured" };
  if (!msg.url.startsWith("/")) throw new Error("push url must be an in-app path");

  try {
    const all = (await prisma.pushSubscription.findMany({ where: { userId }, select: { id: true, endpoint: true, p256dh: true, auth: true, categories: true } })) as Sub[];
    if (all.length === 0) return { ...result, skipped: "no_subscription" };
    const subs = opts.ignoreCategory ? all : all.filter((s) => categoryOn(s, msg.kind));
    if (subs.length === 0) return { ...result, skipped: "category_off" };

    let claimed = false;
    if (msg.dedupeKey) {
      try {
        await prisma.pushDelivery.create({ data: { userId, dedupeKey: msg.dedupeKey, kind: msg.kind } });
        claimed = true;
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") return { ...result, skipped: "duplicate" };
        throw err;
      }
    }

    const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: msg.tag, kind: msg.kind, ts: Date.now(), uid: userTag(userId) });
    let lastError: string | null = null;
    let attempts = 0;

    for (const sub of subs) {
      const out = await sendOne(sub, payload, msg.urgency ?? "normal");
      attempts += out.attempts;
      if (out.ok) {
        result.accepted++;
        await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastSuccessAt: new Date(), failureCount: 0 } }).catch(() => {});
      } else if (out.gone) {
        result.removed++;
        await prisma.pushSubscription.deleteMany({ where: { id: sub.id } }).catch(() => {});
      } else {
        result.failed++;
        lastError = out.error;
        await prisma.pushSubscription.update({ where: { id: sub.id }, data: { failureCount: { increment: 1 } } }).catch(() => {});
      }
    }

    if (claimed) {
      if (result.accepted > 0) {
        await prisma.pushDelivery.updateMany({ where: { userId, dedupeKey: msg.dedupeKey! }, data: { status: "accepted", attempts, lastError } }).catch(() => {});
      } else {
        // Nothing was accepted: release the claim so a later run can retry this reminder.
        await prisma.pushDelivery.deleteMany({ where: { userId, dedupeKey: msg.dedupeKey! } }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("Push send failed:", (err as Error).message); // message only: never the payload or subscription
  }
  return result;
}

async function sendOne(sub: Sub, payload: string, urgency: "high" | "normal"): Promise<{ ok: boolean; gone: boolean; error: string | null; attempts: number }> {
  let error: string | null = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 24 * 60 * 60, urgency });
      return { ok: true, gone: false, error: null, attempts: attempt + 1 };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return { ok: false, gone: true, error: `gone:${status}`, attempts: attempt + 1 }; // subscription expired / revoked
      error = status ? `http:${status}` : "network";
      const transient = !status || status === 429 || status >= 500;
      if (!transient || attempt === RETRIES) break; // 400/401/403 are config or payload problems: retrying cannot help
      await _retry.sleep(BACKOFF_MS * 2 ** attempt);
    }
  }
  return { ok: false, gone: false, error, attempts: RETRIES + 1 };
}
