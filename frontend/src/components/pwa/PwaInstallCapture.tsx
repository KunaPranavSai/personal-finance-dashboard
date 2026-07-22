"use client";

import { useEffect } from "react";
import { initPwaInstallCapture } from "@/lib/pwaInstall";

/**
 * Mounted in the root layout so the beforeinstallprompt listener is attached
 * before the user even logs in — the event can fire at any time and is only
 * dispatched once, so we must be listening (and calling preventDefault) from
 * the very first paint even though we don't act on it until after login.
 */
export function PwaInstallCapture() {
  useEffect(() => {
    initPwaInstallCapture();
  }, []);

  return null;
}
