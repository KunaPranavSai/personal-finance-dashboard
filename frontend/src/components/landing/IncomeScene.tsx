"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { INCOME, INCOME_TOTAL, inr } from "@/components/world/sample";
import { world } from "@/components/world/world";
import { bus } from "@/components/world/bus";
import { CountUp } from "./CountUp";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Scene 01 - Income. The table is the text equivalent of the threads in the world behind it;
 * hovering or focusing a row lights that source's thread in 3D.
 */
export function IncomeScene() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".inc-seg", {
        scaleX: 0,
        transformOrigin: "left center",
        ease: "power3.out",
        duration: 1.1,
        stagger: 0.12,
        scrollTrigger: { trigger: ".inc-bar", start: "top 85%", once: true },
      });
      gsap.from(".inc-copy > *", {
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

  const light = (i: number) => {
    world.focusSrc = i;
    if (i >= 0) bus.emit("cue", { name: "income-source", value: i });
  };

  return (
    <section
      ref={root}
      id="income"
      data-scene="income"
      aria-labelledby="income-title"
      className="pp-gsap relative flex min-h-[115svh] items-center px-4 py-24 sm:px-6 lg:px-8"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-pp-bg/75 lg:bg-transparent lg:bg-gradient-to-r lg:from-pp-bg/75 lg:via-pp-bg/25 lg:to-transparent" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1fr_minmax(0,27rem)]">
        <div className="inc-copy max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-pp-accent">01 · Income</p>
          <h2 id="income-title" className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tighter text-pp-text sm:text-5xl">
            Everything that comes in, in one place.
          </h2>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-pp-text-dim">
            Log your salary, freelance work, interest and anything else. Penny Pilot adds it up and shows where it comes from.
          </p>
        </div>

        <div className="rounded-pp border border-pp-border bg-pp-surface p-5 shadow-pp sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-pp-text-dim">Income this month</p>
            <span className="rounded-full bg-pp-chip-bg px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-pp-text-dim">Sample data</span>
          </div>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-pp-text tabular-nums">
            <CountUp value={INCOME_TOTAL} />
          </p>

          <div aria-hidden="true" className="inc-bar mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full">
            {INCOME.map((s, i) => (
              <span key={s.id} className="inc-seg block h-full bg-pp-accent" style={{ width: `${(s.amount / INCOME_TOTAL) * 100}%`, opacity: 1 - i * 0.2 }} />
            ))}
          </div>

          <table className="mt-5 w-full text-sm">
            <caption className="sr-only">Sample month: where income comes from</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Amount</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pp-border">
              {INCOME.map((s, i) => (
                <tr
                  key={s.id}
                  tabIndex={0}
                  onPointerEnter={() => light(i)}
                  onPointerLeave={() => light(-1)}
                  onFocus={() => light(i)}
                  onBlur={() => light(-1)}
                  className="cursor-default transition-colors hover:bg-pp-chip-bg focus-visible:bg-pp-chip-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent"
                >
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium text-pp-text">
                    {s.label}
                  </th>
                  <td className="py-2.5 text-right font-mono tabular-nums text-pp-text">{inr(s.amount)}</td>
                  <td className="w-14 py-2.5 text-right font-mono tabular-nums text-pp-text-dim">{Math.round((s.amount / INCOME_TOTAL) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
