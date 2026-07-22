"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";
import {
  canPromptInstall,
  isPwaInstalled,
  wasDismissedRecently,
  subscribeToInstallAvailability,
  triggerInstallPrompt,
  dismissInstallPrompt,
} from "@/lib/pwaInstall";

const DELAY_MS = 7000; // within the requested 5-10s window

/**
 * Shows the native install prompt, but only after login (this component is
 * mounted in the (app) shell, which only renders once authenticated), only
 * once conditions allow it, and after a short delay so it doesn't interrupt
 * the first thing the user sees post-login.
 */
export function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (isPwaInstalled() || wasDismissedRecently()) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const maybeShow = () => {
      if (shownRef.current) return;
      if (isPwaInstalled() || wasDismissedRecently()) return;
      if (!canPromptInstall()) return;
      shownRef.current = true;
      setVisible(true);
    };

    // The install event may already have arrived (captured in root layout before login),
    // or may still be pending — cover both by checking now and subscribing for later.
    timer = setTimeout(maybeShow, DELAY_MS);
    const unsubscribe = subscribeToInstallAvailability(() => {
      if (timer === null) maybeShow();
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const handleInstall = async () => {
    const outcome = await triggerInstallPrompt();
    if (outcome !== "unavailable") setVisible(false);
  };

  const handleDismiss = () => {
    dismissInstallPrompt();
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-x-4 bottom-4 z-[95] mx-auto flex max-w-sm items-center gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-navy-dark sm:inset-x-auto sm:right-4"
          role="dialog"
          aria-label="Install Penny Pilot"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal/10">
            <Download className="h-5 w-5 text-teal" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-navy dark:text-white">Install Penny Pilot</p>
            <p className="text-xs text-navy/50 dark:text-white/50">Add it to your home screen for quick, app-like access.</p>
          </div>
          <button
            type="button"
            onClick={handleInstall}
            className="shrink-0 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal/90"
          >
            Install
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="shrink-0 text-navy/40 hover:text-navy dark:text-white/40 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
