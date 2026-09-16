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
 *
 * `idempotencyKey` should be generated once per user-initiated create
 * attempt by the caller (see `lib/idempotencyKey.ts`) and passed unchanged
 * on every retry of that same attempt — this function forwards it both to
 * the immediate request and, if queued, onto the queued record itself, so a
 * later background sync retry of the same queued item can never create a
 * duplicate even if the original request actually reached the server.
 */
export async function postWithOfflineQueue<T>(
  entity: QueuedEntity,
  path: string,
  body: unknown,
  idempotencyKey: string
): Promise<OfflineAwareResult<T>> {
  try {
    const data = await api.post<T>(path, body, idempotencyKey);
    return { queued: false, data };
  } catch (err) {
    const isServerRejection = err instanceof ApiClientError;
    if (isServerRejection && navigator.onLine) {
      throw err;
    }
    await enqueueMutation(entity, path, body, idempotencyKey);
    return { queued: true };
  }
}
