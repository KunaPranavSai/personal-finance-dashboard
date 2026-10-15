import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for IndexedDB: the rule under test is in LocalStorageProvider.remove, not in idb.
const store: Record<string, Record<string, Record<string, unknown>>> = {};
vi.mock("./localDb", () => ({
  isLocalStorageAvailable: () => true,
  idbGetAll: async (c: string) => Object.values(store[c] ?? {}),
  idbGet: async (c: string, id: string) => store[c]?.[id],
  idbPut: async (c: string, r: { id: string }) => void ((store[c] ??= {})[r.id] = r),
  idbDelete: async (c: string, id: string) => void delete store[c]?.[id],
  idbReplaceAll: async () => {},
}));

import { LocalStorageProvider } from "./localStorageProvider";

const put = (c: string, r: { id: string; [k: string]: unknown }) => void ((store[c] ??= {})[r.id] = r);

describe("local mode delete keeps the same dependency rule as the Drive backend", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });

  it("refuses to delete a wallet that transactions point at, and keeps both records", async () => {
    put("accounts", { id: "w1" });
    put("transactions", { id: "t1", accountId: "w1" });
    const out = await new LocalStorageProvider().remove("accounts", "w1");
    expect(out.status).toBe("failure");
    expect(out.status === "failure" && out.message).toMatch(/1 linked transaction/);
    expect(store.accounts.w1).toBeDefined();
    expect(store.transactions.t1).toBeDefined();
  });

  it("deletes an unused wallet", async () => {
    put("accounts", { id: "w2" });
    put("transactions", { id: "t1", accountId: "other" });
    expect((await new LocalStorageProvider().remove("accounts", "w2")).status).toBe("success");
    expect(store.accounts.w2).toBeUndefined();
  });

  it("applies the same rule to money sources, and never to unrelated collections", async () => {
    put("paymentMethods", { id: "p1" });
    put("transactions", { id: "t1", paymentMethodTypeId: "p1" });
    expect((await new LocalStorageProvider().remove("paymentMethods", "p1")).status).toBe("failure");
    put("goals", { id: "g1" });
    expect((await new LocalStorageProvider().remove("goals", "g1")).status).toBe("success");
  });

  it("categories: blocked while transactions OR budgets use them, with both counts in the message", async () => {
    put("categories", { id: "c1" });
    put("transactions", { id: "t1", categoryId: "c1" });
    put("budgets", { id: "b1", categoryId: "c1" });
    const out = await new LocalStorageProvider().remove("categories", "c1");
    expect(out.status).toBe("failure");
    expect(out.status === "failure" && out.message).toMatch(/1 linked transaction\(s\) and 1 linked budget\(s\)/);
    expect(store.categories.c1).toBeDefined();
  });

  it("categories: an unused category can be deleted", async () => {
    put("categories", { id: "c2" });
    put("transactions", { id: "t1", categoryId: "other" });
    expect((await new LocalStorageProvider().remove("categories", "c2")).status).toBe("success");
  });
});
