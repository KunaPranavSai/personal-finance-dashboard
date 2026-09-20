"use client";

import { motion } from "framer-motion";
import { Wallet, ShoppingCart, PiggyBank, Target, ArrowDown } from "lucide-react";

const FLOW = [
  { icon: Wallet, label: "Income" },
  { icon: ShoppingCart, label: "Spending" },
  { icon: PiggyBank, label: "Savings" },
  { icon: Target, label: "Goals" },
];

/**
 * Original conceptual illustration — not a product screenshot. Shows the
 * general idea "money flows from income through spending into savings and
 * goals" using generic icons and labels only, no numbers or claims.
 */
export function HeroVisual() {
  return (
    <div
      className="mx-auto flex w-full max-w-xs flex-col items-center gap-1 rounded-pp border border-pp-border bg-pp-surface p-6 shadow-pp"
      aria-hidden="true"
    >
      <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-pp-text-dim">
        Your Money, One Clear Picture
      </span>
      {FLOW.map((step, i) => (
        <div key={step.label} className="flex w-full flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: i * 0.1 }}
            className="flex w-full items-center gap-3 rounded-xl bg-pp-surface-2 px-4 py-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pp-accent/10">
              <step.icon className="h-4 w-4 text-pp-accent" />
            </div>
            <span className="text-sm font-medium text-pp-text">{step.label}</span>
          </motion.div>
          {i < FLOW.length - 1 && <ArrowDown className="my-1 h-3.5 w-3.5 text-pp-border" />}
        </div>
      ))}
    </div>
  );
}
