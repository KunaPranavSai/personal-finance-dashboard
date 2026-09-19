import { motion } from "framer-motion";
import { Wallet, PiggyBank, TrendingUp, Receipt, Target, Shield, Smartphone, Cloud } from "lucide-react";
import { cn } from "@/lib/format";

const FEATURES = [
  {
    icon: Wallet,
    title: "Income & Expenses",
    description: "Track every transaction with categories, subcategories, tags, and notes. See where your money comes from and where it goes.",
  },
  {
    icon: Receipt,
    title: "Budgets & Bills",
    description: "Set monthly, quarterly, or yearly budgets per category. Track recurring bills with due dates, auto-pay, and reminders.",
  },
  {
    icon: PiggyBank,
    title: "Savings & Goals",
    description: "Create savings goals with target amounts and monthly contributions. Track progress visually with category-based goals.",
  },
  {
    icon: TrendingUp,
    title: "Investments",
    description: "Monitor your investment portfolio with current values, returns, monthly contributions, and platform tracking.",
  },
  {
    icon: Target,
    title: "Analytics & Reports",
    description: "Understand spending patterns with category breakdowns, monthly trends, payment method analysis, and custom reports.",
  },
  {
    icon: Shield,
    title: "Privacy-Focused",
    description: "Your financial data stays in your Google Drive or local browser storage. No third-party trackers, no data selling.",
  },
  {
    icon: Cloud,
    title: "Google Drive Backup",
    description: "Optional encrypted backup to your own Google Drive using restricted drive.file scope. You own and control your data.",
  },
  {
    icon: Smartphone,
    title: "Installable PWA",
    description: "Install Penny Pilot as a native app on any device. Works offline, gets automatic updates, no app store required.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-16 sm:py-24 lg:py-32 bg-white/30 dark:bg-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-4xl">
            Everything you need to master your finances
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-lg text-navy/60 dark:text-white/60">
            Penny Pilot brings all your financial tools together in one secure, privacy-focused dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }, i) => (
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
              <div className="mt-4 h-0.5 w-full bg-teal/20 dark:bg-teal/40" aria-hidden="true" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}