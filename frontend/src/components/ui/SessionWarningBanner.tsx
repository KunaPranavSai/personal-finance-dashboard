"use client";

import { Clock } from "lucide-react";

/** The yellow 30-16s stage. The red 15-0s stage is SessionWarningModal (full-screen), not this. */
export function SessionWarningBanner({ visible, secondsRemaining }: { visible: boolean; secondsRemaining: number }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-medium text-white">
      <Clock className="h-3.5 w-3.5" />
      Your session will expire soon — {Math.max(0, secondsRemaining)}s remaining.
    </div>
  );
}
