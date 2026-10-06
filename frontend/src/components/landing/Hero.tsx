"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { HeroPreview } from "./HeroPreview";
import { TakeTourButton } from "@/components/tour/TourHosts";
import { PillLink } from "./PillLink";

const WORDS = ["Take", "control", "of", "your", "money."];
const EASE = [0.16, 1, 0.3, 1] as const;

const container = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } } };
const word = { hidden: { y: "110%" }, show: { y: 0, transition: { duration: 0.8, ease: EASE } } };
const fade = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } };

export function Hero() {
  return (
    <section className="px-4 pb-20 pt-10 sm:px-6 lg:flex lg:min-h-[calc(100dvh-5rem)] lg:items-center lg:px-8 lg:pb-12 lg:pt-8">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <motion.div variants={container} initial="hidden" animate="show">

          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tighter text-pp-text sm:text-6xl lg:text-[4.5rem]">
            {WORDS.map((w, i) => (
              <span key={i} className="mr-[0.22em] inline-block overflow-hidden pb-[0.14em] align-bottom">
                <motion.span variants={word} className="inline-block">
                  {w}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p variants={fade} className="mt-5 max-w-[46ch] text-lg leading-relaxed text-pp-text-dim">
            Track income and expenses, set budgets, and reach savings goals in one place, without spreadsheets.
          </motion.p>

          <motion.div variants={fade} className="mt-8 flex flex-wrap items-center gap-3">
            <PillLink href="/signup">
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </PillLink>
            <PillLink href="/login" variant="ghost">
              Log In
            </PillLink>
            <TakeTourButton />
          </motion.div>
        </motion.div>

        <HeroPreview />
      </div>
    </section>
  );
}
