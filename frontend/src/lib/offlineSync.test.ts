import { beforeEach, describe, expect, it, vi } from "vitest";

type Item = { id: string; entity: string; method: "POST"; path: string; body: unknown; createdAt: string; idempotencyKey: string; owner?: string; attempts?: number; status?: "pending" | "rejected"; lastError?: string };
const { queue, owner } = vi.hoisted(() => ({ queue: [] as Item[], owner: { current: "alice" as string | null } }));

vi.mock("./api", () => ({ API_BASE_URL: "http://api.test" }));
vi.mock("./offlineQueue", () => ({
  getQueueOwner: () => owner.current,
  getQueuedMutations: async () => [...queue].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  removeQueuedMutation: async (id: string) => void queue.splice(queue.findIndex((q) => q.id === id), 1),
  updateQueuedMutation: async (id: string, patch: Partial<Item>) => void Object.assign(queue.find((q) => q.id === id)!, patch),
}));

import { classifyStatus, discardQueued, flushOfflineQueue, retryRejected, MAX_ATTEMPTS } from "./offlineSync";

const item = (id: string, over: Partial<Item> = {}): Item => ({ id, entity: "expense", method: "POST", path: "/api/transactions", body: { amount: 10 }, createdAt: `2026-10-15T10:0${id}:00Z`, idempotencyKey: `key-${id}`, owner: "alice", attempts: 0, status: "pending", ...over });
const respond = (...statuses: (number | Error)[]) => {
  const f = vi.fn();
  statuses.forEach((s) => (s instanceof Error ? f.mockRejectedValueOnce(s) : f.mockResolvedValueOnce(new Response(JSON.stringify({ error: `reason ${s}` }), { status: s }))));
  vi.stubGlobal("fetch", f);
  return f;
};

beforeEach(() => {
  queue.length = 0;
  owner.current = "alice";
  vi.unstubAllGlobals();
});

describe("classifyStatus", () => {
  it("separates 'try again later' from 'will never work'", () => {
    for (const s of [200, 201]) expect(classifyStatus(s)).toBe("ok");
    expect(classifyStatus(401)).toBe("auth");
    for (const s of [403, 408, 429, 500, 502, 503]) expect(classifyStatus(s), String(s)).toBe("retry");
    for (const s of [400, 404, 409, 413, 422]) expect(classifyStatus(s), String(s)).toBe("reject");
  });
});

describe("flushOfflineQueue", () => {
  it("sends the ORIGINAL idempotency key and removes an item only after the server confirmed it", async () => {
    queue.push(item("1"));
    const f = respond(201);
    const r = await flushOfflineQueue();
    expect(f.mock.calls[0][1].headers["Idempotency-Key"]).toBe("key-1");
    expect(r.synced).toHaveLength(1);
    expect(queue).toHaveLength(0);
  });

  it("an unconfirmed attempt (network drop) keeps the item and stops, preserving order", async () => {
    queue.push(item("1"), item("2"));
    const f = respond(new TypeError("offline"));
    const r = await flushOfflineQueue();
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.retryLater).toHaveLength(1);
    expect(queue.map((q) => q.id)).toEqual(["1", "2"]);
  });

  it("a response lost after the server saved it: the retry reuses the key, so the server returns the original (no duplicate)", async () => {
    queue.push(item("1"));
    respond(new TypeError("response lost")); // attempt 1: never saw the answer
    await flushOfflineQueue();
    const f = respond(201); // attempt 2 -> server treats the same key as the same record
    await flushOfflineQueue();
    expect(f.mock.calls[0][1].headers["Idempotency-Key"]).toBe("key-1");
    expect(queue).toHaveLength(0);
  });

  it("server errors are retried with a counter, never dropped, and don't spam", async () => {
    queue.push(item("1"));
    respond(503);
    const r = await flushOfflineQueue();
    expect(r.rejected).toHaveLength(0);
    expect(queue[0]).toMatchObject({ attempts: 1, status: "pending" });
  });

  it("after MAX_ATTEMPTS retryable failures the item moves to 'rejected' for the user to decide, still not deleted", async () => {
    queue.push(item("1", { attempts: MAX_ATTEMPTS - 1 }));
    respond(500);
    const r = await flushOfflineQueue();
    expect(r.rejected).toHaveLength(1);
    expect(queue[0]).toMatchObject({ status: "rejected" });
    expect(queue[0].lastError).toMatch(/attempts/);
  });

  it("a validation refusal marks ONLY that item rejected (with the server's reason) and the rest still sync", async () => {
    queue.push(item("1"), item("2"));
    respond(422, 201);
    const r = await flushOfflineQueue();
    expect(r.rejected.map((x) => x.id)).toEqual(["1"]);
    expect(r.synced.map((x) => x.id)).toEqual(["2"]);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ id: "1", status: "rejected", lastError: "reason 422" });
  });

  it("an idempotency-key conflict (409) is a rejection, not a silent drop", async () => {
    queue.push(item("1"));
    respond(409);
    expect((await flushOfflineQueue()).rejected).toHaveLength(1);
    expect(queue).toHaveLength(1);
  });

  it("session expiry (401) stops the run, keeps everything, and reports it", async () => {
    queue.push(item("1"), item("2"));
    const f = respond(401);
    const r = await flushOfflineQueue();
    expect(r.authExpired).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    expect(queue).toHaveLength(2);
    expect(queue[0].attempts).toBe(0);
  });

  it("rejected items are not re-sent on later runs (no endless identical errors)", async () => {
    queue.push(item("1", { status: "rejected", lastError: "x" }));
    const f = respond(201);
    const r = await flushOfflineQueue();
    expect(f).not.toHaveBeenCalled();
    expect(r.rejected).toHaveLength(0);
  });

  it("never sends another account's queued writes under the current session", async () => {
    queue.push(item("1", { owner: "bob" }), item("2", { owner: "alice" }));
    const f = respond(201);
    const r = await flushOfflineQueue();
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.synced.map((x) => x.id)).toEqual(["2"]);
    expect(r.otherAccount).toBe(1);
    expect(queue.map((q) => q.id)).toEqual(["1"]); // bob's item untouched
  });

  it("sends nothing at all when no account is signed in", async () => {
    owner.current = null;
    queue.push(item("1"));
    const f = respond(201);
    await flushOfflineQueue();
    expect(f).not.toHaveBeenCalled();
  });

  it("an item from before accounts were tracked is adopted by the account that syncs it", async () => {
    queue.push(item("1", { owner: undefined }));
    respond(500);
    await flushOfflineQueue();
    expect(queue[0].owner).toBe("alice");
  });
});

describe("recovery actions", () => {
  it("retry puts a rejected item back in line; discard removes it only when the user asks", async () => {
    queue.push(item("1", { status: "rejected", lastError: "x", attempts: 4 }));
    await retryRejected("1");
    expect(queue[0]).toMatchObject({ status: "pending", attempts: 0 });
    await discardQueued("1");
    expect(queue).toHaveLength(0);
  });
});
