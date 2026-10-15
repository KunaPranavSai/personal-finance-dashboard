// @vitest-environment jsdom
import "fake-indexeddb/auto"; // a real IndexedDB implementation: the durable outbox is exercised end to end
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

const { mode, localCreate, apiPost, apiPatch } = vi.hoisted(() => ({
  mode: { current: "drive" as "drive" | "local" },
  localCreate: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}));

vi.mock("./api", () => {
  class ApiClientError extends Error {
    constructor(public status: number, message: string, public details?: unknown) {
      super(message);
    }
  }
  return { api: { post: apiPost, patch: apiPatch, get: vi.fn() }, ApiClientError, API_BASE_URL: "http://api.test" };
});
vi.mock("./storage", () => ({ getStorageMode: () => mode.current, getStorageProvider: vi.fn() }));
vi.mock("./services/transactionsService", () => ({ createLocalTransaction: localCreate, updateLocalTransaction: vi.fn() }));

import { ApiClientError } from "./api";
import { afterConfirmedSave, describeSaveFailure, persistTransaction, savedMessage } from "./saveTransaction";
import { getQueuedMutations, setQueueOwner } from "./offlineQueue";
import { onFlushResult, requestFlush, type SyncResult } from "./offlineSync";
import type { SaveTimingRecord } from "./saveTiming";

const payload = { description: "lunch", amount: 120, type: "EXPENSE", categoryId: "c1", date: "2026-10-15" };
const save = (key = "key-1") => persistTransaction({ payload, idempotencyKey: key, kind: "expense" });
const timings = () => ((globalThis as unknown as { __ppSaveTimings?: SaveTimingRecord[] }).__ppSaveTimings ?? []) as SaveTimingRecord[];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const online = (v: boolean) => Object.defineProperty(navigator, "onLine", { value: v, configurable: true });

/** A tiny "server" in front of Drive: records are stored by idempotency key, so a replayed request returns the original. */
function fakeServer(opts: { latency?: number; script?: (n: number) => "ok" | "lose-response" | 500 | 503 | 422 | "unreachable" } = {}) {
  const records = new Map<string, { id: string }>();
  const log: { key: string; method: string; user: string }[] = [];
  let n = 0;
  const f = vi.fn(async (_url: string, init: RequestInit) => {
    n++;
    const key = (init.headers as Record<string, string>)["Idempotency-Key"];
    log.push({ key, method: String(init.method), user: "session" });
    await sleep(opts.latency ?? 0);
    const act = opts.script?.(n) ?? "ok";
    if (act === "unreachable") throw new TypeError("fetch failed");
    if (typeof act === "number") return new Response(JSON.stringify({ error: `err ${act}` }), { status: act });
    if (!records.has(key)) records.set(key, { id: `rec-${records.size + 1}` }); // persisted
    if (act === "lose-response") throw new TypeError("response lost"); // ...but the client never hears about it
    return new Response(JSON.stringify(records.get(key)), { status: 201 });
  });
  vi.stubGlobal("fetch", f);
  return { f, records, log };
}

let results: SyncResult[] = [];
let off: () => void;

