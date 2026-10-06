"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { PillLink } from "./PillLink";

export function FinalCTA() {
  return (
    <section className="px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl p-px"
      >
        {/* Rotating conic edge: continuous, marks the one action the page wants. */}
        <div
          aria-hidden="true"
          className="lp-spin-border absolute -inset-[100%] bg-[conic-gradient(from_0deg,transparent_0_70%,var(--pp-accent)_100%)]"
        />
        <div className="relative rounded-[calc(1.5rem-1px)] bg-pp-surface px-8 py-16 text-center sm:px-16 sm:py-20">
          <h2 className="mx-auto max-w-[18ch] text-4xl font-semibold leading-[1.08] tracking-tighter text-pp-text sm:text-6xl">
            Ready to take control of your money?
          </h2>
          <p className="mt-4 text-lg text-pp-text-dim">Free to use, no credit card required.</p>
          <div className="mt-9">
            <PillLink href="/signup">
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </PillLink>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
