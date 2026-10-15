import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory Drive with a per-call delay and switchable failures.
const files = new Map<string, { folder: string; name: string; content: string }>();
let nextId = 1;
const drive = { delay: 5, calls: 0, failNext: null as null | { match: string; times: number } };
const emptyManifest = JSON.stringify({ schemaVersion: 1, accountEmail: null, initializedAt: "", updatedAt: "", files: {} });
const wait = async () => {
  drive.calls++;
  await new Promise((r) => setTimeout(r, drive.delay));
};

vi.mock("./googleDriveClient", () => ({
  DATA_FOLDER_NAME: "Data",
  METADATA_FOLDER_NAME: "Metadata",
  findOrCreateFolder: async (t: string, name: string) => `${t}:${name === "Data" ? "data" : "meta"}`,
  findFile: async (_t: string, folder: string, name: string) => {
    await wait();
    if (name === "manifest.json" && ![...files.values()].some((f) => f.folder === folder && f.name === name)) files.set(`m-${folder}`, { folder, name, content: emptyManifest });
    return [...files].find(([, f]) => f.folder === folder && f.name === name)?.[0] ?? null;
  },
  readFileContent: async (_t: string, id: string) => (await wait(), files.get(id)!.content),
  upsertFile: async (_t: string, folder: string, name: string, content: string, existing?: string | null) => {
    await wait();
    if (drive.failNext && name.includes(drive.failNext.match) && drive.failNext.times > 0) {
      drive.failNext.times--;
      throw new Error("drive unavailable");
    }
    const id = existing ?? `f${nextId++}`;
    files.set(id, { folder, name, content });
    return id;
  },
  listFileRevisions: async () => [],
  readFileRevisionContent: async () => "",
}));
vi.mock("./connection", () => ({ getAccessTokenForUser: async (userId: string) => ({ connection: { backupFolderId: "root" }, accessToken: userId }) }));

import { createRecord, deleteRecord, invalidateAllCachesForUser, listRecords, saveTrace, updateRecord } from "./dataService";

const tx = (amount: number) => ({ type: "EXPENSE", amount, date: "2026-10-15", description: "lunch", categoryId: "c1" });
let n = 0;
const freshUser = async () => {
  const u = `save-${++n}`;
  await createRecord(u, "transactions", tx(1)); // existing user: the transactions file already exists
  return u;
};
const stored = (u: string) => [...files.values()].find((f) => f.folder === `${u}:data` && f.name.startsWith("transactions"));

beforeEach(() => {
  drive.delay = 5;
  drive.failNext = null;
});

