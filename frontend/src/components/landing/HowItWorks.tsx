"use client";

import { motion } from "framer-motion";
import { UserPlus, Database, TrendingUp, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/format";

const STEPS = [
  {
    number: "01",
    icon: UserPlus,
    title: "Create your account",
    description: "Sign up securely with your name, email, and password. Enable 2FA or passkeys for extra protection. Your account is active immediately — no admin approval required.",
    link: "/signup",
    linkText: "Create account",
  },
  {
    number: "02",
    icon: Database,
    title: "Organize your finances",
    description: "Add income, expenses, budgets, bills, savings goals, and investments. Choose Google Drive mode for cloud backup or This Device Only for local storage. Set up categories, accounts, and payment methods.",
    link: "/dashboard",
    linkText: "Explore dashboard",
  },
  {
    number: "03",
    icon: TrendingUp,
    title: "Understand your money",
    description: "Use the dashboard, analytics, and reports to see your financial health score, track spending patterns, monitor budget progress, and watch your savings and investments grow over time.",
    link: "/signup",
    linkText: "Get started",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 sm:py-24 lg:py-32 bg-white/30 dark:bg-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-semibold text-teal dark:bg-teal/20 dark:border-teal/40"
          >
            <span className="relative h-1.5 w-1.5 rounded-full bg-teal animate-pulse" aria-hidden="true" />
            HOW IT WORKS
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-4xl"
          >
            Three steps to financial clarity
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 mx-auto max-w-2xl text-lg text-navy/60 dark:text-white/60"
          >
            Penny Pilot is designed to get you up and running quickly. No complex setup, no bank linking required.
          </motion.p>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <motion.div
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="hidden lg:block absolute top-[60px] left-1/2 bottom-0 w-0.5 bg-teal/20 dark:bg-teal/40 -translate-x-1/2"
            style={{ transformOrigin: "top" }}
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.15 }}
                className="relative lg:pl-4"
              >
                {/* Step number badge */}
                <div className="absolute left-0 top-0 lg:left-[-1rem] lg:top-[50px] z-10 flex h-12 w-12 items-center justify-center rounded-full bg-teal text-white text-xl font-bold">
                  {step.number}
                </div>

                {/* Card */}
                <div className={cn(
                  "relative rounded-2xl border border-black/5 bg-white/60 p-6 lg:p-8 transition-all hover:border-teal/30 hover:shadow-xl hover:shadow-teal/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-teal/40 dark:hover:shadow-teal/10",
                  i === 1 && "ring-2 ring-teal/30 dark:ring-teal/40"
                )}>
                  {/* Recommended badge for middle card */}
                  {i === 1 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-xs font-semibold text-teal bg-teal/10 rounded-full dark:bg-teal/20">
                      Most important step
                    </div>
                  )}

                  <div className="mb-4 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal dark:bg-teal/20">
                    <step.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-semibold text-navy dark:text-white mb-3">{step.title}</h3>
                  <p className="text-navy/60 dark:text-white/60 mb-6">{step.description}</p>
                  
                  <Link
                    href={step.link}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg font-semibold transition-all",
                      i === 1
                        ? "bg-teal px-5 py-2.5 text-white hover:bg-teal/90"
                        : "border border-teal/30 bg-teal/10 px-5 py-2.5 text-teal hover:bg-teal/20 dark:bg-teal/20 dark:border-teal/40"
                    )}
                  >
                    {step.linkText}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}