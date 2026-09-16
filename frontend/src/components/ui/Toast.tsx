"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/format";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  action?: ToastAction;
}

interface ToastOptions {
  action?: ToastAction;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
};

const styles: Record<ToastType, string> = {
  success: "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800",
  error: "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800",
  info: "border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800",
  warning: "border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info", options?: ToastOptions) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message, action: options?.action }]);
    // Toasts offering a recovery action stay up long enough to actually read
    // and click, instead of the normal 4s ambient-notification duration.
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, options?.action ? 10000 : 4000);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm" aria-live="polite" aria-label="Notifications">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg", styles[t.type])}
            >
              {icons[t.type]}
              <div className="flex-1">
                <p className="text-navy dark:text-white">{t.message}</p>
                {t.action && (
                  <button
                    onClick={() => { t.action!.onClick(); remove(t.id); }}
                    className="mt-1 text-xs font-semibold underline underline-offset-2 text-navy dark:text-white"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button onClick={() => remove(t.id)} className="shrink-0 text-navy/40 hover:text-navy dark:text-white/40">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
