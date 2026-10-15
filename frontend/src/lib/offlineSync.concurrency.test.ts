// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({ API_BASE_URL: "http://api.test", api: {} }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const idKey = (c: unknown[]) => ((c[1] as RequestInit).headers as Record<string, string>)["Idempotency-Key"];

/** A Web Locks implementation shared by every "tab" (module instance) in this test. */
function installLocks() {
  const held = new Set<string>();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (name: string, opts: { ifAvailable?: boolean }, cb: (l: unknown) => Promise<unknown>) => {
        if (opts?.ifAvailable && held.has(name)) return cb(null);
        held.add(name);
        try {
          return await cb({ name });
        } finally {
          held.delete(name);
        }
      },
    },
  });
}

async function freshTab() {
  vi.resetModules(); // a different tab: its own in-memory state, the same IndexedDB and the same lock manager
  const queue = await import("./offlineQueue");
  const sync = await import("./offlineSync");
  return { queue, sync };
}

beforeEach(async () => {
  await new Promise<void>((res) => {
    const d = indexedDB.deleteDatabase("penny-pilot-offline");
    d.onsuccess = d.onerror = d.onblocked = () => res();
  });
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  installLocks();
});
afterEach(() => vi.unstubAllGlobals());

describe("concurrent tabs", () => {
  it("two tabs with the same pending entry: exactly ONE request is made, and the entry is confirmed once", async () => {
    const tabA = await freshTab();
    await tabA.queue.setQueueOwner("alice");
    await tabA.queue.enqueueMutation("expense", "/api/transactions", { amount: 1, description: "x" }, "k-tabs");
    const f = vi.fn(async () => (await sleep(120), new Response(JSON.stringify({ id: "srv-1" }), { status: 201 })));
    vi.stubGlobal("fetch", f);
    const tabB = await freshTab();
    await tabB.queue.setQueueOwner("alice");
    await Promise.all([tabA.sync.requestFlush(), tabB.sync.requestFlush()]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(await tabA.queue.getQueuedMutations()).toHaveLength(0);
  });

  it("if both tabs did send (no lock support), the server's idempotency key still makes it one record", async () => {
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
    const tabA = await freshTab();
    await tabA.queue.setQueueOwner("alice");
    await tabA.queue.enqueueMutation("expense", "/api/transactions", { amount: 1 }, "k-nolock");
    const store = new Map<string, string>();
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      const key = (init.headers as Record<string, string>)["Idempotency-Key"];
      await sleep(30);
      if (!store.has(key)) store.set(key, `rec-${store.size + 1}`);
      return new Response(JSON.stringify({ id: store.get(key) }), { status: 201 });
    });
    vi.stubGlobal("fetch", f);
    const tabB = await freshTab();
    await tabB.queue.setQueueOwner("alice");
    await Promise.all([tabA.sync.requestFlush(), tabB.sync.requestFlush()]);
    expect(new Set(f.mock.calls.map(idKey))).toEqual(new Set(["k-nolock"])); // same key every time
    expect(store.size).toBe(1);
  });
});

describe("account switching during a running flush", () => {
  it("sign-out mid-run: the remaining entries of that account are NOT sent with the next session", async () => {
    const { queue, sync } = await freshTab();
    await queue.setQueueOwner("alice");
    for (const k of ["k1", "k2", "k3"]) await queue.enqueueMutation("expense", "/api/transactions", { amount: 1 }, k);
    const sent: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        sent.push((init.headers as Record<string, string>)["Idempotency-Key"]);
        if (sent.length === 1) await queue.setQueueOwner("bob"); // alice signs out and bob signs in while request 1 is in flight
        await sleep(10);
        return new Response(JSON.stringify({ id: "x" }), { status: 201 });
      }),
    );
    await sync.requestFlush();
    expect(sent).toEqual(["k1"]); // k2 and k3 were never sent under bob's session
    const left = await queue.getQueuedMutations();
    expect(left.map((i) => i.idempotencyKey).sort()).toEqual(["k2", "k3"]);
    expect(left.every((i) => i.owner === "alice")).toBe(true);
  });
});