describe("critical save path", () => {
  it("fast save: with warm caches it takes ONE parallel round trip (2 Drive calls, no re-read)", async () => {
    const u = await freshUser();
    drive.delay = 40;
    drive.calls = 0;
    const t0 = performance.now();
    await createRecord(u, "transactions", tx(2), { idempotencyKey: "k-fast" });
    const ms = performance.now() - t0;
    expect(drive.calls).toBe(2); // data file + manifest, concurrently
    expect(ms).toBeLessThan(40 * 1.8); // sequential would be >= 120ms (read + file + manifest)
  });

  it("slow persistence is still confirmed only after the data file is written", async () => {
    const u = await freshUser();
    drive.delay = 120;
    const p = createRecord(u, "transactions", tx(3), { idempotencyKey: "k-slow" });
    let done = false;
    void p.then(() => (done = true));
    await new Promise((r) => setTimeout(r, 40));
    expect(done).toBe(false); // not confirmed while Drive is still working
    const rec = await p;
    expect(JSON.parse(stored(u)!.content).records.some((r: { id: string }) => r.id === rec.id)).toBe(true); // durable at the moment of confirmation
  });

  it("Drive failure: the save rejects, nothing phantom is left in the cache or the file", async () => {
    const u = await freshUser();
    drive.failNext = { match: "transactions", times: 1 };
    await expect(createRecord(u, "transactions", tx(4), { idempotencyKey: "k-fail" })).rejects.toThrow(/drive unavailable/);
    const after = await listRecords(u, "transactions");
    expect(after).toHaveLength(1); // only the seed record
    // and the retry with the SAME key succeeds exactly once
    const ok = await createRecord(u, "transactions", tx(4), { idempotencyKey: "k-fail" });
    expect(await listRecords(u, "transactions")).toHaveLength(2);
    expect(ok.amount).toBe(4);
  });

  it("uncertain outcome: data file written but the response path failed -> the retry returns the SAME record (no duplicate)", async () => {
    const u = await freshUser();
    drive.failNext = { match: "manifest", times: 1 }; // file reaches Drive, manifest write fails, request errors out
    await expect(createRecord(u, "transactions", tx(5), { idempotencyKey: "k-uncertain" })).rejects.toThrow();
    expect(JSON.parse(stored(u)!.content).records).toHaveLength(2); // it DID persist
    const retry = await createRecord(u, "transactions", tx(5), { idempotencyKey: "k-uncertain" });
    const all = await listRecords(u, "transactions");
    expect(all).toHaveLength(2);
    expect(all.filter((r) => r.amount === 5)).toHaveLength(1);
    expect(retry.id).toBe(all.find((r) => r.amount === 5)!.id);
  });

  it("the retry is recognised even after a server restart (key stored with the record, not only in memory)", async () => {
    const u = await freshUser();
    const first = await createRecord(u, "transactions", tx(6), { idempotencyKey: "k-restart" });
    vi.resetModules();
    const fresh = await import("./dataService"); // new process: empty in-memory idempotency cache
    const again = await fresh.createRecord(u, "transactions", tx(6), { idempotencyKey: "k-restart" });
    expect(again.id).toBe(first.id);
    expect(await fresh.listRecords(u, "transactions")).toHaveLength(2);
    await expect(fresh.createRecord(u, "transactions", tx(7), { idempotencyKey: "k-restart" })).rejects.toMatchObject({ status: 409 });
  });

  it("internal idempotency markers never reach callers", async () => {
    const u = await freshUser();
    const rec = await createRecord(u, "transactions", tx(8), { idempotencyKey: "k-strip" });
    expect(rec).not.toHaveProperty("_idem");
    expect((await listRecords(u, "transactions")).every((r) => !("_idem" in r))).toBe(true);
  });

  it("update and delete reuse the same fast path and keep the idempotency marker intact", async () => {
    const u = await freshUser();
    const rec = await createRecord(u, "transactions", tx(9), { idempotencyKey: "k-ud" });
    await updateRecord(u, "transactions", rec.id, { amount: 10 });
    expect(JSON.parse(stored(u)!.content).records.find((r: { id: string }) => r.id === rec.id)._idem.k).toBe("k-ud");
    expect(await deleteRecord(u, "transactions", rec.id)).toBe(true);
  });

  it("a read after the cache is dropped reflects Drive (the cache is an optimisation, not the source of truth)", async () => {
    const u = await freshUser();
    await createRecord(u, "transactions", tx(11));
    invalidateAllCachesForUser(u);
    expect(await listRecords(u, "transactions")).toHaveLength(2);
  });
});

describe("save timing diagnostics", () => {
  it("reports phase names and durations only, never record contents", async () => {
    const u = await freshUser();
    const seen: [string, number][] = [];
    await saveTrace.run((name, ms) => seen.push([name, ms]), () => createRecord(u, "transactions", { ...tx(12), description: "SECRET-DESCRIPTION" }, { idempotencyKey: "k-trace" }));
    const names = seen.map(([n]) => n);
    expect(names).toEqual(expect.arrayContaining(["token", "folders", "load", "write-file", "write-manifest"]));
    expect(JSON.stringify(seen)).not.toMatch(/SECRET|lunch|amount/);
    expect(seen.every(([, ms]) => typeof ms === "number" && ms >= 0)).toBe(true);
  });
});
