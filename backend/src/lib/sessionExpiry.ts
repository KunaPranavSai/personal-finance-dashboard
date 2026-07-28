import { prisma } from "./prisma";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30, no DST

/** The next occurring 00:00 IST strictly after `fromMs`. Used to force a hard
 * daily logout at midnight IST regardless of how recently a session started
 * or was extended. */
export function nextMidnightIST(fromMs: number): number {
  const istNow = fromMs + IST_OFFSET_MS;
  const istMidnight = Math.floor(istNow / 86400000) * 86400000 + 86400000;
  return istMidnight - IST_OFFSET_MS;
}

/** A session's absolute expiry is whichever comes first: its configured
 * per-session timeout, or the next daily IST midnight cutoff. Both login and
 * "Extend Session" recompute this from `fromMs = now`; ordinary silent token
 * refreshes must NOT call this — they carry the existing value forward
 * unchanged so the session timer can never be reset just by reloading the
 * page or the PWA relaunching in the background. */
export function computeSessionExpiry(fromMs: number, timeoutMinutes: number): number {
  return Math.min(fromMs + timeoutMinutes * 60 * 1000, nextMidnightIST(fromMs));
}

export async function getSessionTimeoutMinutes(userId: string): Promise<number> {
  const row = await prisma.appSettings.findUnique({ where: { userId } });
  const data = row?.data as { security?: { sessionTimeout?: number } } | undefined;
  const minutes = Number(data?.security?.sessionTimeout);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
}
