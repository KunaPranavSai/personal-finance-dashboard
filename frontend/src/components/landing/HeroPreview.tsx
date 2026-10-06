"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Wallet } from "lucide-react";
import { EASE } from "@/lib/motion";

const MONTHS = [
  { m: "May", v: 58 }, { m: "Jun", v: 71 }, { m: "Jul", v: 64 }, { m: "Aug", v: 82 }, { m: "Sep", v: 69 }, { m: "Oct", v: 47 },
];
const CATEGORIES = [
  { name: "Housing", pct: 38 },
  { name: "Groceries", pct: 22 },
  { name: "Food & Dining", pct: 14, grows: true },
  { name: "Transport", pct: 11 },
];

/**
 * The hero's one orchestrated moment: a miniature dashboard built from the real card styles. After a beat a
 * description is "typed", Penny Pilot picks the category and wallet by itself, and the matching bar grows.
 * The figures are sample data and are labelled as such. Under reduced motion it renders the finished state.
 */
export function HeroPreview() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? 3 : 0); // 0 idle, 1 typing, 2 picked, 3 saved

  useEffect(() => {
    if (reduce) return;
    const t = [setTimeout(() => setStep(1), 900), setTimeout(() => setStep(2), 2300), setTimeout(() => setStep(3), 3300)];
    return () => t.forEach(clearTimeout);
  }, [reduce]);

  const typed = "Swiggy dinner".slice(0, step === 0 ? 0 : step === 1 ? 13 : 13);

  return (
    <div className="relative mx-auto w-full max-w-[34rem] pb-24" role="img" aria-label="Preview of the Penny Pilot dashboard with sample data">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
        className="rounded-pp border border-pp-border bg-pp-surface p-4 shadow-pp sm:p-5"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-pp-text">October overview</p>
          <span className="rounded-full bg-pp-chip-bg px-2.5 py-0.5 text-[11px] font-medium text-pp-text-dim">Sample data</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            { k: "Income", v: "₹84,200", tone: "text-pp-positive" },
            { k: "Spent", v: step >= 3 ? "₹46,790" : "₹46,350", tone: "text-pp-text" },
            { k: "Saved", v: step >= 3 ? "₹37,410" : "₹37,850", tone: "text-pp-accent" },
          ].map((s) => (
            <div key={s.k} className="rounded-xl bg-pp-surface-2 px-3 py-2.5">
              <p className="text-[11px] text-pp-text-dim">{s.k}</p>
              <p className={`mt-0.5 text-base font-semibold tabular-nums sm:text-lg ${s.tone}`}>{s.v}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex h-24 items-end gap-2" aria-hidden="true">
          {MONTHS.map((b, i) => (
            <div key={b.m} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.55 + i * 0.06 }}
                style={{ height: `${b.v}%`, originY: 1 }}
                className={`w-full rounded-t-md ${i === MONTHS.length - 1 ? "bg-pp-accent" : "bg-pp-accent/40"}`}
              />
              <span className="text-[10px] text-pp-text-dim">{b.m}</span>
            </div>
          ))}
        </div>

        <ul className="mt-4 space-y-2.5" aria-hidden="true">
          {CATEGORIES.map((c) => (
            <li key={c.name} className="flex items-center gap-3 text-xs">
              <span className="w-24 shrink-0 text-pp-text-dim">{c.name}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-pp-surface-2">
                <motion.span
                  className="block h-full rounded-full bg-pp-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${c.pct + (c.grows && step >= 3 ? 4 : 0)}%` }}
                  transition={{ duration: 0.9, ease: EASE, delay: c.grows && step >= 3 ? 0 : 0.9 }}
                />
              </span>
              <span className="w-8 text-right tabular-nums text-pp-text-dim">{c.pct + (c.grows && step >= 3 ? 4 : 0)}%</span>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* The add-transaction moment: sits over the card's lower edge like the app's own sheet. */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: step >= 1 ? 1 : 0, y: step >= 1 ? 0 : 20 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="absolute bottom-0 left-3 right-3 rounded-pp border border-pp-border bg-pp-surface p-3.5 shadow-pp sm:left-8 sm:right-8"
        aria-hidden="true"
      >
        <p className="text-[11px] text-pp-text-dim">New expense</p>
        <p className="mt-0.5 min-h-[1.25rem] text-sm font-medium text-pp-text">
          {typed}
          {step === 1 && <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-pp-text align-middle" />}
        </p>
        <AnimatePresence>
          {step >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="mt-2 flex flex-wrap items-center gap-2 text-xs"
            >
              <span className="rounded-full bg-pp-chip-bg px-2.5 py-1 font-medium text-pp-accent">Food &amp; Dining</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-pp-chip-bg px-2.5 py-1 font-medium text-pp-text-dim"><Wallet className="h-3 w-3" aria-hidden="true" />UPI</span>
              <span className="text-pp-text-dim">picked from your description</span>
              {step >= 3 && <Check className="ml-auto h-4 w-4 text-pp-positive" aria-hidden="true" />}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
