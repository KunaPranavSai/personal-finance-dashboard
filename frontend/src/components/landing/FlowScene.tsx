"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { INCOME_TOTAL, KEPT, SPENT } from "@/components/world/sample";
import { CountUp } from "./CountUp";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const STATS = [
  { label: "In", value: INCOME_TOTAL },
  { label: "Out", value: SPENT },
  { label: "Kept", value: KEPT },
] as const;

/** Scene 02 - Money flow. The sources have merged into one river; the figures are its text equivalent. */
export function FlowScene() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".flow-in > *", {
        y: 22,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: root.current, start: "top 65%", once: true },
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="flow"
      data-scene="flow"
      aria-labelledby="flow-title"
      className="pp-gsap relative flex min-h-[115svh] items-center px-4 py-24 sm:px-6 lg:px-8"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-pp-bg/75 lg:bg-transparent lg:bg-gradient-to-l lg:from-pp-bg/75 lg:via-pp-bg/25 lg:to-transparent" />
      <div className="relative mx-auto flex w-full max-w-6xl justify-end">
        <div className="flow-in max-w-lg lg:text-right">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-pp-accent">02 · Money flow</p>
          <h2 id="flow-title" className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tighter text-pp-text sm:text-5xl">
            Know where your money goes.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-pp-text-dim">
            What comes in, what goes out and what you keep sit in one view, so every rupee has a place.
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-pp-border pt-5 text-left lg:text-right">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-pp-text-dim">{s.label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-pp-text sm:text-2xl">
                  <CountUp value={s.value} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-pp-text-dim">Sample month, illustrative figures</p>
        </div>
      </div>
    </section>
  );
}
