import Link from "next/link";
import Image from "next/image";
import { Wallet, PiggyBank, TrendingUp, Receipt } from "lucide-react";
import { Footer } from "@/components/layout/Footer";

const FEATURES = [
  { icon: Wallet, label: "Income & expenses", description: "Track every transaction in one place." },
  { icon: Receipt, label: "Budgets & bills", description: "Stay ahead of due dates and spending limits." },
  { icon: PiggyBank, label: "Savings goals", description: "Set targets and watch your progress." },
  { icon: TrendingUp, label: "Investments & reports", description: "See the full picture with analytics." },
];

/**
 * Public homepage. Server-rendered, no auth check, no client state — same
 * pattern as LegalPageShell — so it always returns 200 and is indexable for
 * both visitors and crawlers. Root layout's metadata (index,follow,
 * canonical "/", OG/Twitter using og-image.png) applies as-is.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface dark:bg-navy-dark">
      <header className="border-b border-black/5 px-4 py-3 dark:border-white/10 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Penny Pilot" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
            <span className="text-sm font-bold text-navy dark:text-white">Penny Pilot</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy/70 transition-colors hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-teal px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h1 className="text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-4xl">
            Your personal finances, all in one dashboard
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-navy/60 dark:text-white/60">
            Penny Pilot is a personal finance dashboard for tracking income, expenses, budgets, bills, savings, and
            investments in one secure place.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-teal px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-navy/15 px-6 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-black/5 dark:border-white/15 dark:text-white dark:hover:bg-white/5"
            >
              Log In
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, label, description }) => (
              <div
                key={label}
                className="rounded-2xl border border-black/5 bg-white/60 p-5 text-left dark:border-white/10 dark:bg-white/5"
              >
                <Icon className="h-6 w-6 text-teal" />
                <p className="mt-3 text-sm font-semibold text-navy dark:text-white">{label}</p>
                <p className="mt-1 text-sm text-navy/55 dark:text-white/55">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
