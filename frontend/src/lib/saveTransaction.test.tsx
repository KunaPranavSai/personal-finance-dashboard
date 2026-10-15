// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

const { apiPost, apiPatch, mode, localCreate, enqueue } = vi.hoisted(() => ({
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  mode: { current: "drive" as "drive" | "local" },
  localCreate: vi.fn(),
  enqueue: vi.fn(async () => ({})),
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
vi.mock("./offlineQueue", () => ({ enqueueMutation: enqueue }));

import { ApiClientError } from "./api";
import { afterConfirmedSave, describeSaveFailure, persistTransaction } from "./saveTransaction";
import type { SaveTimingRecord } from "./saveTiming";

const payload = { description: "lunch", amount: 120, type: "EXPENSE", categoryId: "c1", date: "2026-10-15" };
const save = (key = "key-1") => persistTransaction({ payload, idempotencyKey: key, kind: "expense" });
const timeout = () => new ApiClientError(0, "That took too long", { code: "NETWORK_TIMEOUT" });
const timings = () => ((globalThis as unknown as { __ppSaveTimings?: SaveTimingRecord[] }).__ppSaveTimings ?? []) as SaveTimingRecord[];

beforeEach(() => {
  vi.clearAllMocks();
  mode.current = "drive";
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  (globalThis as unknown as { __ppSaveTimings?: unknown[] }).__ppSaveTimings = [];
});
afterEach(() => vi.useRealTimers());

describe("Drive mode: critical path", () => {
  it("fast save: confirmed with the server's record, key forwarded, timing recorded without any transaction data", async () => {
    apiPost.mockResolvedValue({ id: "t1" });
    const r = await save("k-fast");
    expect(r).toEqual({ queued: false, data: { id: "t1" } });
    expect(apiPost).toHaveBeenCalledWith("/api/transactions", payload, "k-fast");
    const rec = timings().at(-1)!;
    expect(rec).toMatchObject({ kind: "expense", outcome: "saved" });
    expect(Object.keys(rec.marks)).toEqual(expect.arrayContaining(["persist-start", "persisted"]));
    expect(JSON.stringify(rec)).not.toMatch(/lunch|120|c1/); // no description, amount or category in diagnostics
  });

  it("slow persistence: not confirmed until the server answers", async () => {
    vi.useFakeTimers();
    apiPost.mockImplementation(() => new Promise((r) => setTimeout(() => r({ id: "t2" }), 8000)));
    let done = false;
    const p = save("k-slow").then((x) => ((done = true), x));
    await vi.advanceTimersByTimeAsync(7999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect((await p).queued).toBe(false);
  });

  it("Drive failure: rejects with the server's reason, input is the caller's to keep, nothing queued", async () => {
    apiPost.mockRejectedValue(new ApiClientError(500, "Your Google Drive could not be reached."));
    await expect(save("k-500")).rejects.toThrow(/Google Drive/);
    expect(describeSaveFailure(new ApiClientError(500, "Your Google Drive could not be reached.")).uncertain).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
    expect(timings().at(-1)?.outcome).toBe("failed");
  });

  it("network timeout while online is an UNCERTAIN outcome: not queued, not called a failure, retry is safe", async () => {
    apiPost.mockRejectedValue(timeout());
    await expect(save("k-t")).rejects.toBeInstanceOf(ApiClientError);
    expect(enqueue).not.toHaveBeenCalled();
    const f = describeSaveFailure(timeout());
    expect(f.uncertain).toBe(true);
    expect(f.message).toMatch(/won't be added twice/);
    expect(timings().at(-1)?.outcome).toBe("uncertain");
    expect(describeSaveFailure(new ApiClientError(504, "gateway")).uncertain).toBe(true);
  });

  it("retry after an uncertain outcome reuses the SAME idempotency key", async () => {
    apiPost.mockRejectedValueOnce(timeout()).mockResolvedValueOnce({ id: "t3" });
    await expect(save("k-retry")).rejects.toBeDefined();
    const r = await save("k-retry");
    expect(r.queued).toBe(false);
    expect(apiPost.mock.calls.map((c) => c[2])).toEqual(["k-retry", "k-retry"]);
  });

  it("duplicate Save clicks while the first is running share ONE request and ONE result", async () => {
    let release!: (v: unknown) => void;
    apiPost.mockImplementation(() => new Promise((r) => (release = r)));
    const a = save("k-dbl");
    const b = save("k-dbl");
    const c = save("k-dbl");
    release({ id: "t4" });
    const [ra, rb, rc] = await Promise.all([a, b, c]);
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(ra).toBe(rb);
    expect(rb).toBe(rc);
    expect(timings().filter((t) => t.outcome === "deduped")).toHaveLength(2);
  });

  it("a different logical save (new key) is not blocked by one in flight", async () => {
    apiPost.mockResolvedValue({ id: "x" });
    await Promise.all([save("k-a"), save("k-b")]);
    expect(apiPost).toHaveBeenCalledTimes(2);
  });

  it("offline: stored in the offline queue under the same key and reported as queued, never as saved", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    apiPost.mockRejectedValue(new ApiClientError(0, "offline", { code: "NETWORK_OFFLINE" }));
    const r = await save("k-off");
    expect(r).toEqual({ queued: true });
    expect(enqueue).toHaveBeenCalledWith("expense", "/api/transactions", payload, "k-off");
    expect(timings().at(-1)?.outcome).toBe("queued");
  });
});

describe("device-only mode", () => {
  it("success is an IndexedDB commit (no network call at all)", async () => {
    mode.current = "local";
    localCreate.mockResolvedValue({ id: "local-1" });
    const r = await save("k-local");
    expect(r).toEqual({ queued: false, data: { id: "local-1" } });
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("IndexedDB failure: rejects with the storage message, never reports success", async () => {
    mode.current = "local";
    localCreate.mockRejectedValue(new Error("Local storage is full or unavailable."));
    await expect(save("k-idb")).rejects.toThrow(/Local storage/);
    expect(describeSaveFailure(new Error("Local storage is full or unavailable.")).message).toMatch(/Local storage is full/);
    expect(apiPost).not.toHaveBeenCalled();
  });
});

describe("after a confirmed save", () => {
  it("a failing refresh never turns the confirmed save into an error and raises no unhandled rejection", async () => {
    apiPost.mockResolvedValue({ id: "t5" });
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const qc = new QueryClient();
    vi.spyOn(qc, "invalidateQueries").mockRejectedValue(new Error("refetch blew up"));
    const r = await save("k-refresh");
    expect(() => afterConfirmedSave(qc)).not.toThrow();
    await new Promise((res) => setTimeout(res, 20));
    expect(r.queued).toBe(false);
    expect(unhandled).not.toHaveBeenCalled();
    process.off("unhandledRejection", unhandled);
  });

  it("refreshes the dependent data after the confirmation, without awaiting it", async () => {
    const qc = new QueryClient();
    for (const k of ["dashboard-summary", "income-expense-trend", "activity-feed", "capital-summary", "budgets", "settings"]) qc.setQueryData([k], {});
    afterConfirmedSave(qc);
    const stale = (k: string) => qc.getQueryState([k])!.isInvalidated;
    expect(["dashboard-summary", "income-expense-trend", "activity-feed", "capital-summary", "budgets"].every(stale)).toBe(true);
    expect(stale("settings")).toBe(false);
  });
});

describe("navigation during a save", () => {
  it("leaving the screen does not cancel the save, and the mutation-level success handler still refreshes dependent data", async () => {
    let release!: (v: unknown) => void;
    apiPost.mockImplementation(() => new Promise((r) => (release = r)));
    const qc = new QueryClient();
    qc.setQueryData(["dashboard-summary"], {});
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(
      () => useMutation({ mutationFn: () => save("k-nav"), onSuccess: () => afterConfirmedSave(qc) }), // same shape as the forms
      { wrapper },
    );
    act(() => result.current.mutate());
    await vi.waitFor(() => expect(apiPost).toHaveBeenCalled());
    unmount(); // user navigates away mid-save
    await act(async () => release({ id: "t6" }));
    await vi.waitFor(() => expect(qc.getQueryState(["dashboard-summary"])!.isInvalidated).toBe(true));
    expect(apiPost).toHaveBeenCalledTimes(1);
  });
});
