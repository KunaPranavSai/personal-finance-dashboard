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
    let timer: ReturnType<typeof setInterval> | undefined;

    const activate = (w: ServiceWorker | null | undefined) => w?.postMessage({ type: "SKIP_WAITING" });

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
      // A new version already downloaded while the app was closed: this page just loaded and nothing is half-typed, so
      // take it NOW (otherwise an installed phone app keeps running the old version until someone taps "Refresh").
      if (registration.waiting && navigator.serviceWorker.controller) activate(registration.waiting);
      registration.addEventListener("updatefound", () => handleUpdateFound(registration));
      // Look for a new version now, whenever the app comes back to the foreground, and every 30 minutes. (The browser's own
      // check can be up to a day apart, and the old code called update() before the registration was known, so it never ran.)
      registration.update().catch(() => {});
      timer = setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);
    });

    const onVisibility = () => {
      if (!reg) return;
      if (document.visibilityState === "visible") reg.update().catch(() => {});
      // the user switched away: a waiting update can be applied without interrupting anything
      else if (reg.waiting) activate(reg.waiting);
    };
    document.addEventListener("visibilitychange", onVisibility);

    let reloading = false;
    const handleControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      if (timer) clearInterval(timer);
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
