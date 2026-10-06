"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/** Pulls its child toward the cursor within `radius` px; springs back on leave. Off for touch / reduced motion. */
export function Magnetic({ children, radius = 90, pull = 0.32 }: { children: React.ReactNode; radius?: number; pull?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mq = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)");
      if (!mq.matches) return;
      const qx = gsap.quickTo(el, "x", { duration: 0.9, ease: "elastic.out(1, 0.35)" });
      const qy = gsap.quickTo(el, "y", { duration: 0.9, ease: "elastic.out(1, 0.35)" });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const inside = Math.hypot(dx, dy) < radius + Math.max(r.width, r.height) / 2;
        qx(inside ? dx * pull : 0);
        qy(inside ? dy * pull : 0);
      };
      window.addEventListener("pointermove", move, { passive: true });
      return () => window.removeEventListener("pointermove", move);
    },
    { scope: ref },
  );
  return (
    <span ref={ref} className="inline-flex will-change-transform">
      {children}
    </span>
  );
}
