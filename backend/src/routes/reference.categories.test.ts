import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const { store, deleted } = vi.hoisted(() => ({ store: {} as Record<string, Record<string, unknown>[]>, deleted: [] as string[] }));
vi.mock("../middleware/auth", () => ({ requireDriveConnected: (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../services/drive/dataService", () => ({
  listRecords: async (_u: string, c: string) => store[c] ?? [],
  getRecord: async (_u: string, c: string, id: string) => (store[c] ?? []).find((r) => r.id === id) ?? null,
  deleteRecord: async (_u: string, c: string, id: string) => void deleted.push(`${c}:${id}`),
  createRecord: vi.fn(),
  updateRecord: vi.fn(),
}));

import router from "./reference.routes";
import { errorHandler } from "../middleware/errorHandler";

let server: Server;
let base = "";
beforeAll(() => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = { userId: "u1" } as never;
    next();
  });
  app.use("/api", router);
  app.use(errorHandler);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());
beforeEach(() => {
  deleted.length = 0;
  for (const k of Object.keys(store)) delete store[k];
  store.categories = [{ id: "used", name: "Food" }, { id: "budgeted", name: "Fun" }, { id: "free", name: "Misc" }];
  store.transactions = [{ id: "t1", categoryId: "used" }];
  store.budgets = [{ id: "b1", categoryId: "budgeted" }];
  store.accounts = [{ id: "w1" }];
});

const del = (path: string) => fetch(base + path, { method: "DELETE" });

describe("DELETE /api/categories/:id", () => {
  it("is refused while a transaction uses the category, and nothing is deleted", async () => {
    const res = await del("/categories/used");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "RECORD_IN_USE" });
    expect(deleted).toEqual([]);
  });
  it("is refused while a budget uses the category", async () => {
    expect((await del("/categories/budgeted")).status).toBe(400);
    expect(deleted).toEqual([]);
  });
  it("deletes an unused category", async () => {
    expect((await del("/categories/free")).status).toBe(200);
    expect(deleted).toEqual(["categories:free"]);
  });
  it("404 for an unknown category", async () => {
    expect((await del("/categories/nope")).status).toBe(404);
  });
});

describe("DELETE /api/accounts/:id", () => {
  it("is refused when transactions point at the wallet", async () => {
    store.transactions = [{ id: "t1", categoryId: "x", accountId: "w1" }];
    const res = await del("/accounts/w1");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error?: string }).error ?? "").toMatch(/Reassign or remove them first/);
    expect(deleted).toEqual([]);
  });
});
