"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/format";

export type DestructiveStatus = "idle" | "pending" | "success" | "error";

/**
 * Shared destructive-action button. It only presents state; the caller owns the deletion policy
 * (what is deleted, archived or blocked) and decides when `status` becomes "success".
 * It never reports success itself, so nothing here can claim a delete that storage hasn't confirmed.
 *
 * - Fixed footprint (min-width + height): label, spinner, check and retry swap in place, no layout shift.
 * - Hover/focus lifts the bin lid; press scales slightly. Both are transforms, so the app-wide
 *   MotionConfig reducedMotion="user" (framer) and `motion-reduce:` (CSS) remove them.
 * - Disabled while pending or after success, so a double tap cannot submit twice.
 * - 44px touch target; real <button>, keyboard operable; status is announced via a live region.
 */
export function DestructiveActionButton({
  label = "Delete",
  pendingLabel = "Working…",
  successLabel = "Done",
  errorLabel = "Try again",
  status = "idle",
  onClick,
  disabled,
  className,
}: {
  label?: string;
  pendingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  status?: DestructiveStatus;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const busy = status === "pending";
  // "The bin swallows the label": when the press starts the operation, a decorative copy of the old label flies into
  // the bin while the bin gulps. The real (accessible) text swaps instantly, so assistive tech and tests see no delay.
  const prev = useRef<{ status: DestructiveStatus; text: string }>({ status, text: label });
  const [ghost, setGhost] = useState<string | null>(null);
  useEffect(() => {
    if (prev.current.status === "idle" && status === "pending") setGhost(prev.current.text);
    prev.current = { status, text: { idle: label, pending: pendingLabel, success: successLabel, error: errorLabel }[status] };
  }, [status, label, pendingLabel, successLabel, errorLabel]);
  const text = { idle: label, pending: pendingLabel, success: successLabel, error: errorLabel }[status];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || busy || status === "success"}
      aria-busy={busy}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "group inline-flex h-11 min-w-[7.5rem] items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white",
        "transition-[filter,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-critical focus-visible:ring-offset-2 focus-visible:ring-offset-pp-bg",
        status === "success" ? "bg-pp-text-dim" : "bg-pp-critical hover:brightness-110",
        "disabled:cursor-not-allowed disabled:opacity-80",
        className,
      )}
    >
      <motion.span aria-hidden="true" className="flex h-4 w-4 items-center justify-center" animate={busy ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.35 }}>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        ) : status === "success" ? (
          <Check className="h-4 w-4" />
        ) : status === "error" ? (
          <RotateCcw className="h-4 w-4" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* lid: lifts and tilts on hover/focus */}
            <g className="origin-[4px_6px] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:-rotate-12 group-focus-visible:-translate-y-0.5 group-focus-visible:-rotate-12 motion-reduce:transition-none motion-reduce:group-hover:transform-none motion-reduce:group-focus-visible:transform-none">
              <path d="M3 6h18" />
              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
            </g>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        )}
      </motion.span>
      <span className="relative">
        {text}
        <AnimatePresence>
          {ghost && (
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 whitespace-nowrap"
              initial={{ opacity: 1, x: 0, scale: 1 }}
              animate={{ opacity: 0, x: -26, scale: 0.25 }}
              transition={{ duration: 0.35, ease: "easeIn" }}
              onAnimationComplete={() => setGhost(null)}
            >
              {ghost}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "pending" ? pendingLabel : status === "success" ? successLabel : status === "error" ? "Failed. You can try again." : ""}
      </span>
    </motion.button>
  );
}
