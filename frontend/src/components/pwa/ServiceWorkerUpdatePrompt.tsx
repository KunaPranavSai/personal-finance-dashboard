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
    <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-sm items-center gap-3 rounded-xl border border-pp-border bg-pp-surface p-4 shadow-2xl dark:bg-pp-surface sm:inset-x-auto sm:right-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pp-accent/10">
        <RefreshCw className="h-4 w-4 text-pp-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-pp-text">Update available</p>
        <p className="text-xs text-pp-text-dim">Refresh to get the latest version of Penny Pilot.</p>
      </div>
      <button
        type="button"
        onClick={applyUpdate}
        className="shrink-0 rounded-lg bg-pp-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-pp-accent/90"
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-pp-text-dim hover:text-pp-text/40 dark:hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
