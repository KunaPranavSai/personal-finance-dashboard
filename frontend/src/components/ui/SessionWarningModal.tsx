"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface SessionWarningModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onExtend: () => Promise<boolean> | boolean;
  onLogout: () => void;
}

/**
 * Shown only in the critical window (<=15s remaining, see AuthContext's
 * CRITICAL_THRESHOLD_SECONDS). The countdown here is a read-out of the real,
 * server-anchored session timer — this component never runs its own clock
 * or extends anything on its own.
 */
export function SessionWarningModal({ isOpen, secondsRemaining, onExtend, onLogout }: SessionWarningModalProps) {
  const [extending, setExtending] = useState(false);

  if (!isOpen) return null;

  const handleExtend = async () => {
    setExtending(true);
    try {
      await onExtend();
    } finally {
      setExtending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label="Session expiring"
    >
      <div className="w-full max-w-sm rounded-xl border border-red-500/20 bg-white shadow-2xl dark:border-red-500/30 dark:bg-navy-dark">
        <div className="flex items-start gap-3 border-b border-black/5 p-6 dark:border-white/10">
          <AlertTriangle className="h-6 w-6 shrink-0 text-red-500" />
          <div>
            <h2 className="text-lg font-semibold text-navy dark:text-white">Your session is about to expire</h2>
            <p className="mt-1 text-sm text-navy/60 dark:text-white/60">
              You&apos;ll be signed out in <span className="font-semibold tabular-nums text-red-500">{Math.max(0, secondsRemaining)}s</span> unless you extend your session.
            </p>
          </div>
        </div>
        <div className="flex gap-3 p-6">
          <Button onClick={handleExtend} disabled={extending} className="flex-1">
            {extending ? "Extending…" : "Extend Session"}
          </Button>
          <Button onClick={onLogout} variant="danger" className="flex-1" disabled={extending}>
            Logout Now
          </Button>
        </div>
      </div>
    </div>
  );
}
