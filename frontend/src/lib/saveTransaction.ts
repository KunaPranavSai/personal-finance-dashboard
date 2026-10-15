import type { QueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "./api";
import { getStorageMode } from "./storage";
import { postWithOfflineQueue } from "./offlineAwarePost";
import { enqueueMutation, getQueueOwner } from "./offlineQueue";
import { requestFlush } from "./offlineSync";
import { createLocalTransaction, updateLocalTransaction } from "./services/transactionsService";
import { errorCodeOf, toUserMessage } from "./errorMessage";
import { invalidateFor } from "./invalidate";
import { startSaveTiming } from "./saveTiming";

/**
 * "Save transaction": what the click waits for, and what it does not.
 *
 * Device-only: the click waits for the IndexedDB commit (milliseconds) and the result is "local": saved on this
 * device, not synced anywhere.
 *
 * Google Drive: the entry is first written to the durable local outbox (IndexedDB, owned by the signed-in account, with
 * its idempotency key), the form is released immediately, and the authoritative write to Drive starts at once in the
 * background worker (offlineSync.requestFlush). The result is "syncing", NOT "saved": the UI says so, and says "saved to
 * Google Drive" only when the server confirms (see OfflineSyncManager). Because the outbox is durable, the save survives
 * reloads, navigation, a closed tab and server restarts; retries reuse the same key, so they cannot create a second record.
 *
 * Fallback: if the outbox isn't ready (no signed-in owner yet), the old direct request is used and the click waits for it.
 */
export type SaveState = "local" | "syncing" | "offline" | "confirmed";

export interface SaveResult {
  /** true = accepted into the outbox, not yet confirmed by Drive (also true when waiting for a connection) */
  queued: boolean;
  state: SaveState;
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
        timing.mark("local-committed");
        result = { queued: false, state: "local", data };
      } else if (getQueueOwner()) {
        await enqueueMutation(kind, editingId ? `/api/transactions/${editingId}` : "/api/transactions", payload, idempotencyKey, editingId ? "PATCH" : "POST");
        timing.mark("queued"); // from here the user has an honest, durable answer: "syncing"
        void requestFlush(); // authoritative write starts NOW, not after any timer
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        result = { queued: true, state: offline ? "offline" : "syncing" };
      } else if (editingId) {
        result = { queued: false, state: "confirmed", data: await api.patch(`/api/transactions/${editingId}`, payload) };
      } else {
        const r = await postWithOfflineQueue(kind, "/api/transactions", payload, idempotencyKey);
        result = r.queued ? { queued: true, state: "offline" } : { queued: false, state: "confirmed", data: r.data };
      }
      timing.mark("persisted");
      timing.end(result.state === "syncing" || result.state === "offline" ? "syncing" : "saved");
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

/** Words for the toast right after Save. Never says "saved" for something Drive hasn't confirmed. */
export function savedMessage(r: SaveResult, label: string, editing: boolean): string {
  if (r.state === "local") return editing ? `${label} updated on this device` : `${label} saved on this device`;
  if (r.state === "offline") return `${label} stored on this device. It will sync when you're back online.`;
  if (r.state === "syncing") return editing ? `Updating ${label.toLowerCase()} in Google Drive…` : `Saving ${label.toLowerCase()} to Google Drive…`;
  return editing ? `${label} updated` : `${label} saved`;
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