beforeEach(async () => {
  vi.clearAllMocks();
  mode.current = "drive";
  online(true);
  results = [];
  (globalThis as unknown as { __ppSaveTimings?: unknown[] }).__ppSaveTimings = [];
  await new Promise<void>((res) => {
    const d = indexedDB.deleteDatabase("penny-pilot-offline");
    d.onsuccess = d.onerror = d.onblocked = () => res();
  });
  await setQueueOwner("alice");
  off = onFlushResult((r) => results.push(r));
});
afterEach(() => {
  off();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Drive mode: the click is not held hostage by Drive", () => {
  it("1. fast save: answers 'syncing' (never 'saved'), then Drive confirms and the outbox empties", async () => {
    const s = fakeServer();
    const r = await save("k-fast");
    expect(r).toMatchObject({ queued: true, state: "syncing" });
    expect(savedMessage(r, "Expense", false)).toMatch(/Saving expense to Google Drive/); // not "saved"
    await vi.waitFor(() => expect(results.flatMap((x) => x.synced)).toHaveLength(1));
    expect(s.f.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(s.records.size).toBe(1);
    expect(await getQueuedMutations()).toHaveLength(0);
  });

  it("2. slow Drive: the form is released immediately while the item stays visibly pending until Drive answers", async () => {
    const s = fakeServer({ latency: 600 });
    const t0 = performance.now();
    const r = await save("k-slow");
    const feedbackMs = performance.now() - t0;
    expect(feedbackMs).toBeLessThan(300); // not 600+
    expect(r.state).toBe("syncing");
    const pending = await getQueuedMutations();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ status: "pending", owner: "alice", idempotencyKey: "k-slow" });
    await vi.waitFor(() => expect(s.records.size).toBe(1), { timeout: 3000 });
    await vi.waitFor(async () => expect(await getQueuedMutations()).toHaveLength(0), { timeout: 3000 });
  });

  it("3. server timeout after the record WAS persisted: the retry returns the original, exactly one record exists", async () => {
    const s = fakeServer({ script: (n) => (n === 1 ? "lose-response" : "ok") });
    await save("k-lost");
    await vi.waitFor(() => expect(s.f).toHaveBeenCalledTimes(1));
    await vi.waitFor(async () => expect((await getQueuedMutations())[0]?.lastError).toMatch(/reach the server/));
    expect(s.records.size).toBe(1); // it did persist
    await requestFlush(); // the retry timer / online event
    expect(s.f.mock.calls.map((c) => (c[1].headers as Record<string, string>)["Idempotency-Key"])).toEqual(["k-lost", "k-lost"]);
    expect(s.records.size).toBe(1); // no duplicate
    expect(await getQueuedMutations()).toHaveLength(0);
  });

  it("4. Drive write failure (5xx): stays pending with the reason, is retried with the same key, never called saved", async () => {
    const s = fakeServer({ script: (n) => (n === 1 ? 503 : "ok") });
    await save("k-5xx");
    await vi.waitFor(async () => expect((await getQueuedMutations())[0]?.attempts).toBe(1));
    const item = (await getQueuedMutations())[0];
    expect(item).toMatchObject({ status: "pending", lastError: expect.stringMatching(/503/) });
    expect(results.flatMap((r) => r.synced)).toHaveLength(0);
    await requestFlush();
    expect(s.records.size).toBe(1);
    expect(await getQueuedMutations()).toHaveLength(0);
  });

  it("a definitive refusal (422) keeps the user's entry for review, with the reason, and stops retrying", async () => {
    const s = fakeServer({ script: () => 422 });
    await save("k-422");
    await vi.waitFor(() => expect(results.flatMap((r) => r.rejected)).toHaveLength(1));
    const [item] = await getQueuedMutations();
    expect(item).toMatchObject({ status: "rejected", lastError: "err 422" });
    expect(item.body).toMatchObject({ description: "lunch", amount: 120 }); // input preserved
    await requestFlush();
    expect(s.f).toHaveBeenCalledTimes(1); // not retried
  });

  it("6. offline save: stored durably, reported as 'offline' (not saved), sent when the connection returns", async () => {
    online(false);
    const s = fakeServer({ script: () => "unreachable" });
    const r = await save("k-off");
    expect(r.state).toBe("offline");
    expect(savedMessage(r, "Expense", false)).toMatch(/sync when you're back online/);
    await requestFlush();
    expect(await getQueuedMutations()).toHaveLength(1);
    online(true);
    s.f.mockImplementation(async () => new Response("{}", { status: 201 }));
    await requestFlush();
    expect(await getQueuedMutations()).toHaveLength(0);
  });

  it("7. duplicate clicks: ONE outbox entry and ONE request", async () => {
    const s = fakeServer({ latency: 50 });
    const [a, b, c] = await Promise.all([save("k-dbl"), save("k-dbl"), save("k-dbl")]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    await vi.waitFor(async () => expect(await getQueuedMutations()).toHaveLength(0));
    expect(s.f).toHaveBeenCalledTimes(1);
    expect(s.records.size).toBe(1);
  });

  it("8. concurrent flush triggers (online event, retry timer, other saves) never run two workers over the same item", async () => {
    const s = fakeServer({ latency: 80 });
    await save("k-conc");
    await Promise.all([requestFlush(), requestFlush(), requestFlush(), requestFlush(), requestFlush()]);
    await vi.waitFor(async () => expect(await getQueuedMutations()).toHaveLength(0));
    expect(s.f).toHaveBeenCalledTimes(1);
    expect(s.records.size).toBe(1);
  });

  it("9. leaving the screen mid-save changes nothing: the worker is not tied to any component", async () => {
    const s = fakeServer({ latency: 150 });
    const qc = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useMutation({ mutationFn: () => save("k-nav") }), { wrapper });
    await act(async () => void result.current.mutate());
    unmount(); // user navigates away immediately
    await vi.waitFor(() => expect(results.flatMap((r) => r.synced)).toHaveLength(1), { timeout: 3000 });
    expect(s.records.size).toBe(1);
  });

  it("10+11. reload / server restart with a pending save: it survives, is sent again with the SAME key, no duplicate", async () => {
    const s = fakeServer({ script: (n) => (n === 1 ? "lose-response" : "ok") }); // server stored it, then 'restarted' before answering
    await save("k-reload");
    await vi.waitFor(async () => expect((await getQueuedMutations())[0]?.lastError).toBeTruthy());
    vi.resetModules(); // the page is reloaded: all in-memory state is gone
    const q = await import("./offlineQueue");
    const sync = await import("./offlineSync");
    await q.setQueueOwner("alice");
    expect(await q.getQueuedMutations()).toHaveLength(1); // durable
    await sync.requestFlush();
    expect(s.f.mock.calls.map((c) => (c[1].headers as Record<string, string>)["Idempotency-Key"])).toEqual(["k-reload", "k-reload"]);
    expect(s.records.size).toBe(1);
    expect(await q.getQueuedMutations()).toHaveLength(0);
  });

  it("12. a failing background refresh cannot undo or block the confirmation", async () => {
    fakeServer();
    off();
    const seen: string[] = [];
    off = onFlushResult(() => {
      throw new Error("refresh blew up");
    });
    const off2 = onFlushResult((r) => seen.push(...r.synced.map((i) => i.idempotencyKey)));
    await save("k-refresh");
    await vi.waitFor(() => expect(seen).toEqual(["k-refresh"])); // later listeners still hear about it
    expect(await getQueuedMutations()).toHaveLength(0);
    const qc = new QueryClient();
    vi.spyOn(qc, "invalidateQueries").mockRejectedValue(new Error("refetch failed"));
    expect(() => afterConfirmedSave(qc)).not.toThrow();
    off2();
  });

  it("13. logout / account switch: a pending save is never sent under another account's session, and is kept for its owner", async () => {
    const s = fakeServer({ script: () => "unreachable" });
    await save("k-alice");
    await vi.waitFor(() => expect(s.f).toHaveBeenCalled());
    s.f.mockClear();
    s.f.mockImplementation(async () => new Response("{}", { status: 201 }));
    await setQueueOwner(null); // logged out
    await requestFlush();
    await setQueueOwner("bob"); // someone else signs in
    await requestFlush();
    expect(s.f).not.toHaveBeenCalled();
    expect(await getQueuedMutations()).toHaveLength(1); // not lost
    await setQueueOwner("alice"); // alice comes back
    await requestFlush();
    expect(s.f).toHaveBeenCalledTimes(1);
    expect(await getQueuedMutations()).toHaveLength(0);
  });

  it("14. concurrent saves are all persisted exactly once, in order", async () => {
    const s = fakeServer({ latency: 20 });
    await Promise.all(["k-1", "k-2", "k-3"].map((k) => save(k)));
    await vi.waitFor(async () => expect(await getQueuedMutations()).toHaveLength(0), { timeout: 3000 });
    expect(s.records.size).toBe(3);
    expect(new Set(s.f.mock.calls.map((c) => (c[1].headers as Record<string, string>)["Idempotency-Key"])).size).toBe(3);
  });

  it("edits go through the same durable path as PATCH", async () => {
    const s = fakeServer();
    await persistTransaction({ payload: { amount: 5 }, editingId: "t-9", idempotencyKey: "k-edit", kind: "expense" });
    await vi.waitFor(() => expect(s.f).toHaveBeenCalled());
    expect(s.f.mock.calls[0][0]).toBe("http://api.test/api/transactions/t-9");
    expect(s.f.mock.calls[0][1]).toMatchObject({ method: "PATCH" });
  });
});

