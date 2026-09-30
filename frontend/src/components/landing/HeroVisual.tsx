"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Wallet, ShoppingCart, PiggyBank, Target } from "lucide-react";

const TARGETS = [
  { icon: ShoppingCart, label: "Spending", y: 80, dur: 4.6, float: 5.5 },
  { icon: PiggyBank, label: "Savings", y: 250, dur: 4.0, float: 6.5 },
  { icon: Target, label: "Goals", y: 420, dur: 5.2, float: 7.5 },
];
const pathFor = (y: number) => `M90 250 C 260 250, 330 ${y}, 500 ${y}`;

/**
 * Conceptual illustration, not a product screenshot: money flows from income
 * into spending, savings and goals. Labels only, no figures or claims.
 * Flow particles are native SVG animateMotion (no JS per frame).
 */
export function HeroVisual() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto aspect-[6/5] w-full max-w-[560px]" aria-hidden="true">
      <svg viewBox="0 0 600 500" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="hv-stroke" gradientUnits="userSpaceOnUse" x1="90" y1="0" x2="500" y2="0">
            <stop offset="0" stopColor="#21F1A8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#21F1A8" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        {TARGETS.map((t, i) => (
          <g key={t.label}>
            <path d={pathFor(t.y)} fill="none" stroke="rgba(255,253,241,0.09)" strokeWidth="2" />
            <motion.path
              d={pathFor(t.y)}
              fill="none"
              stroke="url(#hv-stroke)"
              strokeWidth="2"
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, delay: 0.5 + i * 0.15, ease: [0.16, 1, 0.3, 1] }}
            />
            {!reduce &&
              [0, 1].map((k) => (
                <circle key={k} r="4" fill="#21F1A8">
                  <animateMotion
                    dur={`${t.dur}s`}
                    begin={`${1.6 + i * 0.4 + k * (t.dur / 2)}s`}
                    repeatCount="indefinite"
                    path={pathFor(t.y)}
                  />
                </circle>
              ))}
          </g>
        ))}
      </svg>

      <Node left="15%" top="50%" icon={Wallet} label="Income" big float={6} pulse />
      {TARGETS.map((t) => (
        <Node key={t.label} left="83.3%" top={`${(t.y / 500) * 100}%`} icon={t.icon} label={t.label} float={t.float} />
      ))}
    </div>
  );
}

function Node({
  left,
  top,
  icon: Icon,
  label,
  big,
  float,
  pulse,
}: {
  left: string;
  top: string;
  icon: typeof Wallet;
  label: string;
  big?: boolean;
  float: number;
  pulse?: boolean;
}) {
  const reduce = useReducedMotion();
  const size = big ? "h-16 w-16 sm:h-20 sm:w-20" : "h-12 w-12 sm:h-16 sm:w-16";
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left, top }}>
      <motion.div
        animate={reduce ? undefined : { y: [0, -7, 0] }}
        transition={{ duration: float, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex flex-col items-center"
      >
        {pulse && !reduce && (
          <motion.span
            className={`absolute rounded-full border border-tiffany/60 ${size}`}
            animate={{ scale: [1, 1.9], opacity: [0.6, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span
          className={`relative flex items-center justify-center rounded-full border border-white/15 bg-noturno/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md ${size}`}
        >
          <Icon className="h-1/3 w-1/3 text-tiffany" strokeWidth={1.75} />
        </span>
        <span className="absolute top-full mt-2 whitespace-nowrap text-[11px] font-medium text-pp-text-dim sm:text-xs">
          {label}
        </span>
      </motion.div>
    </div>
  );
}
