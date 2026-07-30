"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, PiggyBank, ClipboardCopy, Check } from "lucide-react";
import { ErrorPageShell, errorPrimaryButton, errorGhostButton } from "@/components/ui/ErrorPageShell";
import { GoldCoin } from "@/components/ui/GoldCoin";

const FALLING_COINS = [
  { left: "18%", delay: 0, size: "1.4rem" },
  { left: "38%", delay: 0.5, size: "1rem" },
  { left: "58%", delay: 1, size: "1.6rem" },
  { left: "76%", delay: 0.3, size: "1.1rem" },
];

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Server-side errors still deserve a client-side breadcrumb for whoever
    // reviews browser logs — this app has no error-tracking service wired up.
    console.error("[GlobalError]", error);
  }, [error]);

  const handleReportIssue = async () => {
    const details = `Penny Pilot error\n${error.message}\ndigest: ${error.digest ?? "n/a"}\nurl: ${typeof window !== "undefined" ? window.location.href : ""}`;
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard permissions denied — silently ignore, nothing worse to do
    }
  };

  return (
    <ErrorPageShell>
      <div className="relative mx-auto mb-4 flex h-28 items-center justify-center sm:h-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {FALLING_COINS.map((c, i) => (
            <motion.div
              key={i}
              className="absolute top-0"
              style={{ left: c.left }}
              animate={{ y: [-10, 90, 90, -10], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2.4, delay: c.delay, repeat: Infinity, ease: ["easeIn", "easeOut", "easeIn"], times: [0, 0.6, 0.85, 1] }}
            >
              <GoldCoin size={c.size} spinDuration={1.4} />
            </motion.div>
          ))}
        </div>
        <motion.div
          animate={{ x: [0, -1.5, 1.5, -1, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
          className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-red-400/20 bg-white/5 sm:h-24 sm:w-24"
        >
          <div className="absolute inset-0 rounded-2xl bg-red-500/10 blur-lg" />
          <PiggyBank className="relative h-9 w-9 text-amber-300 sm:h-11 sm:w-11" />
        </motion.div>
      </div>

      <motion.h1
        className="bg-gradient-to-b from-red-300 to-amber-500 bg-clip-text text-6xl font-extrabold text-transparent sm:text-7xl"
        animate={{ opacity: [1, 0.85, 1, 0.7, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", times: [0, 0.1, 0.2, 0.3, 1] }}
      >
        500
      </motion.h1>

      <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">Engine Trouble</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[#94A3B8]">
        Our servers encountered an unexpected bump in the flight.
      </p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} type="button" onClick={reset} className={errorPrimaryButton}>
          <motion.span className="inline-flex" whileHover={{ rotate: 360 }} transition={{ duration: 0.6, ease: "easeInOut" }}>
            <RefreshCw className="h-4 w-4" />
          </motion.span>
          Try Again
        </motion.button>
        <button type="button" onClick={handleReportIssue} className={errorGhostButton}>
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <ClipboardCopy className="h-4 w-4" />}
          {copied ? "Copied!" : "Report Issue"}
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-white/30">Error 500 — Internal Server Error</p>
    </ErrorPageShell>
  );
}
