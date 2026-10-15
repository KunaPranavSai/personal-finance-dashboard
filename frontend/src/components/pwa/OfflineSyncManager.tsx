"use client";

import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CloudUpload, WifiOff } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { discardQueued, onFlushResult, requestFlush, retryRejected } from "@/lib/offlineSync";
import { getQueuedMutations, onQueueChange, setQueueOwner, type QueuedMutation } from "@/lib/offlineQueue";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { invalidateFor } from "@/lib/invalidate";
import { recordLate } from "@/lib/saveTiming";
import { DestructiveActionButton } from "@/components/ui/DestructiveActionButton";

const ENTITY_LABEL: Record<string, string> = { expense: "Expense", income: "Income", budget: "Budget", investment: "Investment" };
const RETRY_EVERY_MS = 15_000;

/** "Expense · ₹120 · lunch" for a queued transaction (shown to its owner only, never logged). */
function summary(i: QueuedMutation): string {
  const b = (i.body ?? {}) as { amount?: unknown; description?: unknown };
  const parts = [ENTITY_LABEL[i.entity] ?? i.entity];
  if (typeof b.amount === "number" || typeof b.amount === "string") parts.push(`₹${b.amount}`);
  if (typeof b.description === "string" && b.description) parts.push(b.description.slice(0, 40));
  return parts.join(" · ");
}

/**
 * The status surface for changes that are stored on this device and on their way to Google Drive.
 * - pending items are listed with their real state (syncing / waiting for a connection / retrying), never as "saved";
 * - when Drive confirms, the item disappears, dependent data refreshes and a short "Saved to Google Drive" toast shows;
 * - items the server refused stay listed with the reason, the original entry, and Try again / Discard.
 * The worker itself lives in lib/offlineSync (requestFlush). This component only reflects state and reacts to results.
 */
