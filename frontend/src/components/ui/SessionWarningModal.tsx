"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface SessionWarningModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  totalSeconds: number;
  onStayLoggedIn: () => void;
  onLogoutNow: () => void;
}

function formatCountdown(seconds: number): string {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * Shown WARNING_SECONDS before the user's configured inactivity timeout
 * expires (see SessionManager). Any further activity (mouse/keyboard/touch/
 * scroll/route change/API call) resets the inactivity timer app-wide, which
 * closes this modal automatically — it never has to resolve its own timer.
 */
export function SessionWarningModal({ isOpen, secondsRemaining, totalSeconds, onStayLoggedIn, onLogoutNow }: SessionWarningModalProps) {
  const [staying, setStaying] = useState(false);
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  const logoutButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setStaying(false);
      return;
    }
    stayButtonRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Simple focus trap: Tab/Shift+Tab cycles between the two buttons only.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = [stayButtonRef.current, logoutButtonRef.current].filter(Boolean) as HTMLElement[];
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const handleStay = () => {
    setStaying(true);
    onStayLoggedIn();
  };

  const pct = Math.max(0, Math.min(100, (secondsRemaining / totalSeconds) * 100));
  const urgent = secondsRemaining <= 15;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-popup-backdrop"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expiring-title"
        aria-describedby="session-expiring-message"
        className="w-full max-w-sm rounded-xl border border-amber-500/20 bg-white shadow-2xl dark:border-amber-500/30 dark:bg-navy-dark animate-popup-panel"
      >
        <div className="flex items-start gap-3 border-b border-black/5 p-6 dark:border-white/10">
          <AlertTriangle className={urgent ? "h-6 w-6 shrink-0 text-red-500" : "h-6 w-6 shrink-0 text-amber-500"} aria-hidden />
          <div>
            <h2 id="session-expiring-title" className="text-lg font-semibold text-navy dark:text-white">
              Session Expiring
            </h2>
            <p id="session-expiring-message" className="mt-1 text-sm text-navy/60 dark:text-white/60">
              You&apos;ve been inactive for a while. Your session will expire soon.
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div
              className={urgent ? "h-full rounded-full bg-red-500 transition-[width] duration-200" : "h-full rounded-full bg-amber-500 transition-[width] duration-200"}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-center text-sm text-navy/60 dark:text-white/60">
            Session expires in:{" "}
            <span className={urgent ? "font-semibold tabular-nums text-red-500" : "font-semibold tabular-nums text-amber-600 dark:text-amber-400"}>
              {formatCountdown(secondsRemaining)}
            </span>
          </p>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <Button ref={stayButtonRef} onClick={handleStay} disabled={staying} className="flex-1">
            {staying ? "Staying…" : "Stay Logged In"}
          </Button>
          <Button ref={logoutButtonRef} onClick={onLogoutNow} variant="danger" className="flex-1" disabled={staying}>
            Logout Now
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
