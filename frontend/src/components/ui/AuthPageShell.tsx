"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { EASE, fadeUp, stagger } from "@/lib/motion";

interface AuthPageShellProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Adds a gentle pulsing halo to the icon badge, for attention-seeking steps such as password reset. */
  pulse?: boolean;
  /** Renders as a self-sized panel instead of a full-viewport page (used inside LoginModal on the landing page). */
  embedded?: boolean;
}

/**
 * Themed background for every pre-dashboard screen: the dashboard's own surface colour, a faint grid and two soft
 * accent glows. Uses the pp-* tokens, so it follows the light/dark choice exactly like the dashboard does.
 */
export function AuthBackdrop({ children, embedded }: { children: React.ReactNode; embedded?: boolean }) {
  return (
    <div className={embedded ? "relative overflow-hidden bg-pp-bg p-4 sm:p-6" : "relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-pp-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.5] [background-image:linear-gradient(var(--pp-border)_1px,transparent_1px),linear-gradient(90deg,var(--pp-border)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
        <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-pp-accent/10 blur-[110px]" />
        <div className="absolute -bottom-40 -right-40 h-[30rem] w-[30rem] rounded-full bg-pp-accent/10 blur-[110px]" />
      </div>
      {children}
    </div>
  );
}

/**
 * Shared shell for Login / Signup / Forgot Password / Connect Drive: brand mark, icon badge, title and a dashboard-style
 * card. One entrance sequence (header then card), nothing looping unless `pulse` is set.
 */
export function AuthPageShell({ icon: Icon, title, subtitle, children, footer, pulse, embedded }: AuthPageShellProps) {
  return (
    <AuthBackdrop embedded={embedded}>
      <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className={embedded ? "relative w-full" : "relative w-full max-w-md"}>
        {!embedded && (
          <motion.div variants={fadeUp} className="mb-6 flex justify-center">
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-pp-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent">
              <Image src="/logo.png" alt="" width={28} height={28} className="rounded-lg" />
              Penny Pilot
            </Link>
          </motion.div>
        )}

        <motion.div variants={fadeUp} className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="relative flex h-14 w-14 items-center justify-center">
            {pulse && (
              <motion.div
                aria-hidden="true"
                className="absolute inset-0 rounded-2xl bg-pp-accent/20"
                animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0.2, 0.7] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-pp-border bg-pp-chip-bg">
              <Icon className="h-6 w-6 text-pp-accent" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-pp-text">{title}</h1>
            <p className="mt-1 text-sm text-pp-text-dim">{subtitle}</p>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: EASE }} className="relative rounded-pp border border-pp-border bg-pp-surface p-6 shadow-pp sm:p-8">
          {children}
        </motion.div>

        {footer}
      </motion.div>
    </AuthBackdrop>
  );
}
