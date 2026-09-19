"use client";

import { motion } from "framer-motion";
import { Minimize2, Eye, Brain, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/format";

const BENEFITS = [
  {
    icon: Minimize2,
    title: "Less scattered information",
    description: "Keep important financial information organized in one place — no more spreadsheets, notes apps, and mental math scattered across devices.",
    outcome: "Single source of truth for your money",
  },
  {
    icon: Eye,
    title: "Clearer financial picture",
    description: "See income, expenses, budgets, savings goals, investments, and net worth together on one dashboard. Understand where you stand at a glance.",
    outcome: "Full visibility in seconds",
  },
  {
    icon: Brain,
    title: "Better awareness",
    description: "Understand spending patterns and financial trends through interactive charts and analytics. Spot category spikes, seasonal changes, and progress toward goals.",
    outcome: "Insights that drive better decisions",
  },
  {
    icon: Shield,
    title: "Built around your privacy",
    description: "Your financial data stays in your Google Drive or local browser storage. No third-party trackers, no data selling, encrypted tokens, restricted OAuth scopes.",
    outcome: "You own and control your data",
  },
  {
    icon: Sparkles,
    title: "Works the way you do",
    description: "Install as a PWA on any device, works offline, automatic updates. Responsive design adapts from mobile to desktop. Dark/light mode with system preference detection.",
    outcome: "Native app feel, zero friction",
  },
  {
    icon: Minimize2,
    title: "No lock-in, no surprises",
    description: "Export your data anytime. Disconnect Google Drive without losing files. Self-hostable architecture. No subscription fees for core features. Transparent about what's free vs planned.",
    outcome: "Freedom to stay or leave",
  },
];

export function Benefits() {
  return (
    <section id="benefits" className="py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-semibold text-teal dark:bg-teal/20 dark:border-teal/40"
          >
            <span className="relative h-1.5 w-1.5 rounded-full bg-teal animate-pulse" aria-hidden="true" />
            WHY PENNY PILOT
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-4xl"
          >
            Outcomes, not just features
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 mx-auto max-w-2xl text-lg text-navy/60 dark:text-white/60"
          >
            Penny Pilot helps you move from financial chaos to clarity — with tools that respect your privacy and put you in control.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, description, outcome }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={cn(
                "group relative rounded-2xl border border-black/5 bg-white/60 p-6 transition-all hover:border-teal/30 hover:shadow-xl hover:shadow-teal/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-teal/40 dark:hover:shadow-teal/10"
              )}
            >
              <div className="mb-4 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal dark:bg-teal/20">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-navy dark:text-white">{title}</h3>
              <p className="mt-2 text-sm text-navy/60 dark:text-white/60">{description}</p>
              <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/10">
                <p className="text-xs font-medium text-teal dark:text-teal">{outcome}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}