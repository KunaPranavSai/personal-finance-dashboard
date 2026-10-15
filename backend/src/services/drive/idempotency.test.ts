import { describe, expect, it, vi } from "vitest";

// An in-memory Google Drive with real latency, so concurrent requests genuinely interleave.
const files = new Map<string, { folder: string; name: string; content: string }>();
let nextId = 1;
const delay = () => new Promise((r) => setTimeout(r, 5));
const emptyManifest = JSON.stringify({ schemaVersion: 1, accountEmail: null, initializedAt: "", updatedAt: "", files: {} });
const stats = { writes: 0 };

vi.mock("./googleDriveClient", () => ({
  DATA_FOLDER_NAME: "Data",
  METADATA_FOLDER_NAME: "Metadata",
  // the "access token" is the user id here, so every user gets a private Drive
  findOrCreateFolder: async (t: string, name: string) => `${t}:${name === "Data" ? "data" : "meta"}`,
  findFile: async (_t: string, folder: string, name: string) => {
    await delay();
    if (name === "manifest.json" && ![...files.values()].some((f) => f.folder === folder && f.name === name)) files.set(`m-${folder}`, { folder, name, content: emptyManifest });
    return [...files].find(([, f]) => f.folder === folder && f.name === name)?.[0] ?? null;
  },
  readFileContent: async (_t: string, id: string) => {
    await delay();
    return files.get(id)!.content;
  },
  upsertFile: async (_t: string, folder: string, name: string, content: string, existing?: string | null) => {
    await delay();
    stats.writes++;
    const id = existing ?? `f${nextId++}`;
    files.set(id, { folder, name, content });
    return id;
  },
  listFileRevisions: async () => [],
  readFileRevisionContent: async () => "",
}));
vi.mock("./connection", () => ({ getAccessTokenForUser: async (userId: string) => ({ connection: { backupFolderId: "root" }, accessToken: userId }) }));

import { createRecord, listRecords } from "./dataService";

const expense = (amount: number) => ({ type: "EXPENSE", amount, date: "2026-10-15", description: "lunch" });

describe("create idempotency (real dataService over an in-memory Drive)", () => {
  it("concurrent requests with the same key create exactly one record", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => createRecord("u-race", "transactions", expense(100), { idempotencyKey: "k1" })));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await listRecords("u-race", "transactions")).toHaveLength(1);
  });

  it("a retry after the response was lost returns the original record, not a second one", async () => {
    const first = await createRecord("u-retry", "transactions", expense(250), { idempotencyKey: "k2" });
    // the client never saw `first`; it sends the identical request again
    const again = await createRecord("u-retry", "transactions", expense(250), { idempotencyKey: "k2" });
    expect(again.id).toBe(first.id);
    expect(await listRecords("u-retry", "transactions")).toHaveLength(1);
  });

  it("same key with a DIFFERENT payload is rejected (409), never silently dropped or duplicated", async () => {
    await createRecord("u-conflict", "transactions", expense(100), { idempotencyKey: "k3" });
    await expect(createRecord("u-conflict", "transactions", expense(999), { idempotencyKey: "k3" })).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_KEY_REUSED" });
    const all = await listRecords("u-conflict", "transactions");
    expect(all).toHaveLength(1);
    expect(all[0].amount).toBe(100);
  });

  it("different keys are different logical records", async () => {
    await Promise.all([createRecord("u-two", "transactions", expense(1), { idempotencyKey: "a" }), createRecord("u-two", "transactions", expense(1), { idempotencyKey: "b" })]);
    expect(await listRecords("u-two", "transactions")).toHaveLength(2);
  });

  it("the same key under another user or collection never collides", async () => {
    const a = await createRecord("u-x", "transactions", expense(5), { idempotencyKey: "shared" });
    const b = await createRecord("u-y", "transactions", expense(5), { idempotencyKey: "shared" });
    const c = await createRecord("u-x", "bills", { name: "rent", amount: 5 } as never, { idempotencyKey: "shared" });
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
  });

  it("without a key, every call creates a record (no accidental dedupe)", async () => {
    await createRecord("u-nokey", "transactions", expense(7));
    await createRecord("u-nokey", "transactions", expense(7));
    expect(await listRecords("u-nokey", "transactions")).toHaveLength(2);
  });
});