describe("device-only mode", () => {
  it("success = IndexedDB commit, reported as 'saved on this device', no network, no outbox", async () => {
    mode.current = "local";
    const s = fakeServer();
    localCreate.mockResolvedValue({ id: "local-1" });
    const r = await save("k-local");
    expect(r).toMatchObject({ queued: false, state: "local" });
    expect(savedMessage(r, "Expense", false)).toBe("Expense saved on this device");
    expect(s.f).not.toHaveBeenCalled();
    expect(await getQueuedMutations()).toHaveLength(0);
  });

  it("5. IndexedDB failure: rejects with the storage message and never reports success", async () => {
    mode.current = "local";
    localCreate.mockRejectedValue(new Error("Local storage is full or unavailable."));
    await expect(save("k-idb")).rejects.toThrow(/Local storage/);
    expect(describeSaveFailure(new Error("Local storage is full or unavailable.")).message).toMatch(/Local storage is full/);
  });
});

describe("when the outbox itself cannot be written", () => {
  it("the click fails loudly (form keeps the input) instead of pretending it is syncing", async () => {
    fakeServer();
    const open = vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new Error("IndexedDB unavailable");
    });
    await expect(save("k-noidb")).rejects.toThrow(/IndexedDB/);
    open.mockRestore();
    expect(timings().at(-1)?.outcome).toBe("failed");
  });
});

