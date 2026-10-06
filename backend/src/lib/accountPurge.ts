import { prisma } from "./prisma";

/**
 * Permanently deletes accounts whose 30-day deletion period has ended. Every user-owned table (wallets, categories,
 * transactions, budgets, investments, bills, goals, notifications, sessions, passkeys, Google Drive connection
 * records, settings, consent, activity rows ...) is removed by the schema's `onDelete: Cascade` relations, which is
 * the same mechanism the admin "delete account" action already relies on. Audit rows about the account survive: the
 * ones where it was only the target are detached (SetNull), and a final "permanently deleted" row is written first.
 * Files already in the user's own Google Drive are never touched.
 *
 * Runs at start-up and then hourly (same lightweight setInterval pattern as the platform-settings refresh).
 */
export async function purgeDueAccounts(): Promise<number> {
  const due = await prisma.user.findMany({
    where: { scheduledDeletionAt: { lte: new Date() }, role: "USER" },
    select: { id: true, uid: true, email: true },
  });
  let deleted = 0;
  for (const u of due) {
    try {
      await prisma.activityLog.create({ data: { event: "account_permanently_deleted", detail: `Account ${u.uid} (${u.email}) permanently deleted after the 30-day deletion period` } });
      await prisma.user.delete({ where: { id: u.id } });
      deleted++;
    } catch (err) {
      console.error(`Could not permanently delete account ${u.uid}:`, err);
    }
  }
  return deleted;
}

export function startAccountPurge(): void {
  const run = () => void purgeDueAccounts().catch((e) => console.error("Account purge failed:", e));
  setTimeout(run, 15_000).unref();
  setInterval(run, 60 * 60 * 1000).unref();
}
