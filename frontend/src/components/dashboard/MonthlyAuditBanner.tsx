"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, X, ArrowRight } from "lucide-react";

// Shown on days 1-7 of each month. One card, one action: review last month in Reports.
// Adding data happens only through the + button (Add Transaction), never from here.
const monthKey = (d: Date) => `pfd-checkin-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function MonthlyAuditBanner() {
  const now = new Date();
  const key = monthKey(now);
  const [hidden, setHidden] = useState(true); // hidden until storage is read, so it never flashes
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setHidden(read(key) !== null);
    setMounted(true);
  }, [key]);

  if (!mounted || hidden || now.getDate() > 7) return null;

  const close = (value: "dismissed" | "reviewed") => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked: card returns next load */ }
    setHidden(true);
  };
  const month = now.toLocaleString("en-US", { month: "long" });

  return (
    <motion.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      aria-label="Monthly financial check-in"
      className="relative mb-6 overflow-hidden rounded-2xl border border-pp-border bg-pp-surface p-4 shadow-lg shadow-pp-accent/10 sm:p-5"
    >
      <button
        type="button"
        onClick={() => close("dismissed")}
        aria-label="Dismiss monthly check-in"
        className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-xl text-pp-text-dim hover:bg-pp-surface-2 hover:text-pp-text"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-10">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pp-accent/15 text-pp-accent">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-pp-text sm:text-base">Monthly Financial Check-In</h2>
          <p className="mt-0.5 text-xs text-pp-text-dim sm:text-sm">
            See how {month} is shaping up: income, spending, budgets and savings in one place.
          </p>
        </div>
      </div>

      <Link
        href="/reports"
        onClick={() => close("reviewed")}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-pp-accent px-4 text-sm font-semibold text-white dark:text-slate-900 transition-opacity hover:opacity-90 sm:w-auto sm:min-w-[220px]"
      >
        Review your month <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.section>
  );
}
