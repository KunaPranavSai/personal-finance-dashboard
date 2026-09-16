"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { useKeyboardInset } from "./useKeyboardInset";

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Spring bottom sheet matching the approved artifact's interaction pattern.
 * Portals to document.body so it isn't clipped by any ancestor's overflow.
 * Tracks the on-screen keyboard via useKeyboardInset so the sheet stays
 * pinned above it (not floating off past the real visible bottom edge, and
 * not letting the keyboard cover its own action buttons) instead of the
 * "jumps"/mispositioned-sheet behavior plain `position: fixed; bottom: 0`
 * gets on iOS/Android when the keyboard opens. */
export function MobileSheet({ open, onClose, title, children }: MobileSheetProps) {
  const keyboardInset = useKeyboardInset();

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
      <div
        className={`ppm-sheet${open ? " show" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        style={open && keyboardInset > 0 ? { bottom: keyboardInset, maxHeight: `calc(85dvh - ${keyboardInset}px)` } : undefined}
      >
        <div className="grabber" />
        <h3>{title}</h3>
        {children}
      </div>
    </div>,
    document.body
  );
}
