"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Cloud, HardDrive } from "lucide-react";
import { cn } from "@/lib/format";
import { GLASS } from "./styles";

const OPTIONS = [
  {
    id: "drive",
    tab: "Google Drive",
    icon: Cloud,
    title: "Stored in your own Drive",
    text: "Your financial data is saved as files in your own Google Drive, using the restricted drive.file scope.",
  },
  {
    id: "local",
    tab: "This device only",
    icon: HardDrive,
    title: "Stays in your browser",
    text: "Your data is kept in your browser's local storage. No Google account connection required.",
  },
] as const;

export function StorageChoice() {
  const [active, setActive] = useState<(typeof OPTIONS)[number]["id"]>("drive");
  const reduce = useReducedMotion();
  const current = OPTIONS.find((o) => o.id === active)!;

  return (
    <section aria-labelledby="storage-heading" className="px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <div className={cn(GLASS, "mx-auto max-w-4xl p-8 sm:p-12")}>
        <h2 id="storage-heading" className="text-4xl font-semibold tracking-tighter text-pp-text sm:text-5xl">
          Keep control of your data.
        </h2>
        <p className="mt-3 max-w-[52ch] text-lg text-pp-text-dim">Choose the storage approach that fits you.</p>

        <div role="tablist" aria-label="Storage options" className="mt-8 inline-flex rounded-full border border-pp-border bg-pp-surface/80 p-1">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              role="tab"
              type="button"
              id={`tab-${o.id}`}
              aria-selected={active === o.id}
              aria-controls="storage-panel"
              onClick={() => setActive(o.id)}
              className="relative h-11 rounded-full px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent"
            >
              {active === o.id && (
                <motion.span layoutId="storage-pill" className="absolute inset-0 rounded-full bg-pp-accent" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
              )}
              <span className={cn("relative", active === o.id ? "text-pp-accent-ink" : "text-pp-text-dim")}>{o.tab}</span>
            </button>
          ))}
        </div>

        <div id="storage-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="mt-8 min-h-[7rem]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? undefined : { opacity: 0, y: -8, filter: "blur(6px)" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-6 sm:flex-row sm:items-center"
            >
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                <div className="lp-spin-slow absolute inset-0 rounded-full border border-dashed border-pp-accent/40" />
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-pp-chip-bg">
                  <current.icon className="h-7 w-7 text-pp-accent" strokeWidth={1.75} aria-hidden="true" />
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-pp-text">{current.title}</h3>
                <p className="mt-2 max-w-[52ch] text-base leading-relaxed text-pp-text-dim">{current.text}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
