import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, listRecords, getRecord, sendPushToUser } = vi.hoisted(() => ({
  db: {
    pushSubscription: { findMany: vi.fn() },
    backupConnection: { findFirst: vi.fn() },
    pushDelivery: { deleteMany: vi.fn(async () => ({})) },
  },
  listRecords: vi.fn(),
  getRecord: vi.fn(),
  sendPushToUser: vi.fn(async (..._a: unknown[]) => ({ accepted: 1, failed: 0, removed: 0 })),
}));
vi.mock("../../lib/prisma", () => ({ prisma: db }));
vi.mock("../drive/dataService", () => ({ listRecords, getRecord }));
vi.mock("./index", () => ({ pushConfigured: () => true, sendPushToUser }));

import { dueBucket, runBillReminders } from "./billReminders";

// 15 Oct 2026, 10:00 IST (= 04:30 UTC)
const NOW = Date.UTC(2026, 9, 15, 4, 30);
const bill = (id: string, due: string, extra: object = {}) => ({ id, name: `Bill ${id}`, dueDate: due, amount: 1000, paidAmount: 0, ...extra });

describe("dueBucket", () => {
  it("fires at 3 days, 1 day and the due day only", () => {
    expect(dueBucket(bill("a", "2026-10-18"), NOW)?.bucket).toBe("d3");
    expect(dueBucket(bill("a", "2026-10-16"), NOW)?.bucket).toBe("d1");
    expect(dueBucket(bill("a", "2026-10-15"), NOW)?.bucket).toBe("d0");
    for (const d of ["2026-10-17", "2026-10-19", "2026-10-14", "2026-12-01"]) expect(dueBucket(bill("a", d), NOW), d).toBeNull();
  });
  it("never reminds for a fully paid or malformed bill", () => {
    expect(dueBucket(bill("a", "2026-10-16", { paidAmount: 1000 }), NOW)).toBeNull();
    expect(dueBucket(bill("a", "not-a-date"), NOW)).toBeNull();
  });
  it("uses the IST calendar day, not UTC", () => {
    const lateIst = Date.UTC(2026, 9, 15, 19, 0); // 00:30 on 16 Oct IST
    expect(dueBucket(bill("a", "2026-10-16"), lateIst)?.bucket).toBe("d0");
  });
});

describe("runBillReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.pushSubscription.findMany.mockResolvedValue([{ userId: "drive-user", categories: {} }]);
    db.backupConnection.findFirst.mockResolvedValue({ id: "c1" });
    getRecord.mockResolvedValue({ notifications: { billReminders: true, reminderFrequency: "daily" } });
    listRecords.mockResolvedValue([bill("1", "2026-10-18"), bill("2", "2026-10-30")]);
  });

  it("sends one reminder per due bill with a stable dedupe key, no amount, and a same-app link", async () => {
    const r = await runBillReminders(NOW);
    expect(r.sent).toBe(1);
    const [userId, m] = sendPushToUser.mock.calls[0] as unknown as [string, { dedupeKey: string; body: string; url: string; kind: string }];
    expect(userId).toBe("drive-user");
    expect(m.dedupeKey).toBe("bill:1:2026-10-18:d3");
    expect(m.kind).toBe("bills");
    expect(m.url).toBe("/bills");
    expect(m.body).not.toMatch(/1000|₹/);
  });

  it("stays silent at night (IST)", async () => {
    await runBillReminders(Date.UTC(2026, 9, 14, 21, 30)); // 03:00 IST
    expect(sendPushToUser).not.toHaveBeenCalled();
    expect(db.pushSubscription.findMany).not.toHaveBeenCalled();
  });

  it("skips device-only users entirely: the server never reads their data", async () => {
    db.backupConnection.findFirst.mockResolvedValue(null);
    await runBillReminders(NOW);
    expect(listRecords).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("honours the user's own preferences (bill reminders off / reminder frequency never)", async () => {
    getRecord.mockResolvedValue({ notifications: { billReminders: false } });
    await runBillReminders(NOW);
    getRecord.mockResolvedValue({ notifications: { billReminders: true, reminderFrequency: "never" } });
    await runBillReminders(NOW);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("skips users whose devices turned the bills category off", async () => {
    db.pushSubscription.findMany.mockResolvedValue([{ userId: "u", categories: { bills: false } }]);
    await runBillReminders(NOW);
    expect(db.backupConnection.findFirst).not.toHaveBeenCalled();
  });

  it("one user's Drive failure does not stop the others", async () => {
    db.pushSubscription.findMany.mockResolvedValue([{ userId: "broken", categories: {} }, { userId: "ok", categories: {} }]);
    listRecords.mockRejectedValueOnce(new Error("drive down")).mockResolvedValueOnce([bill("9", "2026-10-16")]);
    await runBillReminders(NOW);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect((sendPushToUser.mock.calls[0] as unknown as [string])[0]).toBe("ok");
  });
});
