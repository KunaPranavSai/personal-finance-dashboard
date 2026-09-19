"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/format";
import {
  isPwaInstalled,
  canPromptInstall,
  triggerInstallPrompt,
  subscribeToInstallAvailability,
} from "@/lib/pwaInstall";

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return isIOS;
}

function fallbackInstallMessage(): string {
  if (isIOSSafari()) {
    return "To install Penny Pilot, tap the Share icon, then \"Add to Home Screen.\"";
  }
  return "To install Penny Pilot, use your browser's Install App or Add to Home Screen option.";
}

const variantClasses = {
  header: cn(
    "inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition-all hover:bg-navy-dark",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
  ),
  "header-mobile": cn(
    "w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-navy-dark",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
  ),
  hero: cn(
    "inline-flex items-center gap-2 rounded-lg border border-navy/15 bg-transparent px-5 py-2.5 text-sm font-semibold text-navy/70 transition-all hover:bg-black/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/10",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
  ),
};

interface InstallAppButtonProps {
  variant?: keyof typeof variantClasses;
  className?: string;
  /** Hide the "Install App" label text, icon only (space-constrained spots). */
  iconOnly?: boolean;
}

/**
 * Persistent Install App control — always rendered, regardless of install
 * state, per the requirement that the button never disappears. Behavior:
 * - Native prompt available (beforeinstallprompt fired) -> triggers it.
 * - Already installed -> a toast says so, no prompt attempted.
 * - No native prompt exposed (Safari/Firefox/etc.) -> a toast gives
 *   platform-appropriate manual instructions (iOS Safari gets its own copy).
 * Reuses the existing lib/pwaInstall.ts capture/state machine — no new PWA
 * plumbing, no fake install modal.
 */
export function InstallAppButton({ variant = "header", className, iconOnly = false }: InstallAppButtonProps) {
  const { toast } = useToast();
  const [installed, setInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const sync = () => {
      setInstalled(isPwaInstalled());
      setCanInstall(canPromptInstall());
    };
    sync();
    return subscribeToInstallAvailability(sync);
  }, []);

  const handleClick = async () => {
    if (installed) {
      toast("Penny Pilot is already installed.", "info");
      return;
    }
    if (canInstall) {
      const result = await triggerInstallPrompt();
      if (result === "accepted") {
        toast("Penny Pilot installed successfully.", "success");
      } else if (result === "unavailable") {
        toast(fallbackInstallMessage(), "info");
      }
      return;
    }
    toast(fallbackInstallMessage(), "info");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(variantClasses[variant], className)}
      aria-label={installed ? "Penny Pilot is already installed" : "Install Penny Pilot app"}
    >
      <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!iconOnly && <span>Install App</span>}
    </button>
  );
}