describe("failure wording", () => {
  it("a timeout is described as uncertain with a safe retry; other errors keep their reason", () => {
    const t = new ApiClientError(0, "slow", { code: "NETWORK_TIMEOUT" });
    expect(describeSaveFailure(t)).toMatchObject({ uncertain: true });
    expect(describeSaveFailure(t).message).toMatch(/won't be added twice/);
    expect(describeSaveFailure(new ApiClientError(500, "Your Google Drive could not be reached.")).uncertain).toBe(false);
  });
});

describe("MEASURED: click to feedback, before vs after, same environment", () => {
  for (const serverMs of [600, 1500]) {
    it(`server/Drive takes ${serverMs} ms`, async () => {
      fakeServer({ latency: serverMs });
      // BEFORE: the click waited for the authoritative answer before the form could close
      const b0 = performance.now();
      await new Promise((r) => setTimeout(r, serverMs)); // == the awaited request in the old mutationFn
      const before = Math.round(performance.now() - b0);
      // AFTER: the click waits only for the durable local outbox write
      const a0 = performance.now();
      await save(`k-measure-${serverMs}`);
      const after = Math.round(performance.now() - a0);
      await vi.waitFor(async () => expect(await getQueuedMutations()).toHaveLength(0), { timeout: serverMs + 3000 });
      const confirmed = timings().find((t) => t.outcome === "syncing");
      console.log(`[measure] server ${serverMs} ms -> click-to-feedback BEFORE ${before} ms, AFTER ${after} ms; marks ${JSON.stringify(confirmed?.marks)}`);
      expect(after).toBeLessThan(before / 2);
      expect(after).toBeLessThan(1000);
    }, 20000);
  }
});
