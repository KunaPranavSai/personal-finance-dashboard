"use client";

import { motion } from "framer-motion";
import { TrendingUp, CreditCard, Target, BarChart3, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/format";

const SHOWCASE_ITEMS = [
  {
    id: "know-where-you-stand",
    title: "Know where your money stands",
    description: "The dashboard gives you an instant snapshot of your financial health — net worth, income vs expenses, savings rate, budget usage, emergency fund progress, and investment growth all in one view.",
    highlights: [
      "Real-time net worth tracking",
      "Monthly income & expense comparison",
      "Savings rate & cash flow monitoring",
      "Financial health score (0–100)",
    ],
    icon: TrendingUp,
    chartType: "networth",
  },
  {
    id: "turn-spending-into-plan",
    title: "Turn spending into a plan",
    description: "Set budgets by category, track recurring bills, and see exactly how your monthly spending aligns with your plan. Visual progress bars and status indicators keep you informed at a glance.",
    highlights: [
      "Monthly, quarterly, yearly budgets",
      "Category-level budget tracking",
      "Bill reminders & auto-pay tracking",
      "Utilization % with status badges",
    ],
    icon: CreditCard,
    chartType: "budget",
  },
  {
    id: "build-toward-goals",
    title: "Build toward your goals",
    description: "Create savings goals for emergencies, large purchases, or future plans. Track investments with current values, returns, and contribution schedules. Watch progress bars fill as you move closer to each target.",
    highlights: [
      "Goal categories (Emergency Fund, etc.)",
      "Target amount & monthly contribution",
      "Investment portfolio tracking",
      "Visual progress indicators",
    ],
    icon: Target,
    chartType: "goals",
  },
  {
    id: "understand-patterns",
    title: "Understand your financial patterns",
    description: "Dive into analytics with interactive charts — income vs expense trends, category breakdowns, payment method analysis, and monthly reports. Toggle series on/off to focus on what matters.",
    highlights: [
      "6-month income/expense trend",
      "Category donut chart with toggles",
      "Payment method breakdown",
      "Exportable monthly reports",
    ],
    icon: BarChart3,
    chartType: "analytics",
  },
];

function MockChart({ type }: { type: string }) {
  if (type === "networth") {
    return (
      <svg viewBox="0 0 300 160" className="w-full h-full" aria-hidden="true">
        <defs>
          <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0EA5A5" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#0EA5A5" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d="M10,140 L30,110 L50,125 L70,90 L90,105 L110,75 L130,90 L150,60 L170,80 L190,50 L210,70 L230,45 L250,60 L270,40 L290,35" stroke="#0EA5A5" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10,140 L30,110 L50,125 L70,90 L90,105 L110,75 L130,90 L150,60 L170,80 L190,50 L210,70 L230,45 L250,60 L270,40 L290,35 L290,140 L10,140 Z" fill="url(#nwGrad)" />
        {[30, 70, 110, 150, 190, 230, 270].map((x, i) => (
          <circle key={i} cx={x} cy={140 - [110, 90, 75, 60, 50, 45, 35][i]} r="3.5" fill="#0EA5A5" />
        ))}
      </svg>
    );
  }
  if (type === "budget") {
    const budgets = [
      { label: "Food", pct: 78, color: "#10B981" },
      { label: "Transport", pct: 45, color: "#10B981" },
      { label: "Shopping", pct: 92, color: "#F59E0B" },
      { label: "Entertainment", pct: 110, color: "#F43F5E" },
    ];
    return (
      <div className="w-full h-full flex flex-col justify-center gap-3" aria-hidden="true">
        {budgets.map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-20 text-sm text-navy/60 dark:text-white/60">{b.label}</span>
            <div className="flex-1 h-5 rounded-full bg-navy/10 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(b.pct, 100)}%`, background: b.color }} />
            </div>
            <span className="w-14 text-right text-sm font-medium" style={{ color: b.color }}>{b.pct}%</span>
          </div>
        ))}
      </div>
    );
  }
  if (type === "goals") {
    const goals = [
      { label: "Emergency Fund", pct: 78, current: "₹3.9L", target: "₹5L" },
      { label: "Europe Trip", pct: 34, current: "₹68K", target: "₹2L" },
      { label: "New Car", pct: 12, current: "₹1.2L", target: "₹10L" },
    ];
    return (
      <div className="w-full h-full flex flex-col justify-center gap-3" aria-hidden="true">
        {goals.map((g, i) => (
          <div key={i} className="rounded-lg bg-white/50 dark:bg-white/10 p-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-navy dark:text-white">{g.label}</span>
              <span className="text-navy/50 dark:text-white/50">{g.current} / {g.target}</span>
            </div>
            <div className="h-3 rounded-full bg-navy/10 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-teal" style={{ width: `${g.pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-teal font-medium">{g.pct}% complete</p>
          </div>
        ))}
      </div>
    );
  }
  if (type === "analytics") {
    const categories = [
      { label: "Food & Dining", pct: 32, color: "#06B6D4" },
      { label: "Transport", pct: 22, color: "#6366F1" },
      { label: "Shopping", pct: 18, color: "#F59E0B" },
      { label: "Bills", pct: 15, color: "#F43F5E" },
      { label: "Other", pct: 13, color: "#10B981" },
    ];
    return (
      <div className="w-full h-full flex items-center justify-center" aria-hidden="true">
        <svg width="140" height="140" viewBox="0 0 140 140">
          {categories.map((c, i) => {
            const startAngle = -90 + categories.slice(0, i).reduce((a, b) => a + b.pct * 3.6, 0);
            const endAngle = startAngle + c.pct * 3.6;
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;
            const x1 = 70 + 50 * Math.cos(startRad);
            const y1 = 70 + 50 * Math.sin(startRad);
            const x2 = 70 + 50 * Math.cos(endRad);
            const y2 = 70 + 50 * Math.sin(endRad);
            const largeArc = c.pct > 50 ? 1 : 0;
            return (
              <path
                key={i}
                d={`M70,70 L${x1},${y1} A50,50 0 ${largeArc},1 ${x2},${y2} Z`}
                fill={c.color}
                stroke="#0f1420"
                strokeWidth={2}
              />
            );
          })}
          <circle cx="70" cy="70" r="30" fill="#0f1420" />
        </svg>
      </div>
    );
  }
  return null;
}

export function ProductShowcase() {
  return (
    <section id="showcase" className="py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-4xl">
            Your finances, one place
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-lg text-navy/60 dark:text-white/60">
            Move from scattered spreadsheets and mental math to a single, organized dashboard
            that shows you the full picture.
          </p>
        </div>

        <div className="space-y-16 sm:space-y-20">
          {SHOWCASE_ITEMS.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={cn(
                "grid lg:grid-cols-12 gap-8 lg:gap-12 items-center",
                index % 2 === 1 && "lg:[grid-template-columns:1fr_1fr]"
              )}
            >
              {/* Visual/Chart side */}
              <div className={cn("relative lg:col-span-7", index % 2 === 1 && "lg:col-start-6")}>
                <div className="relative rounded-2xl border border-black/5 bg-white/60 shadow-2xl dark:border-white/10 dark:bg-navy-dark/60 overflow-hidden">
                  <div className="flex items-center gap-1.5 border-b border-black/5 px-4 py-3 dark:border-white/10">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-rose-400" />
                      <div className="h-3 w-3 rounded-full bg-amber-400" />
                      <div className="h-3 w-3 rounded-full bg-emerald-400" />
                    </div>
                  </div>
                  <div className="p-6 sm:p-8 lg:p-10">
                    <MockChart type={item.chartType} />
                  </div>
                </div>
                {/* Floating highlight badge */}
                <motion.div
                  className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 rounded-xl bg-teal px-4 py-3 shadow-xl text-white"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <p className="text-sm font-semibold">Live data from your dashboard</p>
                  <p className="text-xs text-teal/80">Updates in real-time as you add transactions</p>
                </motion.div>
              </div>

              {/* Content side */}
              <div className={cn("lg:col-span-5", index % 2 === 0 ? "lg:col-start-8" : "lg:col-start-1")}>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-semibold text-teal dark:bg-teal/20 dark:border-teal/40 mb-4">
                  <span className="relative h-1.5 w-1.5 rounded-full bg-teal animate-pulse" aria-hidden="true" />
                  {item.id.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")}
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-navy dark:text-white mb-4">{item.title}</h3>
                <p className="text-lg text-navy/60 dark:text-white/60 mb-6">{item.description}</p>
                
                <ul className="space-y-3 mb-6">
                  {item.highlights.map((highlight, i) => (
                    <motion.li
                      key={highlight}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.08 }}
                      className="flex items-start gap-3 text-navy/70 dark:text-white/70"
                    >
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal dark:bg-teal/20">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span>{highlight}</span>
                    </motion.li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-teal/90 hover:shadow-lg hover:shadow-teal/25",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
                  )}
                >
                  Try this feature
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}