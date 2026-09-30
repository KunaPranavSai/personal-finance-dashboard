"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { UserPlus, PenLine, LineChart } from "lucide-react";

const STEPS = [
  { icon: UserPlus, title: "Create your account", description: "Sign up in a minute, no admin approval needed.", at: 0.04 },
  { icon: PenLine, title: "Add your finances", description: "Log income, expenses, budgets, bills, and goals.", at: 0.5 },
  { icon: LineChart, title: "Understand and plan", description: "See patterns and progress, then plan ahead.", at: 0.96 },
];

/** Node lights up as the scroll-driven line reaches it: shows the order of the process. */
function StepNode({ icon: Icon, at, progress }: { icon: typeof UserPlus; at: number; progress: MotionValue<number> }) {
  const bg = useTransform(progress, [at - 0.08, at], ["rgba(255,255,255,0.06)", "#21F1A8"]);
  const fg = useTransform(progress, [at - 0.08, at], ["#FFFDF1", "#00201A"]);
  return (
    <motion.span
      style={{ backgroundColor: bg, color: fg }}
      className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-white/15"
    >
      <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
    </motion.span>
  );
}

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className="px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 id="how-it-works-heading" className="text-4xl font-semibold tracking-tighter text-pp-text sm:text-5xl">
          How Penny Pilot works
        </h2>

        <div ref={ref} className="relative mt-14 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
          {/* Track (md+ horizontal, mobile vertical) */}
          <div className="absolute left-7 top-7 bottom-7 w-px bg-white/10 md:hidden" aria-hidden="true">
            <motion.div style={{ scaleY: fill }} className="h-full origin-top bg-tiffany" />
          </div>
          <div className="absolute left-[16.66%] right-[16.66%] top-7 hidden h-px bg-white/10 md:block" aria-hidden="true">
            <motion.div style={{ scaleX: fill }} className="h-full origin-left bg-tiffany" />
          </div>

          {STEPS.map((s) => (
            <div key={s.title} className="relative flex gap-5 md:flex-col md:items-center md:gap-0 md:text-center">
              <StepNode icon={s.icon} at={s.at} progress={scrollYProgress} />
              <div className="md:mt-6">
                <h3 className="text-xl font-semibold tracking-tight text-pp-text">{s.title}</h3>
                <p className="mt-2 max-w-[30ch] text-base leading-relaxed text-pp-text-dim md:mx-auto">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
