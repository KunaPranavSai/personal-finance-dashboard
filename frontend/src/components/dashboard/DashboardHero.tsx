"use client";

import { RefObject, useMemo, useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Sunrise, CloudSun, MoonStar, Send, Cloud, Mountain, ChevronDown, Sparkles } from "lucide-react";
import { GoldCoin } from "@/components/ui/GoldCoin";
import { cn } from "@/lib/format";

type Period = "morning" | "afternoon" | "night";

function getPeriod(hour: number): Period {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "night";
}

const PERIOD_META: Record<Period, { greeting: string; icon: typeof Sunrise; sky: string }> = {
  morning: {
    greeting: "Good Morning",
    icon: Sunrise,
    sky: "from-sky-200 via-sky-300 to-amber-100 dark:from-[#1e2a4a] dark:via-[#233355] dark:to-[#3a2f52]",
  },
  afternoon: {
    greeting: "Good Afternoon",
    icon: CloudSun,
    sky: "from-sky-300 via-sky-200 to-blue-200 dark:from-[#18233f] dark:via-[#1f2c4d] dark:to-[#2a3459]",
  },
  night: {
    greeting: "Clear Skies Tonight",
    icon: MoonStar,
    sky: "from-indigo-200 via-blue-200 to-slate-200 dark:from-[#0b1024] dark:via-[#131a3a] dark:to-[#1c2450]",
  },
};

const EMOJI: Record<Period, string> = { morning: "🌅", afternoon: "🌤️", night: "🌌" };

interface DashboardHeroProps {
  firstName?: string;
  netWorthLabel: string;
  incomeLabel: string;
  expenseLabel: string;
  insight: string;
  scrollContainerRef: RefObject<HTMLElement | null>;
  heroRef: RefObject<HTMLDivElement | null>;
}

export function DashboardHero({ firstName, netWorthLabel, incomeLabel, expenseLabel, insight, scrollContainerRef, heroRef }: DashboardHeroProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [coinDrops, setCoinDrops] = useState<number[]>([]);

  const period = useMemo(() => getPeriod(new Date().getHours()), []);
  const meta = PERIOD_META[period];
  const Icon = meta.icon;

  const { scrollYProgress } = useScroll({
    target: heroRef as RefObject<HTMLElement>,
    container: scrollContainerRef as RefObject<HTMLElement>,
    offset: ["start start", "end start"],
  });
  const cloudsY = useTransform(scrollYProgress, [0, 1], [0, -24]);
  const foregroundY = useTransform(scrollYProgress, [0, 1], [0, -48]);
  const skyOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.5]);
  const indicatorOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);

  const handleBalanceClick = () => {
    setShowBreakdown((v) => !v);
    const id = Date.now();
    setCoinDrops((d) => [...d, id]);
    setTimeout(() => setCoinDrops((d) => d.filter((c) => c !== id)), 1000);
  };

  return (
    <div ref={heroRef} className="relative mb-6 overflow-hidden rounded-3xl border border-white/10" style={{ willChange: "transform" }}>
      {/* Background sky gradient */}
      <motion.div className={cn("absolute inset-0 bg-gradient-to-br", meta.sky)} style={{ opacity: skyOpacity }} />

      {/* Midground: parallax clouds + mountains, slower than scroll */}
      <motion.div className="pointer-events-none absolute inset-0 opacity-40" style={{ y: cloudsY, willChange: "transform" }} aria-hidden>
        <Mountain className="absolute -bottom-2 left-4 h-16 w-16 text-white/40 sm:h-20 sm:w-20" />
        <Mountain className="absolute -bottom-4 left-20 h-20 w-20 text-white/30 sm:h-28 sm:w-28" />
        <motion.div animate={{ x: [0, 16, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} className="absolute right-16 top-6">
          <Cloud className="h-8 w-8 text-white/50" />
        </motion.div>
        <motion.div animate={{ x: [0, -20, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }} className="absolute right-40 top-14">
          <Cloud className="h-6 w-6 text-white/40" />
        </motion.div>
      </motion.div>

      {/* Foreground: paper plane + drifting coins, faster than scroll */}
      <motion.div className="pointer-events-none absolute inset-0" style={{ y: foregroundY, willChange: "transform" }} aria-hidden>
        <motion.div
          className="absolute right-10 top-8 sm:right-16"
          animate={{ x: [0, -14, 0], y: [0, 8, 0], rotate: [0, -6, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Send className="h-5 w-5 -rotate-45 text-white/70 drop-shadow" />
        </motion.div>
        <motion.div className="absolute bottom-6 right-24" animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
          <GoldCoin size="1.1rem" spinDuration={3} />
        </motion.div>
        <motion.div className="absolute bottom-10 right-8" animate={{ y: [0, -14, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}>
          <GoldCoin size="0.8rem" spinDuration={2.4} />
        </motion.div>
      </motion.div>

      {/* Content */}
      <div className="relative z-10 p-5 sm:p-7">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="flex items-center gap-3">
          <motion.div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/30 backdrop-blur-sm dark:bg-white/10"
            animate={period === "morning" ? { y: [0, -4, 0] } : period === "night" ? { rotate: [0, 8, 0] } : undefined}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Icon className="h-[22px] w-[22px] text-navy dark:text-white" />
          </motion.div>
          <div>
            <h1 className="text-lg font-bold text-navy dark:text-white sm:text-xl">
              {meta.greeting}, {firstName ? firstName : "Pilot"} {EMOJI[period]}
            </h1>
            <p className="text-xs text-navy/60 dark:text-white/60 sm:text-sm">Here&apos;s how your finances are looking today.</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/40 px-3 py-1.5 text-xs font-medium text-navy backdrop-blur-sm dark:bg-white/10 dark:text-white"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-300" />
          {insight}
        </motion.div>

        <div className="relative mt-5">
          <button
            type="button"
            onClick={handleBalanceClick}
            className="relative flex flex-col items-start rounded-2xl bg-white/30 px-4 py-3 text-left backdrop-blur-sm transition-colors hover:bg-white/40 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-navy/50 dark:text-white/50">Net Worth · Flight Deck Status</span>
            <span className="mt-0.5 text-2xl font-extrabold text-navy dark:text-white sm:text-3xl">{netWorthLabel}</span>

            <AnimatePresence>
              {coinDrops.map((id) => (
                <motion.div
                  key={id}
                  className="pointer-events-none absolute left-1/2 top-1/2"
                  initial={{ opacity: 1, x: "-50%", y: "-50%", scale: 0.6 }}
                  animate={{ opacity: 0, y: "-140%", x: `${-50 + (id % 40) - 20}%`, scale: 1, rotate: 180 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                >
                  <GoldCoin size="1rem" spinDuration={0.6} />
                </motion.div>
              ))}
            </AnimatePresence>
          </button>

          <AnimatePresence>
            {showBreakdown && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="mt-2 flex gap-4 rounded-xl bg-white/20 px-4 py-2.5 text-xs backdrop-blur-sm dark:bg-white/5">
                  <span className="text-navy/70 dark:text-white/70">
                    Income: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{incomeLabel}</span>
                  </span>
                  <span className="text-navy/70 dark:text-white/70">
                    Expenses: <span className="font-semibold text-red-700 dark:text-red-400">{expenseLabel}</span>
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        style={{ opacity: indicatorOpacity }}
        className="pointer-events-none absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-0.5 text-navy/40 dark:text-white/40"
      >
        <span className="text-[10px] font-medium tracking-wide">Scroll to explore</span>
        <motion.div animate={{ y: [0, 4, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.div>
      </motion.div>
    </div>
  );
}
