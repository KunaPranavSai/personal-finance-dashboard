"use client";

// User-facing styled confirmation dialog — replaces native `confirm()` in
// financial delete flows with something that matches the approved palette,
// is keyboard/focus-trappable, and respects prefers-reduced-motion. Not
// shared with Admin (new file), so it's free to use the Pp* design system.
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { FocusTrap } from "./FocusTrap";
import { DestructiveActionButton, type DestructiveStatus } from "./DestructiveActionButton";
import { toUserMessage } from "@/lib/errorMessage";

export interface PpConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /**
   * The destructive operation itself. When given, the dialog stays open while it runs (pending), shows
   * "Deleted" only after it resolves (confirmed), and shows the error with a retry if it rejects. The promise
   * returned by confirm() resolves true only after success. Without it the dialog just returns the user's
   * choice and the caller runs the operation (legacy behaviour).
   */
  action?: () => Promise<unknown>;
  /** Text on the success state; default "Deleted". */
  successLabel?: string;
}

type ConfirmFn = (options: PpConfirmOptions) => Promise<boolean>;

const PpConfirmContext = createContext<ConfirmFn>(async () => false);

export function usePpConfirm(): ConfirmFn {
  return useContext(PpConfirmContext);
}

interface PendingConfirm {
  options: PpConfirmOptions;
  resolve: (value: boolean) => void;
}

const SUCCESS_HOLD_MS = 700;

function ConfirmDialog({ pending, settle, reducedMotion }: { pending: PendingConfirm; settle: (v: boolean) => void; reducedMotion: boolean | null }) {
  const { options } = pending;
  const [status, setStatus] = useState<DestructiveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = status === "pending" || status === "success";

  const run = async () => {
    if (busy) return; // double click / Enter-mash cannot start a second delete
    if (!options.action) return settle(true);
    setStatus("pending");
    setError(null);
    try {
      await options.action();
    } catch (err) {
      setStatus("error");
      setError(toUserMessage(err));
      return;
    }
    setStatus("success"); // only after storage confirmed it
    setTimeout(() => settle(true), reducedMotion ? 0 : SUCCESS_HOLD_MS);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.01 : 0.15 }}
      role="presentation"
      onClick={() => !busy && settle(false)}
    >
      <FocusTrap active>
        <motion.div
          className="w-full max-w-sm rounded-pp border border-pp-border bg-pp-surface p-5 shadow-pp"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: reducedMotion ? 0.01 : 0.18 }}
          role="alertdialog"
          aria-modal="true"
          aria-label={options.title ?? "Confirm"}
          aria-describedby="pp-confirm-message"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            {options.danger !== false && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vulcanico/10">
                <AlertTriangle className="h-4 w-4 text-vulcanico" />
              </div>
            )}
            <div className="flex-1">
              {options.title && <h2 className="text-sm font-semibold text-pp-text">{options.title}</h2>}
              <p id="pp-confirm-message" className="mt-1 text-sm text-pp-text-dim">{options.message}</p>
              {error && <p role="alert" className="mt-2 text-sm text-pp-critical">{error}</p>}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => settle(false)}
              disabled={busy}
              className="min-h-[44px] rounded-full px-4 py-2 text-sm font-semibold text-pp-text-dim hover:bg-pp-surface-2 disabled:opacity-50"
              autoFocus
            >
              {options.cancelLabel ?? "Cancel"}
            </button>
            <DestructiveActionButton
              label={options.confirmLabel ?? "Delete"}
              pendingLabel="Deleting…"
              successLabel={options.successLabel ?? "Deleted"}
              status={status}
              onClick={run}
            />
          </div>
        </motion.div>
      </FocusTrap>
    </motion.div>
  );
}

export function PpConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const reducedMotion = useReducedMotion();

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const settle = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <PpConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>{pending && <ConfirmDialog key="confirm" pending={pending} settle={settle} reducedMotion={reducedMotion} />}</AnimatePresence>
    </PpConfirmContext.Provider>
  );
}
