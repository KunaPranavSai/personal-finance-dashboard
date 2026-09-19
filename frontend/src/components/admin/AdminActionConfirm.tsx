"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type ToastFn = (msg: string, type: "success" | "error") => void;

export interface AdminActionConfirmProps {
  /** Short imperative title, e.g. "Force logout Jane Doe" */
  title: string;
  /** Plain-language explanation of exactly what this does and any side effects. */
  explanation: string;
  /** Name/email shown as the target, for "am I acting on the right account" clarity. */
  targetLabel: string;
  /** Danger-tier styling for delete/suspend-type actions vs. a neutral confirm. */
  danger?: boolean;
  /** If set, the confirm button stays disabled until the admin types this exact string. */
  requireTypedConfirmation?: string;
  confirmLabel?: string;
  onClose: () => void;
  /** Performs the actual backend call; throwing surfaces the error in the modal. */
  onConfirm: () => Promise<{ message?: string } | void>;
  toast: ToastFn;
  onDone?: () => void;
  /** Optional extra form content rendered between the explanation and the confirm/cancel
   * buttons — e.g. the password field + Generate button on the reset-password action. Keeps
   * dangerous-action inputs inside the same confirm surface instead of a separate modal. */
  children?: React.ReactNode;
}

/**
 * Shared confirmation modal for every dangerous/privileged admin action (Phase 5 — Action
 * Center). Every use must be backed by a real endpoint call in `onConfirm`; this component only
 * adds the confirm/explain/audit-visible UX layer, never a fake control.
 */
export function AdminActionConfirm({
  title, explanation, targetLabel, danger, requireTypedConfirmation, confirmLabel,
  onClose, onConfirm, toast, onDone, children,
}: AdminActionConfirmProps) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      const result = await onConfirm();
      toast(result?.message ?? "Action completed", "success");
      onDone?.();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setBusy(false);
    }
  }, [onConfirm, toast, onDone, onClose]);

  const locked = Boolean(requireTypedConfirmation) && typed !== requireTypedConfirmation;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="cc-panel cc-glow w-full max-w-sm p-5"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: danger ? "rgba(248,113,113,0.12)" : "var(--cc-accent-dim)" }}
            >
              <AlertTriangle className="h-5 w-5" style={{ color: danger ? "var(--cc-red)" : "var(--cc-accent)" }} />
            </div>
            <div className="min-w-0">
              <p className="cc-mono text-sm font-semibold" style={{ color: "var(--cc-text)" }}>{title}</p>
              <p className="cc-mono mt-0.5 text-[11px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>
                Target: {targetLabel}
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--cc-text-dim)" }}>{explanation}</p>

          {children && <div className="mt-3">{children}</div>}

          {requireTypedConfirmation && (
            <div className="mt-3">
              <label className="cc-mono block text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>
                Type &quot;{requireTypedConfirmation}&quot; to confirm
              </label>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="cc-mono mt-1 w-full rounded border bg-transparent px-3 py-2 text-sm"
                style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
                autoFocus
              />
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="button" size="sm" variant={danger ? "danger" : "primary"} onClick={submit} disabled={busy || locked}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {busy ? "Working…" : (confirmLabel ?? "Confirm")}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
