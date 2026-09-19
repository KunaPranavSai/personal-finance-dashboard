"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { HeartPulse, PieChart, LineChart, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/format";

// recharts' ResponsiveContainer measures its container client-side only, so
// server-rendering these charts mismatches the client render on hydration —
// load them client-only, same as the authenticated dashboard does.
const ChartSkeleton = () => <div className="h-[280px] w-full animate-pulse rounded-2xl bg-navy/5 dark:bg-white/5" />;
const IncomeExpenseChart = dynamic(() => import("@/components/charts/IncomeExpenseChart").then((m) => m.IncomeExpenseChart), { ssr: false, loading: ChartSkeleton });
const FinancialHealthGauge = dynamic(() => import("@/components/charts/FinancialHealthGauge").then((m) => m.FinancialHealthGauge), { ssr: false, loading: ChartSkeleton });
const DemoCategoryDonut = dynamic(() => import("./DemoDashboard").then((m) => m.DemoCategoryDonut), { ssr: false, loading: ChartSkeleton });

const DEMO_TREND = [
  { month: "Apr", income: 92000, expense: 58000 },
  { month: "May", income: 88000, expense: 61000 },
  { month: "Jun", income: 95000, expense: 54000 },
  { month: "Jul", income: 91000, expense: 57000 },
  { month: "Aug", income: 98000, expense: 52000 },
  { month: "Sep", income: 94000, expense: 49000 },
];

const SHOWCASE_ITEMS = [
  {
    id: "financial-health",
    title: "Know your financial health at a glance",
    description: "A single score — built from your savings rate, budget discipline, and emergency fund coverage — tells you exactly where you stand, no spreadsheet required.",
    highlights: ["Savings rate & cash flow", "Budget utilization", "Emergency fund coverage"],
    icon: HeartPulse,
    visual: <FinancialHealthGauge score={82} />,
  },
  {
    id: "spending-patterns",
    title: "See exactly where your money goes",
    description: "An interactive category breakdown turns a month of transactions into a picture you can actually read — click any slice to drill in.",
    highlights: ["Category-level breakdowns", "Toggle categories on/off", "Spot spikes early"],
    icon: PieChart,
    visual: <DemoCategoryDonut />,
  },
  {
    id: "income-vs-expense",
    title: "Track income against spending over time",
    description: "Six months of income and expenses in one chart, with net cash flow called out — so trends are obvious, not buried in rows of numbers.",
    highlights: ["Income vs. expense trend", "Net cash flow by month", "Toggle series on/off"],
    icon: LineChart,
    visual: <IncomeExpenseChart data={DEMO_TREND} />,
  },
];

export function ProductShowcase() {
  return (
    <section id="showcase" className="py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center sm:mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-4xl">
            Financial intelligence, built in
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-navy/60 dark:text-white/60">
            The same charts and scoring shown here run live on your own data once you&apos;re
            signed in — these are illustrative examples, not your data.
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
              className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12"
            >
              <div className={cn("lg:col-span-7", index % 2 === 1 && "lg:col-start-6")}>{item.visual}</div>

              <div className={cn("lg:col-span-5", index % 2 === 0 ? "lg:col-start-8" : "lg:col-start-1")}>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal/10 text-teal dark:bg-teal/20">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-navy dark:text-white sm:text-3xl">{item.title}</h3>
                <p className="mb-6 text-lg text-navy/60 dark:text-white/60">{item.description}</p>

                <ul className="mb-6 space-y-3">
                  {item.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-3 text-navy/70 dark:text-white/70">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal dark:bg-teal/20">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-teal/90 hover:shadow-lg hover:shadow-teal/25",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
                  )}
                >
                  Try it yourself
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
