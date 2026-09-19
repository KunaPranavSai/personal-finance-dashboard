"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/format";

export function FinalCTA() {
  return (
    <section id="cta" className="py-16 sm:py-24 lg:py-32 relative overflow-hidden">
      {/* Single restrained glow, not stacked with the section's own background. */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-teal/8 blur-[130px]" />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-teal/10 px-4 py-1.5 text-sm font-semibold text-teal dark:bg-teal/20 mb-6">
            <span className="relative h-1.5 w-1.5 rounded-full bg-teal animate-pulse" aria-hidden="true" />
            Ready to get started?
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-4xl lg:text-5xl text-balance mb-6"
        >
          Your money deserves a clearer picture.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mx-auto max-w-2xl text-lg text-navy/60 dark:text-white/60 mb-10"
        >
          Bring your income, expenses, budgets, goals and financial progress together with Penny Pilot.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <Link
            href="/signup"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-teal px-7 py-3.5 text-base font-semibold text-white transition-all hover:bg-teal/90 hover:shadow-xl hover:shadow-teal/25 active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
            )}
          >
            Get Started Free
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link
            href="/login"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-navy/15 bg-white/60 px-7 py-3.5 text-base font-semibold text-navy transition-all hover:bg-black/5 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
            )}
          >
            Log In
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-sm text-navy/40 dark:text-white/40"
        >
          Free to use · No credit card required · Your data stays yours
        </motion.p>
      </div>
    </section>
  );
}