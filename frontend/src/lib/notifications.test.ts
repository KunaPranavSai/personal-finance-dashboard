import { describe, expect, it } from "vitest";
import { dayBucket, groupByDay, notifLabel, type NotificationItem } from "./notifications";

const now = new Date(2026, 9, 15, 12, 0, 0); // 15 Oct 2026, local noon
const n = (id: string, d: Date): NotificationItem => ({ id, type: "security", title: "t", message: "m", read: false, createdAt: d.toISOString() });

describe("notification grouping", () => {
  it("buckets by LOCAL calendar day, not by rolling 24h", () => {
    expect(dayBucket(new Date(2026, 9, 15, 0, 5).toISOString(), now)).toBe("Today");
    expect(dayBucket(new Date(2026, 9, 14, 23, 55).toISOString(), now)).toBe("Yesterday"); // 12h ago, but yesterday
    expect(dayBucket(new Date(2026, 9, 13, 23, 59).toISOString(), now)).toBe("Earlier");
  });

  it("keeps newest-first order inside buckets and drops empty ones", () => {
    const items = [n("a", new Date(2026, 9, 15, 9)), n("b", new Date(2026, 9, 15, 8)), n("c", new Date(2026, 9, 1))];
    const g = groupByDay(items, now);
    expect(g.map((x) => x.label)).toEqual(["Today", "Earlier"]);
    expect(g[0].items.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("future-dated items (clock skew) read as Today, never vanish", () => {
    expect(groupByDay([n("x", new Date(2026, 9, 16, 1))], now)[0].label).toBe("Today");
  });

  it("labels every type the server creates", () => {
    for (const t of ["security", "welcome_tour", "info"]) expect(notifLabel(t)).not.toBe("Notification");
    expect(notifLabel("something_new")).toBe("Notification");
  });
});
