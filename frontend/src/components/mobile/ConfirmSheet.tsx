"use client";

import { MobileSheet } from "./MobileSheet";

interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isPending?: boolean;
  errorMessage?: string | null;
}

/** Shared destructive-action confirmation sheet — every delete flow in the
 * mobile UI routes through this instead of a native confirm(). */
export function ConfirmSheet({ open, onClose, onConfirm, title, message, confirmLabel = "Delete", isPending, errorMessage }: ConfirmSheetProps) {
  return (
    <MobileSheet open={open} onClose={onClose} title={title}>
      <div className="ppm-confirm-sheet">
        <p>{message}</p>
        {errorMessage && <div className="err" style={{ marginBottom: 14 }}>{errorMessage}</div>}
        <div className="ppm-confirm-actions">
          <button type="button" className="ppm-sheet-cancel" style={{ marginTop: 0 }} onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button type="button" className="ppm-danger-btn" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </MobileSheet>
  );
}
