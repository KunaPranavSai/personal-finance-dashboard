"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * Detects a waiting (installed-but-not-yet-active) service worker — i.e. a
 * new deployed version — and prompts the user to refresh instead of
 * silently taking over the tab. next.config.ts sets `skipWaiting: false`
 * specifically so this prompt has something to show instead of the new
 * version applying itself mid-session.
 */
export function ServiceWorkerUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | undefined;

    const handleUpdateFound = (registration: ServiceWorkerRegistration) => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(installing);
        }
      });
    };

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return;
      reg = registration;
      if (registration.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(registration.waiting);
      }
      registration.addEventListener("updatefound", () => handleUpdateFound(registration));
    });

    let reloading = false;
    const handleControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    // Check for an update once per session load — catches the case where the
    // tab was already open when a new version was deployed.
    reg?.update().catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  }, [waitingWorker]);

  if (!waitingWorker || dismissed) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-sm items-center gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-navy-dark sm:inset-x-auto sm:right-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal/10">
        <RefreshCw className="h-4 w-4 text-teal" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-navy dark:text-white">Update available</p>
        <p className="text-xs text-navy/50 dark:text-white/50">Refresh to get the latest version of Penny Pilot.</p>
      </div>
      <button
        type="button"
        onClick={applyUpdate}
        className="shrink-0 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal/90"
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-navy/40 hover:text-navy dark:text-white/40 dark:hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
