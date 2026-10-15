"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Share, X } from "lucide-react";
import {
  installSupport,
  isPwaInstalled,
  wasDismissedRecently,
  subscribeToInstallAvailability,
  triggerInstallPrompt,
  dismissInstallPrompt,
} from "@/lib/pwaInstall";

const DELAY_MS = 4000;

/**
 * Install nudge shown at EVERY sign-in from a browser (this component lives in the authenticated shell,
 * which mounts fresh after login). It never shows inside the installed app. Dismissing hides it for the
 * rest of this login only (sessionStorage, wiped on logout).
 * - Chromium/Android: the real native install prompt.
 * - iPhone/iPad Safari: there is no install API, so it shows the Share > Add to Home Screen steps
 *   (which is also the only way iOS can receive web push).
 */
export function PwaInstallPrompt() {
  const [mode, setMode] = useState<null | "prompt" | "ios">(null);

  useEffect(() => {
    if (isPwaInstalled() || wasDismissedRecently()) return;
    let ready = false;
    const evaluate = () => {
      if (!ready || isPwaInstalled() || wasDismissedRecently()) return;
      const s = installSupport();
      if (s === "prompt" || s === "ios") setMode(s);
      else setMode(null);
    };
    const t = setTimeout(() => {
      ready = true;
      evaluate();
    }, DELAY_MS);
    // beforeinstallprompt can land after the delay; re-evaluate when it does
    const unsubscribe = subscribeToInstallAvailability(evaluate);
    return () => {
      clearTimeout(t);
      unsubscribe();
    };
  }, []);

  const handleInstall = async () => {
    const outcome = await triggerInstallPrompt();
    if (outcome !== "unavailable") setMode(null);
  };
  const handleDismiss = () => {
    dismissInstallPrompt();
    setMode(null);
  };

  return (
    <AnimatePresence>
      {mode && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-x-4 top-[calc(env(safe-area-inset-top,0px)+4rem)] z-[95] mx-auto flex max-w-sm items-center gap-3 rounded-xl border border-pp-border bg-pp-surface p-4 shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto"
          role="dialog"
          aria-label="Install Penny Pilot"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pp-accent/10">
            {mode === "ios" ? <Share className="h-5 w-5 text-pp-accent" /> : <Download className="h-5 w-5 text-pp-accent" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-pp-text">Install Penny Pilot</p>
            <p className="text-xs text-pp-text-dim">
              {mode === "ios"
                ? "Tap the Share button, then “Add to Home Screen”. Notifications need the installed app on iPhone."
                : "Add it to your home screen for app-like access and push notifications."}
            </p>
          </div>
          {mode === "prompt" && (
            <button type="button" onClick={handleInstall} className="min-h-[36px] shrink-0 rounded-lg bg-pp-accent px-3 py-1.5 text-xs font-semibold text-pp-accent-ink hover:brightness-110">
              Install
            </button>
          )}
          <button type="button" onClick={handleDismiss} aria-label="Dismiss" className="shrink-0 p-1 text-pp-text-dim hover:text-pp-text">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
