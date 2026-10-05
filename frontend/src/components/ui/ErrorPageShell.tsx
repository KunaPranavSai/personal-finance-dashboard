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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-noturno p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-pp-accent/20 blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-tiffany/15 blur-[100px]" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key="card"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[rgba(0,22,33,0.65)] px-6 py-10 text-center shadow-[0_8px_40px_rgba(33,241,168,0.15)] backdrop-blur-xl sm:px-10"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export const errorPrimaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pp-accent to-pp-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-pp-accent/25 transition-all hover:shadow-pp-accent/40";

export const errorGhostButton =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all hover:bg-white/10";
