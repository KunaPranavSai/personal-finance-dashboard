import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HeroVisual } from "./HeroVisual";

export function Hero() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center rounded-full bg-pp-chip-bg px-3 py-1 text-xs font-semibold text-pp-accent">
            Smart Money Management
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-pp-text sm:text-5xl">
            Take control of your money.
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-lg text-pp-text-dim lg:mx-0">
            Penny Pilot is a personal finance app for anyone who wants a clearer picture of their money. Track income and expenses, set budgets, and work toward your savings goals — all in one place, without spreadsheets.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-pp-accent px-6 py-3 text-sm font-semibold text-pp-accent-ink transition-opacity hover:opacity-90 sm:w-auto"
            >
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-pp-border px-6 py-3 text-sm font-semibold text-pp-text transition-colors hover:bg-pp-surface-2 sm:w-auto"
            >
              Log In
            </Link>
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}
