// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";

const { auth, confirmFn } = vi.hoisted(() => ({ auth: { uid: "alice" as string | null }, confirmFn: vi.fn() }));
vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: auth.uid ? { uid: auth.uid } : null }) }));
vi.mock("@/lib/AuthContext", () => ({ useAuth: () => ({ user: auth.uid ? { uid: auth.uid } : null }) }));
vi.mock("@/lib/SettingsContext", () => ({ useSettingsContext: () => ({ settings: { currency: "INR" } }) }));
vi.mock("@/components/ui/PpConfirm", () => ({ usePpConfirm: () => confirmFn }));
vi.mock("./api", () => ({ API_BASE_URL: "http://api.test", api: {} }));

import { enqueueMutation, getQueuedMutations, setQueueOwner, updateQueuedMutation } from "./offlineQueue";
import { requestFlush } from "./offlineSync";
import { _resetConfirming, countUnsynced, pendingEditBody, rowOf, usePendingTransactions, visibleRows, type PendingRow } from "./pendingTransactions";
import { PendingTransactionsStrip } from "@/components/pending/PendingTransactionsStrip";
import { useUnsyncedLogoutGuard } from "./logoutGuard";

const body = { description: "lunch", amount: 120, type: "EXPENSE", date: "2026-10-15", categoryId: "c1" };
const create = (key: string, entity: "expense" | "income" = "expense") => enqueueMutation(entity, "/api/transactions", body, key);
const edit = (key: string, id: string) => enqueueMutation("expense", `/api/transactions/${id}`, { ...body, amount: 150 }, key, "PATCH");
const serverReturning = (statusFor: (n: number) => number, id = "srv-1") => {
  let n = 0;
  const f = vi.fn(async () => {
    n++;
    const st = statusFor(n);
    return new Response(JSON.stringify(st < 300 ? { id } : { error: "Amount is not valid for this account." }), { status: st });
  });
  vi.stubGlobal("fetch", f);
  return f;
};

