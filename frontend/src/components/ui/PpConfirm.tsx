"use client";

// User-facing styled confirmation dialog — replaces native `confirm()` in
// financial delete flows with something that matches the approved palette,
// is keyboard/focus-trappable, and respects prefers-reduced-motion. Not
// shared with Admin (new file), so it's free to use the Pp* design system.
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { FocusTrap } from "./FocusTrap";

export interface PpConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
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
      <AnimatePresence>
        {pending && (
          <motion.div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.15 }}
            role="presentation"
            onClick={() => settle(false)}
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
                aria-label={pending.options.title ?? "Confirm"}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  {pending.options.danger !== false && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vulcanico/10">
                      <AlertTriangle className="h-4 w-4 text-vulcanico" />
                    </div>
                  )}
                  <div className="flex-1">
                    {pending.options.title && (
                      <h2 className="text-sm font-semibold text-pp-text">{pending.options.title}</h2>
                    )}
                    <p className="mt-1 text-sm text-pp-text-dim">{pending.options.message}</p>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => settle(false)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-pp-text-dim hover:bg-pp-surface-2 min-h-[44px]"
                    autoFocus
                  >
                    {pending.options.cancelLabel ?? "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => settle(true)}
                    className="rounded-xl bg-vulcanico px-4 py-2 text-sm font-semibold text-white hover:opacity-90 min-h-[44px]"
                  >
                    {pending.options.confirmLabel ?? "Delete"}
                  </button>
                </div>
              </motion.div>
            </FocusTrap>
          </motion.div>
        )}
      </AnimatePresence>
    </PpConfirmContext.Provider>
  );
}
