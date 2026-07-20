import { prisma } from "./prisma";

const cache = new Map<string, number>();

/** Load every user's persisted session version into the in-memory cache at server startup. */
export async function initSessionVersion(): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true, sessionVersion: true } });
  for (const u of users) cache.set(u.id, u.sessionVersion);
}

export function getSessionVersion(userId: string): number {
  return cache.get(userId) ?? 0;
}

/** Invalidate every previously issued token for this user by bumping their version. */
export function bumpSessionVersion(userId: string): number {
  const next = (cache.get(userId) ?? 0) + 1;
  cache.set(userId, next);
  prisma.user.update({ where: { id: userId }, data: { sessionVersion: next } }).catch(() => {});
  return next;
}
