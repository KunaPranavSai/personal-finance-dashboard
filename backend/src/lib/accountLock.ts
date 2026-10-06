import { prisma } from "./prisma";

/**
 * Per-account restrictions that must hold on every authenticated request, whatever the client says:
 *  - supervised: a Super Admin placed the account under supervision (login works, the app does not).
 *  - scheduledDeletionAt: the owner scheduled account deletion; the account is closed until reactivated.
 * Read through a tiny cache so this adds no per-request query in steady state; local changes invalidate it at once and
 * other server instances see a change within TTL_MS.
 */
export interface AccountLock { supervised: boolean; supervisedAt: Date | null; scheduledDeletionAt: Date | null }

const TTL_MS = 5_000;
const cache = new Map<string, { at: number; lock: AccountLock }>();

export async function getAccountLock(userId: string): Promise<AccountLock> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.lock;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { supervisedAt: true, scheduledDeletionAt: true, role: true } });
  const lock: AccountLock = {
    // Supervision only ever applies to ordinary user accounts.
    supervised: Boolean(u?.supervisedAt) && u?.role === "USER",
    supervisedAt: u?.supervisedAt ?? null,
    scheduledDeletionAt: u?.scheduledDeletionAt ?? null,
  };
  cache.set(userId, { at: Date.now(), lock });
  return lock;
}

export function invalidateAccountLock(userId: string): void {
  cache.delete(userId);
}

/** The only API paths a supervised account may call: enough to sign in and learn it is supervised. */
export const SUPERVISED_ALLOWED_PATHS = new Set(["/api/auth/me", "/api/auth/refresh", "/api/auth/logout"]);
