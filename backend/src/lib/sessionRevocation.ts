import { prisma } from "./prisma";

/**
 * In-memory cache of revoked Session ids, mirroring the pattern in sessionVersion.ts so that
 * per-request enforcement (authenticate() in middleware/auth.ts) never needs a DB round-trip on
 * the hot path. Populated at boot from any already-revoked rows, and updated synchronously
 * whenever admin.routes.ts revokes a session (single revoke or force-logout's revoke-all).
 */
const revoked = new Set<string>();

/** Load already-revoked session ids at server startup. */
export async function initSessionRevocations(): Promise<void> {
  const rows = await prisma.session.findMany({ where: { revokedAt: { not: null } }, select: { id: true } });
  for (const r of rows) revoked.add(r.id);
}

export function isSessionRevoked(sessionId: string): boolean {
  return revoked.has(sessionId);
}

export function markSessionRevoked(sessionId: string): void {
  revoked.add(sessionId);
}

export function markSessionsRevoked(sessionIds: string[]): void {
  for (const id of sessionIds) revoked.add(id);
}
