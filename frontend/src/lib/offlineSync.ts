"use client";

import { API_BASE_URL } from "./api";
import { getQueueOwner, getQueuedMutations, removeQueuedMutation, updateQueuedMutation, type QueuedMutation } from "./offlineQueue";

export interface SyncResult {
  synced: QueuedMutation[];
  /** will be retried later (offline, server trouble, rate limit, expired session) */
  retryLater: QueuedMutation[];
  /** newly refused by the server in THIS run (validation / conflict). Kept for the user to review. */
  rejected: QueuedMutation[];
  authExpired: boolean;
  /** items belonging to a different account: left untouched, never sent */
  otherAccount: number;
}

export const MAX_ATTEMPTS = 10;

/** What a server response means for a queued create. Pure, so it is unit-tested. */
export function classifyStatus(status: number): "ok" | "auth" | "retry" | "reject" {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401) return "auth"; // session expired: stop, the login flow handles it; nothing is dropped
  if (status === 403 || status === 408 || status === 425 || status === 429 || status >= 500) return "retry"; // 403 may be a pending 2-step re-check
  return "reject"; // 400, 404, 409 (incl. idempotency-key conflict), 413, 422: this exact request will never succeed
}

async function reasonFrom(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return body.error ?? body.message ?? `The server refused it (${res.status}).`;
  } catch {
    return `The server refused it (${res.status}).`;
  }
}

/**
 * Flushes the signed-in account's queued offline creates, oldest first.
 * - Order is preserved: the first retryable failure stops the run.
 * - The original idempotency key is reused, so a retry after a lost response cannot create a second record.
 * - A definitive refusal marks that item "rejected" (kept, with the reason) and the run continues.
 * - Nothing is ever deleted except after the server confirmed it.
 */
export async function flushOfflineQueue(): Promise<SyncResult> {
  const owner = getQueueOwner();
  const result: SyncResult = { synced: [], retryLater: [], rejected: [], authExpired: false, otherAccount: 0 };
  if (!owner) return result; // not signed in as anyone: send nothing

  for (const item of await getQueuedMutations()) {
    // A run can outlive a sign-out: re-check who is signed in before EVERY send, so the rest of this account's queue is
    // never sent with the next person's session.
    if (getQueueOwner() !== owner) break;
    if (item.status === "rejected") continue;
    if (item.owner && item.owner !== owner) {
      result.otherAccount++;
      continue;
    }
    if (!item.owner) await updateQueuedMutation(item.id, { owner }); // written before accounts were tracked: the account syncing it adopts it

    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${item.path}`, {
        method: item.method,
        credentials: "include",
        headers: { "Content-Type": "application/json", "Idempotency-Key": item.idempotencyKey },
        body: JSON.stringify(item.body),
      });
    } catch {
      // unreachable: stop, try again later. While online this is worth telling the user (offline needs no message)
      if (typeof navigator === "undefined" || navigator.onLine) await updateQueuedMutation(item.id, { lastError: "Couldn't reach the server" });
      result.retryLater.push(item);
      break;
    }

    const kind = classifyStatus(res.status);
    if (kind === "ok") {
      const serverId = await res.json().then((b: { id?: unknown }) => (typeof b?.id === "string" ? b.id : undefined)).catch(() => undefined);
      await removeQueuedMutation(item.id);
      result.synced.push({ ...item, serverId });
    } else if (kind === "auth") {
      result.authExpired = true;
      result.retryLater.push(item);
      break;
    } else if (kind === "retry") {
      const attempts = (item.attempts ?? 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        const lastError = `Could not be saved after ${attempts} attempts.`;
        await updateQueuedMutation(item.id, { attempts, status: "rejected", lastError });
        result.rejected.push({ ...item, attempts, status: "rejected", lastError });
        continue;
      }
      await updateQueuedMutation(item.id, { attempts, lastError: `The server is busy or unavailable (${res.status})` });
      result.retryLater.push({ ...item, attempts });
      break;
    } else {
      const lastError = await reasonFrom(res);
      await updateQueuedMutation(item.id, { status: "rejected", lastError });
      result.rejected.push({ ...item, status: "rejected", lastError });
    }
  }
  return result;
}

/** User chose to try a rejected item again (e.g. after fixing what the server complained about elsewhere). */
export const retryRejected = (id: string) => updateQueuedMutation(id, { status: "pending", attempts: 0, lastError: undefined });
export const discardQueued = (id: string) => removeQueuedMutation(id);

// ─── Background worker: one at a time, in this tab and across tabs ─────────────────────────────────────────────
// Saves are written to the durable queue first and sent from here immediately. Everything that sends queued items goes
// through requestFlush(), so a second trigger (online event, retry timer, another save) never starts a second worker.
// Across tabs the Web Locks API does the same; if two workers ever did overlap, the server's idempotency key still
// prevents a duplicate record.
type FlushListener = (r: SyncResult) => void;
const flushListeners = new Set<FlushListener>();
/** Called with every non-empty flush result: the one place that toasts, refreshes data and records timings. */
export const onFlushResult = (cb: FlushListener) => (flushListeners.add(cb), () => void flushListeners.delete(cb));

const empty = (): SyncResult => ({ synced: [], retryLater: [], rejected: [], authExpired: false, otherAccount: 0 });
let running: Promise<void> | null = null;
let again = false;

async function lockedFlush(): Promise<SyncResult> {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (!locks) return flushOfflineQueue();
  const r = await locks.request("pp-offline-flush", { ifAvailable: true }, async (lock) => (lock ? flushOfflineQueue() : null));
  return r ?? empty(); // another tab is flushing right now
}

export function requestFlush(): Promise<void> {
  if (running) {
    again = true; // something was queued while a run was in progress: go around once more
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        const r = await lockedFlush();
        if (r.synced.length || r.rejected.length || r.retryLater.length || r.authExpired) {
          // a listener that throws (e.g. a failed background refresh) must never stop the worker or lose a confirmation
          for (const cb of flushListeners) {
            try {
              cb(r);
            } catch {
              /* ignore */
            }
          }
        }
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}
