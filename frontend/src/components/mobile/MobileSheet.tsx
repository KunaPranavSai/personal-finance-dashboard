"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Spring bottom sheet matching the approved artifact's interaction pattern.
 * Portals to document.body so it isn't clipped by any ancestor's overflow. */
export function MobileSheet({ open, onClose, title, children }: MobileSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pp-mobile">
      <div className={`ppm-sheet-backdrop${open ? " show" : ""}`} onClick={onClose} aria-hidden={!open} />
      <div className={`ppm-sheet${open ? " show" : ""}`} role="dialog" aria-modal="true" aria-label={title} aria-hidden={!open}>
        <div className="grabber" />
        <h3>{title}</h3>
        {children}
      </div>
    </div>,
    document.body
  );
}
