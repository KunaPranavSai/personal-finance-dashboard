"use client";

import { motion } from "framer-motion";
import { Search, ClipboardList, BarChart3, ShieldCheck } from "lucide-react";

const BLOCKS = [
  {
    icon: Search,
    title: "Know Where Your Money Goes",
    description: "Track income and expenses and understand your spending patterns.",
  },
  {
    icon: ClipboardList,
    title: "Plan Before You Spend",
    description: "Use budgets, savings goals and financial planning tools to stay organized.",
  },
  {
    icon: BarChart3,
    title: "See the Bigger Picture",
    description: "Use reports, analytics and financial insights to understand your progress.",
  },
  {
    icon: ShieldCheck,
    title: "Keep Control of Your Data",
    description: "Choose the storage approach that fits you: Google Drive or Local-Only.",
  },
];

export function WhyPennyPilot() {
  return (
    <section aria-labelledby="why-heading" className="overflow-x-clip px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[5fr_7fr] lg:gap-20">
        <h2
          id="why-heading"
          className="self-start text-4xl font-semibold leading-[1.08] tracking-tighter text-pp-text sm:text-5xl lg:sticky lg:top-28"
        >
          Everything you need to understand your money
        </h2>

        <ul className="divide-y divide-pp-border">
          {BLOCKS.map((block) => (
            <motion.li
              key={block.title}
              initial={{ opacity: 0, x: 32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ x: 8 }}
              className="group flex items-start gap-5 py-8 first:pt-0"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-pp-border bg-pp-surface-2 transition-colors group-hover:bg-pp-accent">
                <block.icon className="h-5 w-5 text-pp-accent transition-colors group-hover:text-pp-accent-ink" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-pp-text">{block.title}</h3>
                <p className="mt-2 max-w-[48ch] text-base leading-relaxed text-pp-text-dim">{block.description}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
