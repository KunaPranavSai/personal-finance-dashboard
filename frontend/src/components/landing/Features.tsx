"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeftRight, Target, LineChart } from "lucide-react";
import { cn } from "@/lib/format";
import { GLASS } from "./styles";

const EASE = [0.16, 1, 0.3, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.7, ease: EASE },
};

// [income, expenses] relative heights and loop durations. Conceptual, no figures.
const BARS: [number, number, number][] = [
  [0.55, 0.35, 4.2], [0.7, 0.5, 5.1], [0.45, 0.6, 4.6], [0.8, 0.45, 5.6],
  [0.6, 0.4, 4.9], [0.9, 0.55, 5.3], [0.65, 0.7, 4.4], [0.85, 0.5, 5.8],
];

const CHART = "M0 120 C 60 110, 90 70, 150 80 S 250 130, 320 90 S 430 30, 500 45 S 570 20, 600 10";

function Cell({ className, children, title, icon: Icon, text }: {
  className?: string;
  children: React.ReactNode;
  title: string;
  icon: typeof Target;
  text: string;
}) {
  return (
    <motion.article {...reveal} className={cn(GLASS, "relative overflow-hidden p-7 sm:p-9", className)}>
      <div className="relative z-10 max-w-[15rem] sm:max-w-sm md:max-w-[17rem] lg:max-w-sm">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pp-chip-bg">
          <Icon className="h-5 w-5 text-pp-accent" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-2xl font-semibold tracking-tight text-pp-text">{title}</h3>
        <p className="mt-2 text-base leading-relaxed text-pp-text-dim">{text}</p>
      </div>
      {children}
    </motion.article>
  );
}

export function Features() {
  const reduce = useReducedMotion();

  return (
    <section id="features" aria-labelledby="features-heading" className="px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <h2 id="features-heading" className="sr-only">Track, plan, and understand your finances</h2>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-5">
        <Cell
          className="min-h-[340px] md:col-span-3"
          title="Track"
          icon={ArrowLeftRight}
          text="Track income and expenses in one place."
        >
          <div className="absolute inset-x-7 bottom-7 flex h-32 items-end gap-2.5 sm:inset-x-9 sm:bottom-9 sm:h-40" aria-hidden="true">
            {BARS.map(([inc, exp, dur], i) => (
              <div key={i} className="flex h-full flex-1 items-end gap-1">
                {[inc, exp].map((h, k) => (
                  <motion.div
                    key={k}
                    className={cn("h-full flex-1 origin-bottom rounded-t-md", k === 0 ? "bg-pp-accent" : "bg-pp-text-dim/30")}
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: reduce ? h : [h, h * 0.55 + 0.3, h] }}
                    viewport={{ once: true }}
                    transition={{ duration: dur, delay: i * 0.08 + k * 0.3, repeat: Infinity, ease: "easeInOut" }}
                  />
                ))}
              </div>
            ))}
          </div>
        </Cell>

        <Cell
          className="min-h-[340px] bg-pp-chip-bg md:col-span-2"
          title="Plan"
          icon={Target}
          text="Create budgets, goals and financial plans."
        >
          <div className="absolute -bottom-10 -right-10 h-48 w-48 sm:h-56 sm:w-56" aria-hidden="true">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="46" fill="none" stroke="var(--pp-border)" strokeWidth="8" />
              <motion.circle
                cx="60" cy="60" r="46" fill="none" stroke="var(--pp-accent)" strokeWidth="8" strokeLinecap="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 0.72 }}
                viewport={{ once: true }}
                transition={{ duration: 1.8, ease: EASE }}
              />
            </svg>
            <div className="lp-spin-slow absolute inset-3 rounded-full border border-dashed border-pp-border" />
          </div>
        </Cell>

        <Cell
          className="min-h-[300px] bg-pp-chip-bg md:col-span-5"
          title="Understand"
          icon={LineChart}
          text="See your financial picture through meaningful insights and reports."
        >
          <svg viewBox="0 0 600 140" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-40 w-full sm:h-48" aria-hidden="true">
            <defs>
              <linearGradient id="ft-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--pp-accent)" stopOpacity="0.28" />
                <stop offset="1" stopColor="var(--pp-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d={`${CHART} L600 140 L0 140 Z`}
              fill="url(#ft-area)"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.8 }}
            />
            <motion.path
              d={CHART}
              fill="none" stroke="var(--pp-accent)" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, ease: EASE }}
            />
            {!reduce && (
              <circle r="5" fill="var(--pp-text)">
                <animateMotion dur="7s" repeatCount="indefinite" path={CHART} />
              </circle>
            )}
          </svg>
        </Cell>
      </div>
    </section>
  );
}
