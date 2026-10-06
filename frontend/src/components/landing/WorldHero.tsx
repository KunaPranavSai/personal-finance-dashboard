"use client";

import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { PillLink } from "./PillLink";
import { TakeTourButton } from "@/components/tour/TourHosts";
import { Magnetic } from "@/components/world/Magnetic";
import { world } from "@/components/world/world";

gsap.registerPlugin(useGSAP);

const WORDS = ["Take", "control", "of", "your", "money."];

/**
 * Hero = the arrival. DOM owns the words (SEO, a11y, LCP); the canvas behind it
 * gathers income into the Penny Pilot mark. Every animation here writes to `world`
 * or transforms; nothing is required to read the page.
 */
export function WorldHero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      world.reduced = reduce;
      if (reduce) {
        world.intro = 1;
        world.form = 1;
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      // words rise out of a mask (no opacity: text is painted from first render)
      tl.from(".hc", { yPercent: 115, rotate: 5, duration: 1.1, stagger: 0.028 }, 0.15)
        .from(".hs", { y: 18, opacity: 0, duration: 0.9, stagger: 0.12 }, 0.8)
        .to(world, { intro: 1, duration: 3.4, ease: "power3.inOut" }, 0)
        .to(world, { form: 1, duration: 3.6, ease: "power2.inOut" }, 0.5);

      // kinetic type at rest: letters near the cursor lift slightly
      const chars = gsap.utils.toArray<HTMLElement>(".hc");
      let off: (() => void) | undefined;
      if (window.matchMedia("(pointer: fine)").matches) {
        const toY = chars.map((c) => gsap.quickTo(c, "y", { duration: 0.5, ease: "power3.out" }));
        let raf = 0;
        let mx = 0;
        let my = 0;
        const run = () => {
          raf = 0;
          chars.forEach((c, i) => {
            const r = c.getBoundingClientRect();
            const d = Math.hypot(mx - (r.left + r.width / 2), my - (r.top + r.height / 2));
            toY[i](-Math.max(0, 1 - d / 160) * 9);
          });
        };
        const move = (e: PointerEvent) => {
          mx = e.clientX;
          my = e.clientY;
          if (!raf) raf = requestAnimationFrame(run);
        };
        tl.eventCallback("onComplete", () => window.addEventListener("pointermove", move, { passive: true }));
        off = () => {
          window.removeEventListener("pointermove", move);
          cancelAnimationFrame(raf);
        };
      }
      return () => off?.();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      aria-labelledby="hero-title"
      data-scene="hero"
      className="pp-gsap relative flex min-h-[100dvh] items-end px-4 pb-20 pt-28 sm:px-6 lg:items-center lg:px-8 lg:pb-12"
    >
      {/* legibility scrim for the copy column; the world stays visible to the right */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-pp-bg/85 via-pp-bg/30 to-transparent lg:bg-gradient-to-r lg:from-pp-bg/80 lg:via-pp-bg/35 lg:to-transparent" />
      <div className="relative mx-auto w-full max-w-6xl">
        <div className="max-w-xl">
          <p className="hs font-[family-name:var(--font-wordmark)] text-xl tracking-wide text-pp-accent">Penny Pilot</p>
          <h1
            id="hero-title"
            aria-label={WORDS.join(" ")}
            className="mt-3 text-5xl font-semibold leading-[1.05] tracking-tighter text-pp-text sm:text-6xl lg:text-[4.5rem]"
          >
            {WORDS.map((w, i) => (
              <span key={i} aria-hidden="true" className="mr-[0.22em] inline-block whitespace-nowrap">
                {Array.from(w).map((ch, j) => (
                  <span key={j} className="inline-block overflow-hidden pb-[0.14em] align-bottom">
                    <span className="hc inline-block will-change-transform">{ch}</span>
                  </span>
                ))}
              </span>
            ))}
          </h1>
          <p className="hs mt-5 max-w-[46ch] text-lg leading-relaxed text-pp-text-dim">
            Track income and expenses, set budgets, and reach savings goals in one place, without spreadsheets.
          </p>
          <div className="hs mt-8 flex flex-wrap items-center gap-3">
            <Magnetic>
              <PillLink href="/signup">
                Get Started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </PillLink>
            </Magnetic>
            <PillLink href="/login" variant="ghost">
              Log In
            </PillLink>
            <TakeTourButton />
          </div>
        </div>
      </div>
      <p aria-hidden="true" className="hs pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-[11px] uppercase tracking-[0.3em] text-pp-text-dim sm:block">
        Scroll to fly
      </p>
    </section>
  );
}
