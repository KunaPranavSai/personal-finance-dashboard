"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, WifiOff } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { discardQueued, flushOfflineQueue, retryRejected } from "@/lib/offlineSync";
import { countQueuedMutations, getRejectedMutations, setQueueOwner, type QueuedMutation } from "@/lib/offlineQueue";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { invalidateFor } from "@/lib/invalidate";
import { DestructiveActionButton } from "@/components/ui/DestructiveActionButton";

const ENTITY_LABEL: Record<string, string> = { expense: "Expense", income: "Income", budget: "Budget", investment: "Investment" };

/**
 * Offline banner + queue recovery. Handles: an offline indicator, flushing the IndexedDB queue (created when a
 * create fails while offline) as soon as the connection returns, and a review list for items the server
 * definitively refused. The Background Sync registration in offlineQueue.ts covers a closed tab; this covers the
 * same tab regaining connectivity.
 *
 * Safety rules (see lib/offlineSync.ts): only the signed-in account's items are sent, the original idempotency key
 * is reused, nothing is deleted before the server confirms it, and a refused item is kept for the user to decide.
 */
export function OfflineSyncManager() {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [rejected, setRejected] = useState<QueuedMutation[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const syncing = useRef(false);
  const owner = user?.uid ?? null;

  const refresh = useCallback(() => {
    countQueuedMutations().then(setPendingCount).catch(() => {});
    getRejectedMutations().then(setRejected).catch(() => {});
  }, []);

  const sync = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    syncing.current = true;
    try {
      const { synced, rejected: newlyRejected } = await flushOfflineQueue();
      if (synced.length > 0) {
        invalidateFor(queryClient, "transaction", "budget", "investment");
        toast(`Synced ${synced.length} item${synced.length === 1 ? "" : "s"} saved while offline`, "success");
      }
      // One message per newly refused batch, never per retry: retryable problems just keep the banner up.
      if (newlyRejected.length > 0) {
        toast(`${newlyRejected.length} offline change${newlyRejected.length === 1 ? " was" : "s were"} refused by the server. Open the banner to review.`, "error");
      }
    } finally {
      syncing.current = false;
      refresh();
    }
  }, [queryClient, toast, refresh]);

  // Tell the queue (and, through Cache Storage, the service worker) which account is signed in.
  useEffect(() => {
    let live = true;
    void setQueueOwner(owner).then(() => {
      if (live && owner && navigator.onLine) void sync();
    });
    return () => {
      live = false;
    };
  }, [owner, sync]);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    refresh();

    const handleOnline = () => {
      setIsOffline(false);
      void sync();
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Tell the service worker where the API lives, so a Background Sync event firing after this tab has closed knows where to flush.
    navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage({ type: "SET_API_ORIGIN", origin: API_BASE_URL })).catch(() => {});

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "PENNY_PILOT_SYNC_COMPLETE") {
        invalidateFor(queryClient, "transaction", "budget", "investment");
        refresh();
        toast(`Synced ${event.data.count} offline item${event.data.count === 1 ? "" : "s"}`, "success");
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleSwMessage);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handleSwMessage);
    };
  }, [sync, refresh, queryClient, toast]);

  if (!isOffline && pendingCount === 0 && rejected.length === 0) return null;

  return (
    <>
      {(isOffline || pendingCount > 0) && (
        <div role="status" className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 bg-turmeric px-3 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] text-xs font-medium text-white">
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          {isOffline
            ? pendingCount > 0
              ? `You're offline — ${pendingCount} item${pendingCount === 1 ? "" : "s"} will sync automatically when you're back online.`
              : "You're offline — changes you make will be saved and synced automatically."
            : `Syncing ${pendingCount} offline item${pendingCount === 1 ? "" : "s"}…`}
        </div>
      )}

      {rejected.length > 0 && (
        <div className="fixed inset-x-3 bottom-20 z-[91] mx-auto max-w-md rounded-xl border border-pp-border bg-pp-surface p-3 shadow-2xl sm:bottom-4 sm:left-auto sm:right-4">
          <button type="button" onClick={() => setReviewOpen((o) => !o)} aria-expanded={reviewOpen} className="flex w-full min-h-[40px] items-center gap-2 text-left text-sm font-medium text-pp-text">
            <AlertTriangle className="h-4 w-4 shrink-0 text-pp-critical" aria-hidden="true" />
            {rejected.length} change{rejected.length === 1 ? "" : "s"} made offline couldn&apos;t be saved
            <span className="ml-auto text-xs font-semibold text-pp-accent">{reviewOpen ? "Hide" : "Review"}</span>
          </button>
          {reviewOpen && (
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {rejected.map((r) => (
                <li key={r.id} className="rounded-lg border border-pp-border p-2.5 text-xs">
                  <p className="font-semibold text-pp-text">
                    {ENTITY_LABEL[r.entity] ?? r.entity} · {new Date(r.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-pp-text-dim">{r.lastError ?? "The server refused this change."}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="min-h-[36px] rounded-full border border-pp-border px-3 text-xs font-semibold text-pp-text hover:bg-pp-chip-bg"
                      onClick={async () => {
                        await retryRejected(r.id);
                        refresh();
                        void sync();
                      }}
                    >
                      Try again
                    </button>
                    <DestructiveActionButton
                      label="Discard"
                      pendingLabel="Discarding…"
                      className="!h-9 !min-w-0 !px-3 text-xs"
                      onClick={async () => {
                        await discardQueued(r.id);
                        refresh();
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
