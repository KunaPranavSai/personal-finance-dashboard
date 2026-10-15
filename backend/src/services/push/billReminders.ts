import { prisma } from "../../lib/prisma";
import { getRecord, listRecords } from "../drive/dataService";
import { pushConfigured, sendPushToUser } from "./index";

/**
 * Bill/EMI reminders by push, for Google Drive users only.
 *
 * Why Drive only: the server can read a bill only if it lives in the user's Drive workspace. Device-only
 * users' bills are in their browser's IndexedDB, which the server cannot see (and must not be sent), so
 * they get no server-scheduled reminders. That is a deliberate privacy boundary, not a bug.
 *
 * A reminder is a reminder: it never marks anything paid. The payload names the bill and due date but
 * carries no amount (lock screens are public).
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // ponytail: fixed IST (the product default); per-user timezone when settings expose it to the server
const DAY_MS = 86_400_000;
const SEND_HOURS = { from: 8, to: 20 }; // local hours; no 3 a.m. buzz

const istDay = (ms: number) => Math.floor((ms + IST_OFFSET_MS) / DAY_MS);
const istHour = (ms: number) => new Date(ms + IST_OFFSET_MS).getUTCHours();

type Bill = { id: string; name?: unknown; type?: unknown; dueDate?: unknown; amount?: unknown; paidAmount?: unknown };

export function dueBucket(bill: Bill, now: number): { bucket: "d3" | "d1" | "d0"; days: number } | null {
  const due = Date.parse(String(bill.dueDate));
  if (Number.isNaN(due)) return null;
  if (Number(bill.amount) - Number(bill.paidAmount ?? 0) <= 0) return null; // fully paid
  const days = istDay(due) - istDay(now);
  return days === 3 ? { bucket: "d3", days } : days === 1 ? { bucket: "d1", days } : days === 0 ? { bucket: "d0", days } : null;
}

const when = (days: number) => (days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);

export async function runBillReminders(now = Date.now()): Promise<{ users: number; sent: number }> {
  const out = { users: 0, sent: 0 };
  if (!pushConfigured()) return out;
  const h = istHour(now);
  if (h < SEND_HOURS.from || h >= SEND_HOURS.to) return out;

  const rows = await prisma.pushSubscription.findMany({ select: { userId: true, categories: true } });
  const users = [...new Set(rows.filter((r) => (r.categories as Record<string, unknown>)?.bills !== false).map((r) => r.userId))];

  for (const userId of users) {
    try {
      const drive = await prisma.backupConnection.findFirst({ where: { userId, backupFolderId: { not: null } }, select: { id: true } });
      if (!drive) continue; // device-only (or Drive not set up): the server cannot see bills
      const settings = await getRecord(userId, "settings", "app_settings");
      const n = (settings?.notifications ?? {}) as Record<string, unknown>;
      if (n.billReminders === false || n.reminderFrequency === "never") continue;

      out.users++;
      for (const bill of await listRecords<Bill & { createdAt: string; updatedAt: string }>(userId, "bills")) {
        const due = dueBucket(bill, now);
        if (!due) continue;
        const day = new Date(Date.parse(String(bill.dueDate))).toISOString().slice(0, 10);
        const label = String(bill.name || bill.type || "Bill");
        const r = await sendPushToUser(userId, {
          kind: "bills",
          title: `Bill due ${when(due.days)}`,
          body: `${label} · due ${day}`,
          url: "/bills",
          tag: `bill-${bill.id}`,
          dedupeKey: `bill:${bill.id}:${day}:${due.bucket}`,
        });
        out.sent += r.accepted;
      }
    } catch (err) {
      console.error("Bill reminders skipped for a user:", (err as Error).message); // never log records
    }
  }
  // keep the ledger small: reminders older than 90 days can never be re-sent anyway
  await prisma.pushDelivery.deleteMany({ where: { createdAt: { lt: new Date(now - 90 * DAY_MS) } } }).catch(() => {});
  return out;
}

export function startBillReminders() {
  const tick = () => void runBillReminders().catch((e) => console.error("Bill reminder run failed:", (e as Error).message));
  setTimeout(tick, 2 * 60 * 1000).unref(); // first pass shortly after boot
  setInterval(tick, 60 * 60 * 1000).unref();
}
