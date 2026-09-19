"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { ArrowRight, Shield, Database, KeyRound } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/format";
import { InstallAppButton } from "./InstallAppButton";

// recharts' ResponsiveContainer measures its container client-side only, so
// server-rendering it produces a 0-width chart that mismatches the client
// render on hydration. Load the demo dashboard client-only, matching how the
// same chart components already behave in the authenticated app.
const DemoDashboard = dynamic(() => import("./DemoDashboard").then((m) => m.DemoDashboard), {
  ssr: false,
  loading: () => <div className="mx-auto h-[520px] max-w-5xl animate-pulse rounded-2xl bg-navy/5 dark:bg-white/5" />,
});

const TRUST_BADGES = [
  { icon: Database, label: "Your Google Drive", desc: "Your data, your storage" },
  { icon: Shield, label: "Encrypted tokens", desc: "AES-256-GCM at rest" },
  { icon: KeyRound, label: "2FA & passkeys", desc: "Secure by design" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24 lg:py-28">
      {/* One restrained ambient glow for the whole hero — not repeated per section. */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-teal/8 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-semibold text-teal dark:border-teal/40 dark:bg-teal/20"
          >
            <span className="relative h-1.5 w-1.5 rounded-full bg-teal" />
            PERSONAL FINANCE, SIMPLIFIED
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 text-balance text-4xl font-bold tracking-tight text-navy dark:text-white sm:text-5xl lg:text-6xl"
          >
            Your money, finally in focus.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-navy/60 dark:text-white/60 sm:text-xl"
          >
            Penny Pilot brings your income, expenses, budgets, and goals together in one clear
            dashboard — so you always know exactly where your money stands.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          >
            <Link
              href="/signup"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-teal px-6 py-3 text-base font-semibold text-white transition-all hover:bg-teal/90 hover:shadow-lg hover:shadow-teal/25 active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
              )}
            >
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="#showcase"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-navy/15 bg-white/60 px-6 py-3 text-base font-semibold text-navy transition-all hover:bg-black/5 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
              )}
            >
              Explore
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-8"
          >
            {TRUST_BADGES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-2.5 text-sm text-navy/50 dark:text-white/50">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal dark:bg-teal/20">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="text-left">
                  <p className="font-medium text-navy dark:text-white">{label}</p>
                  <p className="text-xs text-navy/40 dark:text-white/40">{desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
          className="relative mt-16"
        >
          <DemoDashboard variant="full" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-10 text-center"
        >
          <InstallAppButton variant="hero" />
          <p className="mt-2 text-xs text-navy/40 dark:text-white/40">
            Works offline · Gets updates automatically · No app store required
          </p>
        </motion.div>
      </div>
    </section>
  );
}
