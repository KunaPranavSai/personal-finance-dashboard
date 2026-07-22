"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { flushOfflineQueue } from "@/lib/offlineSync";
import { countQueuedMutations } from "@/lib/offlineQueue";
import { API_BASE_URL } from "@/lib/api";

const INVALIDATE_KEYS = ["transactions", "dashboard-summary", "budgets", "investments", "category-breakdown"];

/**
 * Renders nothing visible except an offline banner. Handles: showing a
 * persistent "you're offline" indicator, and flushing the IndexedDB
 * mutation queue (created by TransactionFormModal / BudgetFormModal /
 * InvestmentModal when a create fails while offline) as soon as the
 * connection returns — the Background Sync API registered in
 * offlineQueue.ts covers the case where the tab is closed, this covers
 * the common case of the same tab regaining connectivity.
 */
export function OfflineSyncManager() {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const syncing = useRef(false);

  const refreshPendingCount = useCallback(() => {
    countQueuedMutations().then(setPendingCount).catch(() => {});
  }, []);

  const sync = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    syncing.current = true;
    try {
      const { synced, failed } = await flushOfflineQueue();
      if (synced.length > 0) {
        INVALIDATE_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
        toast(`Synced ${synced.length} item${synced.length === 1 ? "" : "s"} saved while offline`, "success");
      }
      if (failed.length > 0) {
        toast(`${failed.length} offline item${failed.length === 1 ? "" : "s"} still pending sync`, "error");
      }
    } finally {
      syncing.current = false;
      refreshPendingCount();
    }
  }, [queryClient, toast, refreshPendingCount]);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    refreshPendingCount();

    const handleOnline = () => {
      setIsOffline(false);
      sync();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Tell the service worker where the API lives, so a Background Sync event
    // firing after this tab has closed still knows where to flush the queue.
    navigator.serviceWorker?.ready
      .then((reg) => reg.active?.postMessage({ type: "SET_API_ORIGIN", origin: API_BASE_URL }))
      .catch(() => {});

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "PENNY_PILOT_SYNC_COMPLETE") {
        INVALIDATE_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
        refreshPendingCount();
        toast(`Synced ${event.data.count} offline item${event.data.count === 1 ? "" : "s"}`, "success");
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleSwMessage);

    // Catch anything left queued from a previous session (e.g. tab closed before it could sync).
    if (navigator.onLine) sync();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handleSwMessage);
    };
  }, [sync, refreshPendingCount, queryClient, toast]);

  if (!isOffline && pendingCount === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-medium text-white">
      <WifiOff className="h-3.5 w-3.5" />
      {isOffline
        ? pendingCount > 0
          ? `You're offline — ${pendingCount} item${pendingCount === 1 ? "" : "s"} will sync automatically when you're back online.`
          : "You're offline — changes you make will be saved and synced automatically."
        : `Syncing ${pendingCount} offline item${pendingCount === 1 ? "" : "s"}…`}
    </div>
  );
}
