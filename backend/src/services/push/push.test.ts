import { beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock("web-push", () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a), setVapidDetails: (...a: unknown[]) => setVapidDetails(...a) } }));

const db = {
  pushSubscription: { findMany: vi.fn(), update: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({ count: 1 })) },
  pushDelivery: { create: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({})) },
};
vi.mock("../../lib/prisma", () => ({ prisma: db }));

const sub = (id: string, categories: object = {}) => ({ id, endpoint: `https://push.example/${id}`, p256dh: "p", auth: "a", categories });
const msg = { kind: "security" as const, title: "New sign-in", body: "A new sign-in", url: "/settings?tab=security" };

async function load(configured = true) {
  vi.resetModules();
  if (configured) Object.assign(process.env, { VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:x@y.z" });
  else for (const k of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]) delete process.env[k];
  const m = await import("./index");
  vi.spyOn(m._retry, "sleep").mockResolvedValue(undefined);
  return m;
}

beforeEach(() => {
  vi.clearAllMocks();
  sendNotification.mockResolvedValue({ statusCode: 201 });
});

describe("push delivery", () => {
  it("does nothing (and never throws) when VAPID is not configured", async () => {
    const { sendPushToUser } = await load(false);
    expect(await sendPushToUser("u1", msg)).toMatchObject({ skipped: "not_configured", accepted: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
    expect(db.pushSubscription.findMany).not.toHaveBeenCalled();
  });

  it("targets only the given user's devices", async () => {
    const { sendPushToUser } = await load();
    db.pushSubscription.findMany.mockResolvedValue([sub("d1")]);
    await sendPushToUser("alice", msg);
    expect(db.pushSubscription.findMany.mock.calls[0][0].where).toEqual({ userId: "alice" });
  });

  it("sends to every device of the user and reports 'accepted', not 'delivered'", async () => {
    const { sendPushToUser } = await load();
    db.pushSubscription.findMany.mockResolvedValue([sub("phone"), sub("laptop")]);
    const r = await sendPushToUser("u1", msg);
    expect(r).toMatchObject({ accepted: 2, failed: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(sendNotification.mock.calls[0][1]);
    expect(payload).toMatchObject({ title: "New sign-in", url: "/settings?tab=security", kind: "security" });
    expect(payload.uid).toHaveLength(16); // identity tag, not the user id
    expect(JSON.stringify(payload)).not.toContain("u1");
    expect(db.pushSubscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failureCount: 0 }) }));
  });

  it("respects the per-device category preference", async () => {
    const { sendPushToUser } = await load();
    db.pushSubscription.findMany.mockResolvedValue([sub("off", { bills: false }), sub("on", { bills: true })]);
    const r = await sendPushToUser("u1", { ...msg, kind: "bills" });
    expect(r.accepted).toBe(1);
    expect(sendNotification.mock.calls[0][0].endpoint).toContain("/on");
    db.pushSubscription.findMany.mockResolvedValue([sub("off", { bills: false })]);
    expect(await sendPushToUser("u1", { ...msg, kind: "bills" })).toMatchObject({ skipped: "category_off" });
  });

  it("removes a subscription the push service reports gone (410) and does not retry it", async () => {
    const { sendPushToUser } = await load();
    db.pushSubscription.findMany.mockResolvedValue([sub("dead")]);
    sendNotification.mockRejectedValue({ statusCode: 410 });
    const r = await sendPushToUser("u1", msg);
    expect(r).toMatchObject({ removed: 1, accepted: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: "dead" } });
  });

  it("retries transient provider failures (5xx) up to 3 attempts, then records a failure and keeps the device", async () => {
    const { sendPushToUser } = await load();
    db.pushSubscription.findMany.mockResolvedValue([sub("flaky")]);
    sendNotification.mockRejectedValue({ statusCode: 503 });
    const r = await sendPushToUser("u1", msg);
    expect(sendNotification).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ failed: 1, accepted: 0, removed: 0 });
    expect(db.pushSubscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: { failureCount: { increment: 1 } } }));
  });

  it("succeeds when a retry gets through", async () => {
    const { sendPushToUser } = await load();
    db.pushSubscription.findMany.mockResolvedValue([sub("d1")]);
    sendNotification.mockRejectedValueOnce({ statusCode: 429 }).mockResolvedValueOnce({ statusCode: 201 });
    expect((await sendPushToUser("u1", msg)).accepted).toBe(1);
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it("does not retry permanent errors (400/401/403)", async () => {
    const { sendPushToUser } = await load();
    db.pushSubscription.findMany.mockResolvedValue([sub("d1")]);
    sendNotification.mockRejectedValue({ statusCode: 403 });
    expect((await sendPushToUser("u1", msg)).failed).toBe(1);
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("dedupe: a second send with the same key is skipped without calling the provider", async () => {
    const { sendPushToUser } = await load();
    db.pushSubscription.findMany.mockResolvedValue([sub("d1")]);
    const m = { ...msg, kind: "bills" as const, dedupeKey: "bill:1:2026-10-18:d3" };
    expect((await sendPushToUser("u1", m)).accepted).toBe(1);
    db.pushDelivery.create.mockRejectedValueOnce({ code: "P2002" });
    expect(await sendPushToUser("u1", m)).toMatchObject({ skipped: "duplicate", accepted: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("a send that nothing accepted releases its dedupe claim so the next run can retry", async () => {
    const { sendPushToUser } = await load();
    db.pushSubscription.findMany.mockResolvedValue([sub("d1")]);
    sendNotification.mockRejectedValue({ statusCode: 500 });
    await sendPushToUser("u1", { ...msg, dedupeKey: "k" });
    expect(db.pushDelivery.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", dedupeKey: "k" } });
    expect(db.pushDelivery.updateMany).not.toHaveBeenCalled();
  });

  it("refuses an external url in the payload", async () => {
    const { sendPushToUser } = await load();
    await expect(sendPushToUser("u1", { ...msg, url: "https://evil.example" })).rejects.toThrow(/in-app path/);
  });
});
