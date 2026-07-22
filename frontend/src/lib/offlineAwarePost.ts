"use client";

import { api, ApiClientError } from "./api";
import { enqueueMutation, type QueuedEntity } from "./offlineQueue";

export interface OfflineAwareResult<T> {
  queued: boolean;
  data?: T;
}

/**
 * POSTs via the normal API client. If that fails because there's no
 * connectivity (rather than the server rejecting the request), queues the
 * mutation in IndexedDB for later sync instead of surfacing an error —
 * used by the Expense/Income/Budget/Investment "add" forms so they keep
 * working offline. A genuine validation/auth error (a response the server
 * actually sent) is rethrown as normal; only silence-and-queue on network
 * failure.
 */
export async function postWithOfflineQueue<T>(
  entity: QueuedEntity,
  path: string,
  body: unknown
): Promise<OfflineAwareResult<T>> {
  try {
    const data = await api.post<T>(path, body);
    return { queued: false, data };
  } catch (err) {
    const isServerRejection = err instanceof ApiClientError;
    if (isServerRejection && navigator.onLine) {
      throw err;
    }
    await enqueueMutation(entity, path, body);
    return { queued: true };
  }
}
