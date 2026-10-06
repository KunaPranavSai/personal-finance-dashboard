"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { inr } from "@/components/world/sample";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Renders the final figure in HTML (SEO, no-JS, reduced motion); counts up once when scrolled into view. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen: leave it
      const o = { v: 0 };
      el.textContent = inr(0);
      ScrollTrigger.create({
        trigger: el,
        start: "top 88%",
        once: true,
        onEnter: () =>
          gsap.to(o, {
            v: value,
            duration: 1.6,
            ease: "power3.out",
            onUpdate: () => void (el.textContent = inr(o.v)),
            onComplete: () => void (el.textContent = inr(value)),
          }),
      });
    },
    { scope: ref, dependencies: [value] },
  );
  return (
    <span ref={ref} className={className}>
      {inr(value)}
    </span>
  );
}
