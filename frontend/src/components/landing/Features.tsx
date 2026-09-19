"use client";

import { motion } from "framer-motion";
import { Wallet, TrendingUp, Receipt, PiggyBank, BarChart3, Target } from "lucide-react";
import { cn } from "@/lib/format";

const FEATURES = [
  {
    icon: Wallet,
    title: "Expenses",
    description: "Log every expense with categories, tags, and notes — see exactly where your money goes.",
    span: "lg:col-span-3",
  },
  {
    icon: TrendingUp,
    title: "Income",
    description: "Track every source of income and how it compares to your spending, month over month.",
    span: "lg:col-span-3",
  },
  {
    icon: Receipt,
    title: "Budgets",
    description: "Set monthly, quarterly, or yearly budgets per category and see utilization at a glance.",
    span: "lg:col-span-2",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Interactive charts turn raw transactions into patterns you can actually act on.",
    span: "lg:col-span-2",
  },
  {
    icon: PiggyBank,
    title: "Savings",
    description: "Build savings with target amounts and monthly contributions you can track visually.",
    span: "lg:col-span-2",
  },
  {
    icon: Target,
    title: "Goals",
    description: "Set goals for what matters — emergency funds, big purchases, or future plans.",
    span: "lg:col-span-6",
  },
];

export function Features() {
  return (
    <section id="features" className="py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center sm:mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-4xl">
            Everything you need, in one place
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-navy/60 dark:text-white/60">
            No more spreadsheets and scattered notes — Penny Pilot keeps your whole financial
            picture organized and easy to understand.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {FEATURES.map(({ icon: Icon, title, description, span }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className={cn(
                "group relative rounded-2xl border border-black/5 bg-white/60 p-6 transition-all hover:border-teal/30 hover:shadow-xl hover:shadow-teal/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-teal/40 dark:hover:shadow-teal/10",
                span
              )}
            >
              <div className="mb-4 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal dark:bg-teal/20">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-navy dark:text-white">{title}</h3>
              <p className="mt-2 text-sm text-navy/60 dark:text-white/60">{description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
