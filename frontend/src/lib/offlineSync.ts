"use client";

import { API_BASE_URL } from "./api";
import { getQueuedMutations, removeQueuedMutation, type QueuedMutation } from "./offlineQueue";

export interface SyncResult {
  synced: QueuedMutation[];
  failed: QueuedMutation[];
}

/** Flushes every queued offline mutation against the real API, in the order they were created. */
export async function flushOfflineQueue(): Promise<SyncResult> {
  const queued = await getQueuedMutations();
  const result: SyncResult = { synced: [], failed: [] };

  for (const item of queued) {
    try {
      const res = await fetch(`${API_BASE_URL}${item.path}`, {
        method: item.method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
      });
      if (res.ok) {
        await removeQueuedMutation(item.id);
        result.synced.push(item);
      } else {
        // A real validation/auth error (4xx) — don't keep retrying forever, but leave it
        // queued so the user can see it failed rather than silently dropping their data.
        result.failed.push(item);
      }
    } catch {
      // Still offline or request failed at the network level — stop here, retry next time.
      result.failed.push(item);
      break;
    }
  }

  return result;
}
