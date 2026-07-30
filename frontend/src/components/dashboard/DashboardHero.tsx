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

// One consistent, high-contrast brand gradient rather than three distinct
// per-period skies — the earlier per-period colors were low-contrast in
// light mode against dark title text. Still fully time-aware via the
// greeting copy/icon/emoji below; only the background is now unified.
const HERO_SKY = "from-sky-100 via-indigo-50 to-purple-100 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900";

const PERIOD_META: Record<Period, { greeting: string; icon: typeof Sunrise }> = {
  morning: { greeting: "Good Morning", icon: Sunrise },
  afternoon: { greeting: "Good Afternoon", icon: CloudSun },
  night: { greeting: "Clear Skies Tonight", icon: MoonStar },
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
    const id = Date.now();
    setCoinDrops((d) => [...d, id]);
    setTimeout(() => setCoinDrops((d) => d.filter((c) => c !== id)), 1000);
  };

  return (
    <div ref={heroRef} className="relative mb-6 overflow-hidden rounded-3xl border border-white/10" style={{ willChange: "transform" }}>
      {/* Background sky gradient */}
      <motion.div className={cn("absolute inset-0 bg-gradient-to-br", HERO_SKY)} style={{ opacity: skyOpacity }} />

      {/* Midground: parallax clouds + mountains, slower than scroll */}
      <motion.div className="pointer-events-none absolute inset-0 opacity-40" style={{ y: cloudsY, willChange: "transform" }} aria-hidden>
        <Mountain className="absolute -bottom-2 left-4 h-16 w-16 text-navy/20 dark:text-white/30 sm:h-20 sm:w-20" />
        <Mountain className="absolute -bottom-4 left-20 h-20 w-20 text-navy/15 dark:text-white/20 sm:h-28 sm:w-28" />
        <motion.div animate={{ x: [0, 16, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} className="absolute right-16 top-6">
          <Cloud className="h-8 w-8 text-navy/25 dark:text-white/40" />
        </motion.div>
        <motion.div animate={{ x: [0, -20, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }} className="absolute right-40 top-14">
          <Cloud className="h-6 w-6 text-navy/20 dark:text-white/30" />
        </motion.div>
      </motion.div>

      {/* Foreground: paper plane + drifting coins, faster than scroll */}
      <motion.div className="pointer-events-none absolute inset-0" style={{ y: foregroundY, willChange: "transform" }} aria-hidden>
        <motion.div
          className="absolute right-10 top-8 sm:right-16"
          animate={{ x: [0, -14, 0], y: [0, 8, 0], rotate: [0, -6, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Send className="h-5 w-5 -rotate-45 text-navy/40 drop-shadow dark:text-white/70" />
        </motion.div>
        <motion.div className="absolute bottom-6 right-24" animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
          <GoldCoin size="1.1rem" spinDuration={3} />
        </motion.div>
        <motion.div className="absolute bottom-10 right-8" animate={{ y: [0, -14, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}>
          <GoldCoin size="0.8rem" spinDuration={2.4} />
        </motion.div>
      </motion.div>

      {/* Content — extra bottom padding reserves clearance so the
          absolutely-positioned scroll indicator never overlaps the balance
          breakdown when it expands (the indicator also fades out itself
          whenever the breakdown is open, belt-and-suspenders). */}
      <div className="relative z-10 p-4 pb-14 sm:p-6 sm:pb-16">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="flex items-start gap-3">
          <motion.div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/50 backdrop-blur-sm dark:bg-white/10 sm:h-11 sm:w-11"
            animate={period === "morning" ? { y: [0, -4, 0] } : period === "night" ? { rotate: [0, 8, 0] } : undefined}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Icon className="h-5 w-5 text-slate-900 dark:text-white sm:h-[22px] sm:w-[22px]" />
          </motion.div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-snug text-slate-900 dark:text-white sm:text-xl md:text-2xl">
              {meta.greeting}, {firstName ? firstName : "Pilot"} {EMOJI[period]}
            </h1>
            <p className="text-xs text-slate-600 dark:text-white/60 sm:text-sm">Here&apos;s how your finances are looking today.</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/50 px-3 py-1.5 text-xs font-medium text-slate-900 backdrop-blur-sm dark:bg-white/10 dark:text-white sm:mt-4"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-300" />
          {insight}
        </motion.div>

        {/* Flex column — the pills sit permanently under the net worth
            figure now (no click needed), and pb-14/16 on the outer content
            wrapper above reserves clearance so the scroll indicator below
            never collides with them. */}
        <div className="relative mt-4 flex flex-col gap-3 sm:mt-5">
          <button
            type="button"
            onClick={handleBalanceClick}
            className="relative flex flex-col items-start rounded-2xl bg-white/40 p-4 text-left backdrop-blur-sm transition-colors hover:bg-white/50 dark:bg-white/5 dark:hover:bg-white/10 sm:p-6"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-white/50">Net Worth · Flight Deck Status</span>
            <span className="mt-0.5 text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">{netWorthLabel}</span>

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

          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-400">
              Income: {incomeLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-400">
              Expenses: {expenseLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Scroll indicator — kept strictly at the container's true bottom
          edge; the reserved bottom padding on the content wrapper (pb-14
          sm:pb-16) plus the pills' own mb-2 guarantees clearance so the two
          never overlap. Fades out as the user scrolls via indicatorOpacity. */}
      <motion.div
        style={{ opacity: indicatorOpacity }}
        className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-0.5 text-slate-500 dark:text-white/40"
      >
        <span className="text-[10px] font-medium tracking-wide">Scroll to explore</span>
        <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
      </motion.div>
    </div>
  );
}
