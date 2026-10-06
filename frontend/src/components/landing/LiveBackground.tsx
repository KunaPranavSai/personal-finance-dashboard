"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

/**
 * Fixed, continuously moving backdrop: three drifting teal/mint orbs, a slowly
 * scrolling grid, and a soft spotlight that trails the pointer. Motion here is
 * ambient (sets the "live product" tone); it is all transform-based and
 * collapses to static under prefers-reduced-motion.
 */
export function LiveBackground() {
  const reduce = useReducedMotion();
  const x = useMotionValue(-600);
  const y = useMotionValue(-600);
  const sx = useSpring(x, { stiffness: 60, damping: 20, mass: 0.8 });
  const sy = useSpring(y, { stiffness: 60, damping: 20, mass: 0.8 });

  useEffect(() => {
    if (reduce) return;
    const move = (e: PointerEvent) => {
      x.set(e.clientX - 300);
      y.set(e.clientY - 300);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reduce, x, y]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="lp-drift-a absolute -left-[15vmax] -top-[20vmax] h-[60vmax] w-[60vmax] rounded-full bg-pp-accent opacity-[0.12] blur-[110px] will-change-transform" />
      <div className="lp-drift-b absolute -bottom-[25vmax] -right-[10vmax] h-[50vmax] w-[50vmax] rounded-full bg-pp-accent opacity-[0.08] blur-[120px] will-change-transform" />
      <div className="lp-drift-c absolute left-[35vw] top-[28vh] h-[36vmax] w-[36vmax] rounded-full bg-pp-accent opacity-[0.06] blur-[120px] will-change-transform" />

      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_50%_25%,black,transparent_72%)]">
        <div
          className="lp-grid-move absolute inset-x-0 -top-16 bottom-0"
          style={{
            backgroundImage:
              "linear-gradient(var(--pp-border) 1px, transparent 1px), linear-gradient(90deg, var(--pp-border) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      {!reduce && (
        <motion.div
          style={{ x: sx, y: sy }}
          className="absolute left-0 top-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--pp-accent)_12%,transparent),transparent_65%)]"
        />
      )}
    </div>
  );
}