beforeEach(async () => {
  auth.uid = "alice";
  _resetConfirming();
  confirmFn.mockReset();
  await new Promise<void>((res) => {
    const d = indexedDB.deleteDatabase("penny-pilot-offline");
    d.onsuccess = d.onerror = d.onblocked = () => res();
  });
  await setQueueOwner("alice");
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("row mapping", () => {
  it("create vs edit, with the user's submitted values and an honest state", async () => {
    const c = await create("k1");
    const e = await edit("k2", "t-9");
    expect(rowOf(c)).toMatchObject({ mode: "create", type: "EXPENSE", description: "lunch", amount: 120, state: "syncing" });
    expect(rowOf(e)).toMatchObject({ mode: "edit", targetId: "t-9", amount: 150, state: "syncing" });
    expect(rowOf(c, true)?.state).toBe("waiting");
    expect(rowOf({ ...c, lastError: "Couldn't reach the server" })?.state).toBe("retrying");
    expect(rowOf({ ...c, status: "rejected", lastError: "no" })).toMatchObject({ state: "refused", reason: "no" });
  });

  it("only transactions are mapped (budgets/investments in the outbox are not shown as transactions)", async () => {
    const other = await enqueueMutation("budget", "/api/budgets", {}, "kb");
    expect(rowOf(other)).toBeNull();
  });

  it("MAPPING KEEPS EVERYTHING NEEDED TO RETRY: the full entry and the original idempotency key stay in the outbox", async () => {
    await create("k-keep");
    const [stored] = await getQueuedMutations();
    expect(stored.body).toEqual(body);
    expect(stored.idempotencyKey).toBe("k-keep");
    expect(stored.owner).toBe("alice");
  });
});

describe("reconciliation without duplicates", () => {
  const confirmingRow = (serverId: string): PendingRow => ({ key: "o1", outboxId: "o1", mode: "create", type: "EXPENSE", description: "x", amount: 1, date: "2026-10-15", state: "confirming", serverId, body: {} });

  it("a just-confirmed row is hidden as soon as the refreshed list contains it", () => {
    expect(visibleRows([confirmingRow("srv-1")], [])).toHaveLength(1);
    expect(visibleRows([confirmingRow("srv-1")], ["other", "srv-1"])).toHaveLength(0);
  });

  it("pending (unconfirmed) rows are never hidden by a list that doesn't contain them", () => {
    const pending: PendingRow = { ...confirmingRow("srv-1"), state: "syncing" };
    expect(visibleRows([pending], ["srv-1"])).toHaveLength(1);
  });

  it("end to end: pending -> Drive confirms -> 'confirming' (not 'pending') -> gone once the refreshed list has the id", async () => {
    serverReturning(() => 201, "srv-77");
    const { result, rerender } = renderHook(({ known }: { known: string[] }) => usePendingTransactions(known), { initialProps: { known: [] as string[] } });
    await act(async () => void (await create("k-e2e")));
    await waitFor(() => expect(result.current.map((r) => r.state)).toContain("syncing"));
    await act(async () => void (await requestFlush()));
    await waitFor(() => expect(result.current.map((r) => r.state)).toEqual(["confirming"]));
    expect(result.current[0].serverId).toBe("srv-77");
    rerender({ known: ["srv-77"] }); // the Activity/Home query refetched and now contains the real record
    await waitFor(() => expect(result.current).toHaveLength(0));
  });

  it("another account's outbox entries never show up", async () => {
    await setQueueOwner("bob");
    await create("k-bob");
    await setQueueOwner("alice");
    const { result } = renderHook(() => usePendingTransactions());
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toHaveLength(0);
  });
});

describe("pending strip (what the user sees)", () => {
  it("labels each entry with where it stands, is a named region, and never claims 'saved' for unconfirmed entries", async () => {
    await create("k-ui");
    await edit("k-ui2", "t-1");
    render(<PendingTransactionsStrip />);
    const region = await screen.findByRole("region", { name: /not yet confirmed by Google Drive/i });
    expect(region).toHaveTextContent(/2 syncing to Google Drive/);
    expect(screen.getAllByText("Syncing to Google Drive").length).toBe(2);
    expect(region.textContent).not.toMatch(/Saved/i);
    expect(screen.getByText(/Edit: lunch/)).toBeInTheDocument(); // edits are marked as edits and show the NEW values
    expect(region.querySelector("[aria-live='polite']")).not.toBeNull(); // changes are announced
  });

  it("a refused edit stays visible with the reason and 'Not saved' (the user's values are not silently dropped)", async () => {
    const e = await edit("k-ref", "t-2");
    await updateQueuedMutation(e.id, { status: "rejected", lastError: "Amount is not valid for this account." });
    render(<PendingTransactionsStrip />);
    expect(await screen.findByText("Not saved")).toBeInTheDocument();
    expect(screen.getByText(/Amount is not valid/)).toBeInTheDocument();
    expect(screen.getByText(/\+?-?₹150|150/)).toBeInTheDocument(); // the values the user submitted
  });

  it("renders nothing when there is nothing pending (no empty frame)", async () => {
    const { container } = render(<PendingTransactionsStrip />);
    await new Promise((r) => setTimeout(r, 30));
    expect(container).toBeEmptyDOMElement();
  });

  it("accept() narrows the strip to what the list below shows", async () => {
    await create("k-inc", "income");
    await create("k-exp", "expense");
    render(<PendingTransactionsStrip accept={(r) => r.type === "INCOME"} />);
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
  });
});

describe("logout guard", () => {
  const getGuard = () => renderHook(useUnsyncedLogoutGuard).result.current; // the hook itself is passed to renderHook (not called inside a callback)

  it("nothing unsynced: signs out without asking", async () => {
    expect(await getGuard()()).toBe(true);
    expect(confirmFn).not.toHaveBeenCalled();
  });

  it("unsynced entries: warns, and 'Stay signed in' keeps the session and keeps syncing", async () => {
    await create("k-lo");
    const f = serverReturning(() => 201);
    confirmFn.mockResolvedValue(false); // user chooses to stay
    expect(await getGuard()()).toBe(false);
    const arg = confirmFn.mock.calls[0][0];
    expect(arg).toMatchObject({ confirmLabel: "Sign out anyway", cancelLabel: "Stay signed in" });
    expect(arg.message).toMatch(/1 change hasn't finished syncing/);
    await waitFor(() => expect(f).toHaveBeenCalled()); // the flush started while the user decided
  });

  it("'Sign out anyway' proceeds, and the entry is preserved under the right account, never sent under another", async () => {
    await create("k-keep2");
    confirmFn.mockResolvedValue(true);
    expect(await getGuard()()).toBe(true);
    // the sign-out itself: owner cleared; then someone else signs in
    await setQueueOwner(null);
    const f = serverReturning(() => 201);
    await requestFlush();
    await setQueueOwner("bob");
    await requestFlush();
    expect(f).not.toHaveBeenCalled();
    expect(await getQueuedMutations()).toHaveLength(1); // preserved
    expect(await countUnsynced("alice")).toBe(1);
    expect(await countUnsynced("bob")).toBe(0);
    await setQueueOwner("alice"); // alice returns
    await requestFlush();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("a refused entry also counts (the user must not lose it by signing out unknowingly)", async () => {
    const c = await create("k-rej");
    await updateQueuedMutation(c.id, { status: "rejected", lastError: "x" });
    expect(await countUnsynced("alice")).toBe(1);
  });

  it("not signed in: never asks", async () => {
    auth.uid = null;
    expect(await countUnsynced(null)).toBe(0);
  });
});

describe("editing a transaction that already has a pending edit", () => {
  it("the form starts from the pending values (newest first), so a second edit cannot silently overwrite the first", async () => {
    await enqueueMutation("expense", "/api/transactions/t-1", { ...body, amount: 150 }, "e1", "PATCH");
    await enqueueMutation("expense", "/api/transactions/t-1", { ...body, amount: 175 }, "e2", "PATCH");
    expect((await pendingEditBody("t-1"))?.amount).toBe(175);
    expect(await pendingEditBody("t-other")).toBeNull();
  });

  it("refused edits and other accounts' edits are not used as a starting point", async () => {
    const e = await enqueueMutation("expense", "/api/transactions/t-2", { ...body, amount: 1 }, "e3", "PATCH");
    await updateQueuedMutation(e.id, { status: "rejected", lastError: "x" });
    expect(await pendingEditBody("t-2")).toBeNull();
    await setQueueOwner("bob");
    await enqueueMutation("expense", "/api/transactions/t-3", { ...body, amount: 9 }, "e4", "PATCH");
    await setQueueOwner("alice");
    expect(await pendingEditBody("t-3")).toBeNull();
  });
});
