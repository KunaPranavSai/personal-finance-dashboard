"use client";

import { motion, AnimatePresence } from "framer-motion";

interface ErrorPageShellProps {
  children: React.ReactNode;
}

/**
 * Shared shell for the 404 / 500 / 403 / offline pages — deep space dark
 * background with ambient violet + cyan glows and a floating glassmorphic
 * card, matching the OTP/auth-page design system.
 */
export function ErrorPageShell({ children }: ErrorPageShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-pp-bg p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-pp-accent/20 blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-pp-accent/15 blur-[100px]" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key="card"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative w-full max-w-lg rounded-2xl border border-pp-border bg-pp-surface px-6 py-10 text-center shadow-pp sm:px-10"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export const errorPrimaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-pp-accent px-6 py-3 text-sm font-semibold text-pp-accent-ink shadow-pp transition hover:opacity-90 active:scale-[0.98]";

export const errorGhostButton =
  "inline-flex items-center justify-center gap-2 rounded-full border border-pp-border bg-pp-surface-2 px-6 py-3 text-sm font-semibold text-pp-text backdrop-blur-sm transition-all hover:bg-pp-chip-bg";
