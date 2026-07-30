"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface AuthPageShellProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Adds a gentle pulsing glow to the icon badge — used for attention-seeking steps like password reset. */
  pulse?: boolean;
}

/**
 * Shared glassmorphic shell for the Login / Signup / Forgot Password pages —
 * dark radial background with ambient glow spots, a glowing icon badge, and
 * a glass card. Matches AnimatedCodeVerification's visual language so the
 * whole auth flow (password entry -> 2FA -> reset) reads as one system.
 */
export function AuthPageShell({ icon: Icon, title, subtitle, children, footer, pulse }: AuthPageShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0F19] p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/20 blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-purple-600/20 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-8 flex flex-col items-center gap-3 text-center"
        >
          <div className="relative flex h-16 w-16 items-center justify-center">
            <motion.div
              className="absolute inset-0 rounded-full bg-purple-500/30 blur-xl"
              animate={pulse ? { scale: [1, 1.25, 1], opacity: [0.7, 0.35, 0.7] } : undefined}
              transition={pulse ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : undefined}
            />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
              <Icon className="h-7 w-7 text-purple-300" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="mt-1 text-sm text-[#94A3B8]">{subtitle}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
          className="relative rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.65)] p-8 shadow-[0_8px_40px_rgba(124,58,237,0.15)] backdrop-blur-xl"
        >
          {children}
        </motion.div>

        {footer}
      </div>
    </div>
  );
}
