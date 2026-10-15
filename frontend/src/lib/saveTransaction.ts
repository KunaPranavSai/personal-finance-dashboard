import type { QueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "./api";
import { getStorageMode } from "./storage";
import { postWithOfflineQueue } from "./offlineAwarePost";
import { createLocalTransaction, updateLocalTransaction } from "./services/transactionsService";
import { errorCodeOf, toUserMessage } from "./errorMessage";
import { invalidateFor } from "./invalidate";
import { startSaveTiming } from "./saveTiming";

/**
 * The critical path of "Save transaction", and nothing else.
 *
 *   validate (form) -> persist (this file) -> confirm -> [after confirmation, not awaited] refresh dependent data
 *
 * - Drive mode: the confirmation is the server's answer, which is sent only after the data file is written in Drive.
 * - Device-only mode: the confirmation is the IndexedDB commit. It is local persistence, not server sync.
 * - Offline (Drive mode, create): the entry is stored in the offline queue and reported as "queued", never "saved".
 * - The same idempotency key is used for every attempt of one logical save, so a retry cannot create a second record;
 *   a second call with a key that is already in flight shares the first call's promise.
 */
export interface SaveResult {
  queued: boolean;
  data?: unknown;
}

const inFlight = new Map<string, Promise<SaveResult>>();

export function persistTransaction(args: {
  payload: Record<string, unknown>;
  editingId?: string;
  idempotencyKey: string;
  kind: "income" | "expense";
}): Promise<SaveResult> {
  const { payload, editingId, idempotencyKey, kind } = args;
  const flightKey = editingId ? `edit:${editingId}` : `new:${idempotencyKey}`;
  const running = inFlight.get(flightKey);
  if (running) {
    startSaveTiming(kind).end("deduped");
    return running; // double click / double submit: one save, one result
  }

  const timing = startSaveTiming(kind);
  const run = (async (): Promise<SaveResult> => {
    try {
      timing.mark("persist-start");
      let result: SaveResult;
      if (getStorageMode() === "local") {
        const data = editingId ? await updateLocalTransaction(editingId, payload) : await createLocalTransaction(payload);
        result = { queued: false, data };
      } else if (editingId) {
        result = { queued: false, data: await api.patch(`/api/transactions/${editingId}`, payload) };
      } else {
        result = await postWithOfflineQueue(kind, "/api/transactions", payload, idempotencyKey);
      }
      timing.mark("persisted");
      timing.end(result.queued ? "queued" : "saved");
      return result;
    } catch (err) {
      timing.end(describeSaveFailure(err).uncertain ? "uncertain" : "failed");
      throw err;
    } finally {
      inFlight.delete(flightKey);
    }
  })();
  inFlight.set(flightKey, run);
  return run;
}

/**
 * After a CONFIRMED save: refresh Home, Activity, Capital, budgets and reports. Fire-and-forget by design. The save is
 * already durable, so a refresh that is slow or fails must never delay or contradict the confirmation.
 */
export function afterConfirmedSave(qc: QueryClient): void {
  try {
    invalidateFor(qc, "transaction");
  } catch {
    /* the next visit refetches anyway */
  }
}

export interface SaveFailure {
  /** The request may have reached the server (timeout / gateway error). Retrying with the same key is safe. */
  uncertain: boolean;
  message: string;
}

export function describeSaveFailure(err: unknown): SaveFailure {
  const timedOut = err instanceof ApiClientError && ((err.status === 0 && errorCodeOf(err) === "NETWORK_TIMEOUT") || err.status === 502 || err.status === 504);
  if (timedOut) {
    return {
      uncertain: true,
      message: "We didn't get a confirmation, so it may or may not have been saved. Your entry is still here: tap Save again and it won't be added twice.",
    };
  }
  return { uncertain: false, message: toUserMessage(err, "Couldn't save this transaction. Your entry is still here: check it and try again.") };
}
