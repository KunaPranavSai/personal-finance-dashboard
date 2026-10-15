import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

type Row = { id: string; userId: string; endpoint: string; p256dh: string; auth: string; categories: Record<string, unknown>; createdAt: Date };
const { rows, sendPushToUser } = vi.hoisted(() => ({ rows: [] as Row[], sendPushToUser: vi.fn() }));
let seq = 0;

vi.mock("../lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      findFirst: async ({ where }: { where: Partial<Row> }) => rows.find((r) => Object.entries(where).every(([k, v]) => (r as never)[k] === v)) ?? null,
      findMany: async ({ where, skip = 0 }: { where: Partial<Row>; skip?: number }) =>
        rows.filter((r) => r.userId === where.userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(skip),
      upsert: async ({ where, create, update }: { where: { endpoint: string }; create: Partial<Row>; update: Partial<Row> }) => {
        const hit = rows.find((r) => r.endpoint === where.endpoint);
        if (hit) return Object.assign(hit, update);
        const row = { id: `s${++seq}`, createdAt: new Date(Date.now() + seq), categories: {}, ...create } as Row;
        rows.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => Object.assign(rows.find((r) => r.id === where.id)!, data),
      deleteMany: async ({ where }: { where: { endpoint?: string; userId?: string; id?: { in: string[] } } }) => {
        const doomed = rows.filter((r) => (where.endpoint ? r.endpoint === where.endpoint : true) && (where.userId ? r.userId === where.userId : true) && (where.id ? where.id.in.includes(r.id) : true));
        doomed.forEach((d) => rows.splice(rows.indexOf(d), 1));
        return { count: doomed.length };
      },
    },
  },
}));
vi.mock("../services/push", () => ({ pushConfigured: () => true, vapidPublicKey: () => "PUB", userTag: (id: string) => `tag-${id}`, sendPushToUser }));

import router from "./push.routes";
import { errorHandler } from "../middleware/errorHandler";

let server: Server;
let base = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = { userId: String(req.headers["x-user"]) } as never; // stands in for the real authenticate middleware
    next();
  });
  app.use("/api/push", router);
  app.use(errorHandler);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/push`;
});
afterAll(() => server.close());
beforeEach(() => {
  rows.length = 0;
  sendPushToUser.mockReset();
});

const call = (user: string, method: string, path: string, body?: unknown) =>
  fetch(base + path, { method, headers: { "content-type": "application/json", "x-user": user }, body: body ? JSON.stringify(body) : undefined });
const sub = (id: string, extra: object = {}) => ({ endpoint: `https://fcm.example/send/${id}`, keys: { p256dh: "pk", auth: "ak" }, ...extra });

describe("/api/push", () => {
  it("serves the public key and an opaque user tag, never a private key", async () => {
    const body = await (await call("alice", "GET", "/config")).json();
    expect(body).toEqual({ configured: true, publicKey: "PUB", uidTag: "tag-alice" });
  });

  it("registers a device for the signed-in user", async () => {
    const res = await call("alice", "POST", "/subscribe", sub("a1", { categories: { bills: false } }));
    expect(res.status).toBe(201);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: "alice", categories: { bills: false } });
  });

  it("rejects non-https endpoints and malformed bodies", async () => {
    expect((await call("alice", "POST", "/subscribe", { ...sub("x"), endpoint: "http://insecure.example/x" })).status).toBe(400);
    expect((await call("alice", "POST", "/subscribe", { endpoint: "https://ok.example/x" })).status).toBe(400);
    expect((await call("alice", "POST", "/subscribe", sub("y", { categories: { admin: true } }))).status).toBe(400);
    expect(rows).toHaveLength(0);
  });

  it("another user cannot read, change or delete my device", async () => {
    await call("alice", "POST", "/subscribe", sub("a1"));
    const ep = sub("a1").endpoint;
    expect(await (await call("bob", "POST", "/status", { endpoint: ep })).json()).toEqual({ subscribed: false, categories: {} });
    expect((await call("bob", "PATCH", "/preferences", { endpoint: ep, categories: { security: false } })).status).toBe(404);
    expect(await (await call("bob", "DELETE", "/subscribe", { endpoint: ep })).json()).toEqual({ removed: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("alice");
    expect(await (await call("alice", "DELETE", "/subscribe", { endpoint: ep })).json()).toEqual({ removed: 1 });
  });

  it("registering the same browser under a new login moves the device to that user (shared device)", async () => {
    await call("alice", "POST", "/subscribe", sub("shared"));
    await call("bob", "POST", "/subscribe", sub("shared"));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("bob");
  });

  it("updates category preferences for the caller's own device only", async () => {
    await call("alice", "POST", "/subscribe", sub("a1"));
    const res = await call("alice", "PATCH", "/preferences", { endpoint: sub("a1").endpoint, categories: { bills: false } });
    expect(await res.json()).toEqual({ categories: { bills: false } });
  });

  it("keeps at most 10 devices per user (oldest dropped)", async () => {
    for (let i = 0; i < 12; i++) await call("alice", "POST", "/subscribe", sub(`d${i}`));
    expect(rows.filter((r) => r.userId === "alice")).toHaveLength(10);
    expect(rows.some((r) => r.endpoint.endsWith("/d0"))).toBe(false);
  });

  it("test push goes to the caller only, and is rate limited", async () => {
    sendPushToUser.mockResolvedValue({ accepted: 1, failed: 0, removed: 0 });
    expect((await call("carol", "POST", "/test")).status).toBe(200);
    expect(sendPushToUser.mock.calls[0][0]).toBe("carol");
    expect((await call("carol", "POST", "/test")).status).toBe(429);
  });

  it("test push explains when this user has no device", async () => {
    sendPushToUser.mockResolvedValue({ accepted: 0, failed: 0, removed: 0, skipped: "no_subscription" });
    expect((await call("dave", "POST", "/test")).status).toBe(409);
  });
});