export function OfflineSyncManager() {
  const [isOffline, setIsOffline] = useState(false);
  const [items, setItems] = useState<QueuedMutation[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const owner = user?.uid ?? null;

  const refresh = useCallback(() => {
    getQueuedMutations().then((all) => setItems(all.filter((i) => !i.owner || i.owner === owner))).catch(() => {});
  }, [owner]);
  const pending = items.filter((i) => i.status !== "rejected");
  const rejected = items.filter((i) => i.status === "rejected");

  // Confirmations arrive here, whichever code started the flush (the Save click, the online event, the retry timer).
  useEffect(() => {
    return onFlushResult((r) => {
      for (const i of r.synced) recordLate(i.entity, "confirmed", Date.now() - Date.parse(i.createdAt));
      for (const i of r.rejected) recordLate(i.entity, "failed", Date.now() - Date.parse(i.createdAt));
      if (r.synced.length > 0) {
        invalidateFor(queryClient, "transaction", "budget", "investment"); // background refresh; a failure here cannot undo the save
        toast(r.synced.length === 1 ? "Saved to Google Drive" : `${r.synced.length} changes saved to Google Drive`, "success");
      }
      if (r.rejected.length > 0) toast(`${r.rejected.length} change${r.rejected.length === 1 ? " was" : "s were"} refused. Open the banner to review.`, "error");
      refresh();
    });
  }, [queryClient, toast, refresh]);

  // Tell the queue (and, through Cache Storage, the service worker) which account is signed in, then send what's waiting.
  useEffect(() => {
    let live = true;
    void setQueueOwner(owner).then(() => {
      if (live && owner) void requestFlush();
    });
    return () => {
      live = false;
    };
  }, [owner]);

  useEffect(() => onQueueChange(refresh), [refresh]);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    refresh();
    const handleOnline = () => {
      setIsOffline(false);
      void requestFlush();
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage({ type: "SET_API_ORIGIN", origin: API_BASE_URL })).catch(() => {});
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "PENNY_PILOT_SYNC_COMPLETE") {
        invalidateFor(queryClient, "transaction", "budget", "investment");
        refresh();
        toast(`${event.data.count} change${event.data.count === 1 ? "" : "s"} saved to Google Drive`, "success");
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleSwMessage);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handleSwMessage);
    };
  }, [refresh, queryClient, toast]);

  // Something is waiting (server slow, briefly unreachable, another tab holds the worker): keep trying. Never a permanent spinner:
  // the timer exists only while items are pending, and a refused item leaves the pending set.
  const hasPending = pending.length > 0;
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(() => {
      if (navigator.onLine) void requestFlush();
    }, RETRY_EVERY_MS);
    return () => clearInterval(t);
  }, [hasPending]);

  if (!isOffline && pending.length === 0 && rejected.length === 0) return null;

  const stateOf = (i: QueuedMutation) => (isOffline ? "Waiting for a connection" : i.lastError ? `Retrying (${i.lastError})` : "Syncing to Google Drive");

  return (
    // One stack for both panels so they can never overlap each other. On phones it sits above the bottom navigation
    // (its height + the device's safe area); from sm: up it is a plain bottom-right card.
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(var(--ppm-nav-total,calc(56px+env(safe-area-inset-bottom,0px)))+88px)] z-[90] mx-auto flex max-w-md flex-col gap-2 sm:bottom-4 sm:left-auto sm:right-4 [&>*]:pointer-events-auto">
      {(isOffline || pending.length > 0) && (
        <div className="rounded-xl border border-pp-border bg-pp-surface p-3 shadow-2xl">
          <button type="button" onClick={() => setReviewOpen((o) => !o)} aria-expanded={reviewOpen} className="flex min-h-[40px] w-full items-center gap-2 text-left text-sm font-medium text-pp-text">
            {isOffline ? <WifiOff className="h-4 w-4 shrink-0 text-turmeric" aria-hidden="true" /> : <CloudUpload className="h-4 w-4 shrink-0 text-pp-accent motion-safe:animate-pulse" aria-hidden="true" />}
            <span role="status">
              {pending.length === 0
                ? "You're offline. Changes you make are kept on this device and sync later."
                : isOffline
                  ? `${pending.length} change${pending.length === 1 ? "" : "s"} waiting for a connection`
                  : `Syncing ${pending.length} change${pending.length === 1 ? "" : "s"} to Google Drive…`}
            </span>
            {pending.length > 0 && <span className="ml-auto text-xs font-semibold text-pp-accent">{reviewOpen ? "Hide" : "Details"}</span>}
          </button>
          {reviewOpen && pending.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-xs">
              {pending.map((i) => (
                <li key={i.id} className="rounded-lg border border-pp-border p-2">
                  <p className="font-semibold text-pp-text">{summary(i)}</p>
                  <p className="text-pp-text-dim">{stateOf(i)}: stored on this device, not yet confirmed by Google Drive</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rejected.length > 0 && (
        <div role="alert" className="rounded-xl border border-pp-critical/40 bg-pp-surface p-3 shadow-2xl">
          <p className="flex min-h-[32px] items-center gap-2 text-sm font-medium text-pp-text">
            <AlertTriangle className="h-4 w-4 shrink-0 text-pp-critical" aria-hidden="true" />
            {rejected.length} change{rejected.length === 1 ? "" : "s"} couldn&apos;t be saved
          </p>
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
            {rejected.map((r) => (
              <li key={r.id} className="rounded-lg border border-pp-border p-2.5 text-xs">
                <p className="font-semibold text-pp-text">{summary(r)}</p>
                <p className="mt-0.5 text-pp-text-dim">{r.lastError ?? "The server refused this change."} Your entry is kept here.</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" className="min-h-[36px] rounded-full border border-pp-border px-3 text-xs font-semibold text-pp-text hover:bg-pp-chip-bg" onClick={async () => { await retryRejected(r.id); void requestFlush(); }}>
                    Try again
                  </button>
                  <DestructiveActionButton label="Discard" pendingLabel="Discarding…" className="!h-9 !min-w-0 !px-3 text-xs" onClick={async () => { await discardQueued(r.id); }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
