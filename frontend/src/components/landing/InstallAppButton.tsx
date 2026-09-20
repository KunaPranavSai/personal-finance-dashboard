"use client";

import { Download } from "lucide-react";
import { cn } from "@/lib/format";
import { useLoginModal } from "./LoginModalContext";

const variantClasses = {
  header: "inline-flex items-center gap-2 rounded-xl border border-pp-border px-3 py-2 text-sm font-semibold text-pp-text-dim transition-colors hover:bg-pp-surface-2 hover:text-pp-text",
  "header-mobile": "w-full inline-flex items-center justify-center gap-2 rounded-xl border border-pp-border px-4 py-2.5 text-sm font-semibold text-pp-text transition-colors hover:bg-pp-surface-2",
  hero: "inline-flex items-center gap-2 rounded-xl border border-pp-border px-5 py-2.5 text-sm font-semibold text-pp-text-dim transition-colors hover:bg-pp-surface-2 hover:text-pp-text",
};

interface InstallAppButtonProps {
  variant?: keyof typeof variantClasses;
  className?: string;
  /** Hide the "Install App" label text, icon only (space-constrained spots). */
  iconOnly?: boolean;
}

/**
 * Landing-page entry point into the existing login flow, shown as
 * "Install App" — opens LoginModal (the real LoginPageClient, same
 * AuthContext) as an overlay instead of navigating to /login. The actual
 * PWA install prompt is handled separately, automatically, after signing
 * in (see components/pwa/PwaInstallPrompt.tsx, mounted in the authenticated
 * app shell) — this button is never shown there, so no install capability
 * is lost by repurposing it here.
 */
export function InstallAppButton({ variant = "header", className, iconOnly = false }: InstallAppButtonProps) {
  const { openLoginModal } = useLoginModal();

  return (
    <button
      type="button"
      onClick={openLoginModal}
      className={cn(variantClasses[variant], className)}
      aria-label="Install Penny Pilot — sign in to continue"
    >
      <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!iconOnly && <span>Install App</span>}
    </button>
  );
}
