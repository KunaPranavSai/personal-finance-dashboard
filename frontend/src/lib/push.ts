"use client";

import { api } from "./api";
import { isIos, isPwaInstalled } from "./pwaInstall";

/**
 * Web Push client. Every step that needs the user's consent (the permission prompt) runs only from an
 * explicit click on "Turn on notifications"; nothing here asks on page load.
 *
 * Device identity: the push endpoint URL is the device handle. Which user owns it is decided by the
 * server (it moves to whoever registers it). To stop a previous account's pushes from appearing after a
 * user switch on a shared device, the service worker compares each payload's user tag to the tag we store
 * in Cache Storage here (IDENTITY_CACHE) and drops mismatches.
 */
export const IDENTITY_CACHE = "pp-push-identity";
const IDENTITY_KEY = "/__pp_push_uid";

export type PushCategories = { security?: boolean; backup?: boolean; bills?: boolean };

export type PushSupport =
  | { ok: true }
  | { ok: false; reason: "insecure" | "no-service-worker" | "no-push" | "ios-needs-install" | "server-off" };

export const supportMessage: Record<Exclude<PushSupport, { ok: true }>["reason"], string> = {
  insecure: "Notifications need a secure (https) connection.",
  "no-service-worker": "This browser can't run the background worker notifications need.",
  "no-push": "This browser doesn't support push notifications. Try Chrome, Edge, Firefox or Safari 16.4+.",
  "ios-needs-install": "On iPhone and iPad, notifications only work from the installed app: tap Share, then “Add to Home Screen”, and open Penny Pilot from there.",
  "server-off": "Push notifications aren't set up on this server yet.",
};

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return { ok: false, reason: "no-push" };
  if (!window.isSecureContext) return { ok: false, reason: "insecure" };
  if (!("serviceWorker" in navigator)) return { ok: false, reason: "no-service-worker" };
  if (isIos() && !isPwaInstalled()) return { ok: false, reason: "ios-needs-install" };
  if (!("PushManager" in window) || !("Notification" in window)) return { ok: false, reason: "no-push" };
  return { ok: true };
}

export function urlBase64ToUint8Array(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("The background worker isn't ready yet. Reload the page and try again.")), 8000)),
  ]);
  return reg;
}

async function setIdentity(tag: string | null) {
  try {
    const cache = await caches.open(IDENTITY_CACHE);
    if (tag) await cache.put(IDENTITY_KEY, new Response(tag));
    else await cache.delete(IDENTITY_KEY);
  } catch {
    /* Cache Storage unavailable: the SW then treats pushes as unverified and drops identity-tagged ones */
  }
}

interface Config { configured: boolean; publicKey: string | null; uidTag: string }
const getConfig = () => api.get<Config>("/api/push/config");

const keyOf = (sub: PushSubscription, name: "p256dh" | "auth") => {
  const buf = sub.getKey(name);
  return buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";
};

export type PushState = {
  support: PushSupport;
  permission: NotificationPermission | "unsupported";
  /** this device is registered for the signed-in user (confirmed by the server) */
  subscribed: boolean;
  categories: PushCategories;
};

export async function readPushState(): Promise<PushState> {
  const support = pushSupport();
  if (!support.ok) return { support, permission: "unsupported", subscribed: false, categories: {} };
  const permission = Notification.permission;
  try {
    const cfg = await getConfig();
    if (!cfg.configured) return { support: { ok: false, reason: "server-off" }, permission, subscribed: false, categories: {} };
    const sub = await (await registration()).pushManager.getSubscription();
    if (!sub) return { support, permission, subscribed: false, categories: {} };
    const st = await api.post<{ subscribed: boolean; categories: PushCategories }>("/api/push/status", { endpoint: sub.endpoint });
    return { support, permission, subscribed: st.subscribed, categories: st.categories };
  } catch {
    return { support, permission, subscribed: false, categories: {} };
  }
}

/** Must be called from a click handler. Throws an Error with a user-readable message on failure. */
export async function enablePush(categories: PushCategories = {}): Promise<void> {
  const support = pushSupport();
  if (!support.ok) throw new Error(supportMessage[support.reason]);
  const cfg = await getConfig();
  if (!cfg.configured || !cfg.publicKey) throw new Error(supportMessage["server-off"]);

  const permission = await Notification.requestPermission();
  if (permission === "denied") throw new Error("Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.");
  if (permission !== "granted") throw new Error("Notification permission wasn't granted.");

  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) as BufferSource }));
  try {
    await api.post("/api/push/subscribe", { endpoint: sub.endpoint, keys: { p256dh: keyOf(sub, "p256dh"), auth: keyOf(sub, "auth") }, userAgent: navigator.userAgent.slice(0, 300), categories });
  } catch (err) {
    await sub.unsubscribe().catch(() => {}); // don't leave a device the server doesn't know about
    throw err;
  }
  await setIdentity(cfg.uidTag);
}

export async function disablePush(): Promise<void> {
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api.delete("/api/push/subscribe", { endpoint: sub.endpoint }); // server first: if this fails the device stays registered and the UI says so
    await sub.unsubscribe().catch(() => {});
  }
}

export async function updatePushCategories(categories: PushCategories): Promise<PushCategories> {
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) throw new Error("Turn on notifications on this device first.");
  return (await api.patch<{ categories: PushCategories }>("/api/push/preferences", { endpoint: sub.endpoint, categories })).categories;
}

/** Real push to this user's own devices. "accepted" = the push service took it, not proof it arrived. */
export const sendTestPush = () => api.post<{ accepted: number; failed: number; removed: number }>("/api/push/test");

/** After sign-in: record who this browser belongs to for the service worker, and if the device was registered
 * to a different account (shared device), stop it from receiving that account's notifications. */
export async function syncPushIdentity(): Promise<void> {
  if (!pushSupport().ok) return;
  try {
    const cfg = await getConfig();
    if (!cfg.configured) return;
    await setIdentity(cfg.uidTag);
    const sub = await (await registration()).pushManager.getSubscription();
    if (!sub) return;
    const st = await api.post<{ subscribed: boolean }>("/api/push/status", { endpoint: sub.endpoint });
    if (!st.subscribed) await sub.unsubscribe().catch(() => {}); // belonged to someone else: this user must opt in themselves
  } catch {
    /* best effort; the service worker's identity check is the backstop */
  }
}

/** Before logout (still authenticated): remove this device from the account and forget the identity. */
export async function forgetPushDevice(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await Promise.race([navigator.serviceWorker.getRegistration(), new Promise<undefined>((r) => setTimeout(() => r(undefined), 1500))]);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await Promise.race([api.delete("/api/push/subscribe", { endpoint: sub.endpoint }), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } finally {
    await setIdentity(null);
  }
}
