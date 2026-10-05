"use client";

// User-facing toast system with evolving CRUD states (Saving… -> success ✓
// -> "Expense added"), separate from Toast.tsx (shared with the Admin
// panel, whose toasts stay a simple fire-and-forget message). Built so a
// single call can update in place instead of stacking a second toast for
// the same operation.
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Loader2, Check, X as XIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/format";

type PpToastStatus = "pending" | "success" | "error";

interface PpToastItem {
  id: number;
  status: PpToastStatus;
  message: string;
}

interface PpToastContextValue {
  /** Shows a "pending" toast immediately and returns a handle to resolve
   * it into a success/error state once the operation finishes. Safe to
   * call from any CRUD mutation's lifecycle. */
  start: (pendingMessage: string) => {
    success: (message: string) => void;
    error: (message: string) => void;
  };
  /** One-shot toast with no pending phase, for cases that don't need it. */
  notify: (message: string, status?: "success" | "error") => void;
}

const PpToastContext = createContext<PpToastContextValue>({
  start: () => ({ success: () => {}, error: () => {} }),
  notify: () => {},
});

export function usePpToast() {
  return useContext(PpToastContext);
}

const AUTO_DISMISS_MS = 2600;
const PENDING_SAFETY_TIMEOUT_MS = 15000; // never leaves a "pending" toast stuck forever

export function PpToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PpToastItem[]>([]);
  const reducedMotion = useReducedMotion();

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const resolve = useCallback(
    (id: number, status: "success" | "error", message: string) => {
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status, message } : t)));
      setTimeout(() => remove(id), AUTO_DISMISS_MS);
    },
    [remove]
  );

  const start = useCallback(
    (pendingMessage: string) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, status: "pending", message: pendingMessage }]);
      const safety = setTimeout(() => remove(id), PENDING_SAFETY_TIMEOUT_MS);
      return {
        success: (message: string) => {
          clearTimeout(safety);
          resolve(id, "success", message);
        },
        error: (message: string) => {
          clearTimeout(safety);
          resolve(id, "error", message);
        },
      };
    },
    [remove, resolve]
  );

  const notify = useCallback(
    (message: string, status: "success" | "error" = "success") => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, status, message }]);
      setTimeout(() => remove(id), AUTO_DISMISS_MS);
    },
    [remove]
  );

  return (
    <PpToastContext.Provider value={{ start, notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm" aria-live="polite" aria-label="Notifications">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 40 }}
              transition={{ duration: reducedMotion ? 0.01 : 0.18 }}
              className={cn(
                "flex items-center gap-2.5 rounded-pp border px-3.5 py-2.5 text-sm shadow-pp bg-pp-surface",
                t.status === "pending" && "border-pp-border text-pp-text",
                t.status === "success" && "border-mantis/30 text-pp-text",
                t.status === "error" && "border-vulcanico/30 text-pp-text"
              )}
            >
              {t.status === "pending" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-pp-accent" />}
              {t.status === "success" && <Check className="h-4 w-4 shrink-0 text-mantis" />}
              {t.status === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-vulcanico" />}
              <p className="flex-1">{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                aria-label="Dismiss"
                className="shrink-0 text-pp-text-dim hover:text-pp-text"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </PpToastContext.Provider>
  );
}
