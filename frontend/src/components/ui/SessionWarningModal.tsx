"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface SessionWarningModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onLogout: () => void;
}

export function SessionWarningModal({ isOpen, onDismiss, onLogout }: SessionWarningModalProps) {
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(60);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onLogout]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-black/5 bg-white shadow-xl dark:border-white/10 dark:bg-navy-dark">
        <div className="flex items-start gap-3 border-b border-black/5 p-6 dark:border-white/10">
          <AlertTriangle className="h-6 w-6 shrink-0 text-amber-500" />
          <div>
            <h2 className="text-lg font-semibold text-navy dark:text-white">Session Expiring Soon</h2>
            <p className="mt-1 text-sm text-navy/60 dark:text-white/60">
              Your session will expire in {timeLeft} seconds due to inactivity.
            </p>
          </div>
        </div>
        <div className="flex gap-3 p-6">
          <Button onClick={onDismiss} variant="secondary" className="flex-1">
            Stay Logged In
          </Button>
          <Button onClick={onLogout} variant="danger" className="flex-1">
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
