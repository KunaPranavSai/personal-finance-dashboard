"use client";

import { motion } from "framer-motion";
import { ListChecks, Sparkles, Target, ArrowRight } from "lucide-react";

const STEPS = [
  { icon: ListChecks, title: "Track", description: "Log income, expenses, bills, and investments as they happen." },
  { icon: Sparkles, title: "Understand", description: "See spending patterns, trends, and your financial health score." },
  { icon: Target, title: "Plan", description: "Set budgets and savings goals, then watch your progress." },
];

/** Compact strip stating the product's core loop in one glance — deliberately
 * lighter than the full "How It Works" onboarding section further down. */
export function TrackUnderstandPlan() {
  return (
    <section className="py-10 sm:py-14" aria-label="How Penny Pilot works">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-4">
          {STEPS.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="flex items-center gap-4"
            >
              <div className="flex items-center gap-3 text-center sm:text-left">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal dark:bg-teal/20">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy dark:text-white">{title}</p>
                  <p className="text-xs text-navy/50 dark:text-white/50">{description}</p>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-navy/20 dark:text-white/20 sm:block" aria-hidden="true" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
