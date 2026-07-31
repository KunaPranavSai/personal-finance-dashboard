"use client";

import { RefObject, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Sunrise, CloudSun, MoonStar, Send, Cloud, Mountain, ChevronDown, Sparkles } from "lucide-react";
import { GoldCoin } from "@/components/ui/GoldCoin";
import { cn } from "@/lib/format";
import { api } from "@/lib/api";
import type { DashboardSummary, Transaction, Investment } from "@/types";
import { buildFinancialSignals, computeFinancialInsight, computeHealthScore, HEALTH_TIER_META } from "@/lib/financialHealthEngine";

type Period = "morning" | "afternoon" | "night";

function getPeriod(hour: number): Period {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 19) return "afternoon";
  return "night";
}

const PERIOD_META: Record<Period, { greeting: string; badge: string; icon: typeof Sunrise; emoji: string }> = {
  morning: { greeting: "Good Morning", badge: "Golden Hour", icon: Sunrise, emoji: "🌅" },
  afternoon: { greeting: "Good Afternoon", badge: "Sunset Skies", icon: CloudSun, emoji: "🌤️" },
  night: { greeting: "Clear Skies Tonight", badge: "Clear Night", icon: MoonStar, emoji: "🌌" },
};

const SKY_GRADIENT: Record<Period, string> = {
  morning: "from-amber-200 via-orange-200 to-sky-300 dark:from-amber-950 dark:via-orange-950 dark:to-indigo-950",
  afternoon: "from-orange-300 via-rose-400 to-violet-600 dark:from-orange-900 dark:via-rose-950 dark:to-violet-950",
  night: "from-indigo-950 via-slate-900 to-slate-950",
};

/** Night's background is dark under either app theme, so header text/pills
 * need to stay light regardless of the light/dark toggle. */
const TEXT_CLASS: Record<Period, string> = {
  morning: "text-slate-900 dark:text-white",
  afternoon: "text-slate-900 dark:text-white",
  night: "text-white",
};
const PILL_CLASS: Record<Period, string> = {
  morning: "bg-white/50 dark:bg-white/10",
  afternoon: "bg-white/40 dark:bg-white/10",
  night: "bg-white/15",
};

interface DashboardHeroProps {
  firstName?: string;
  netWorthLabel: string;
  incomeLabel: string;
  expenseLabel: string;
  summary: DashboardSummary | undefined;
  scrollContainerRef: RefObject<HTMLElement | null>;
  heroRef: RefObject<HTMLDivElement | null>;
}

/** Slides/fades between 1-2 actionable tips every 6s, or immediately on tap. */
function TipCarousel({ tips, textClass, pillClass }: { tips: string[]; textClass: string; pillClass: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (tips.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % tips.length), 6000);
    return () => clearInterval(id);
  }, [tips.length]);

  return (
    <button
      type="button"
      onClick={() => setIndex((i) => (i + 1) % tips.length)}
      className={cn(
        "relative flex w-full items-start gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-left text-xs font-medium backdrop-blur-sm transition-colors sm:mt-4",
        textClass,
        pillClass
      )}
      aria-label="Next financial tip"
    >
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-300" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={index}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="block"
        >
          {tips[index]}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export function DashboardHero({
  firstName,
  netWorthLabel,
  incomeLabel,
  expenseLabel,
  summary,
  scrollContainerRef,
  heroRef,
}: DashboardHeroProps) {
  const [coinDrops, setCoinDrops] = useState<number[]>([]);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    setIsTouch(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const period = useMemo(() => getPeriod(new Date().getHours()), []);
  const meta = PERIOD_META[period];
  const Icon = meta.icon;
  const textClass = TEXT_CLASS[period];
  const pillClass = PILL_CLASS[period];

  // Small, self-contained pulls feeding the 42-rule financial health engine
  // (see lib/financialHealthEngine.ts) — recent transactions for
  // spending-pattern signals (category spikes, weekend drift, impulse buys,
  // large/overdue items) and investments for contribution-rate/portfolio
  // signals. Cheap, cached alongside the rest of the dashboard's queries.
  const { data: recentTx } = useQuery({
    queryKey: ["hero-recent-transactions"],
    queryFn: () => api.get<{ items: Transaction[] }>("/api/transactions?pageSize=50&sortBy=date&sortDir=desc"),
  });
  const { data: investments } = useQuery({
    queryKey: ["hero-investments"],
    queryFn: () => api.get<{ items: Investment[] }>("/api/investments"),
  });

  const signals = useMemo(
    () =>
      buildFinancialSignals({
        summary,
        transactions: recentTx?.items ?? [],
        investments: investments?.items ?? [],
        firstName: firstName || "Pilot",
      }),
    [summary, recentTx, investments, firstName]
  );
  const { tagline, tips } = useMemo(() => computeFinancialInsight(signals), [signals]);
  const { score, tier } = useMemo(() => computeHealthScore(signals), [signals]);
  const tierMeta = HEALTH_TIER_META[tier];

  const { scrollYProgress } = useScroll({
    target: heroRef as RefObject<HTMLElement>,
    container: scrollContainerRef as RefObject<HTMLElement>,
    offset: ["start start", "end start"],
  });
  // Touch devices get a flatter, cheaper parallax range — smaller transforms
  // mean fewer/lighter repaints per scroll frame, avoiding the jitter that
  // full-amplitude parallax causes on mobile GPUs.
  const parallaxScale = isTouch ? 0.4 : 1;
  const cloudsY = useTransform(scrollYProgress, [0, 1], [0, -24 * parallaxScale]);
  const foregroundY = useTransform(scrollYProgress, [0, 1], [0, -48 * parallaxScale]);
  const skyOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.5]);
  const indicatorOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);

  const handleBalanceClick = () => {
    const id = Date.now();
    setCoinDrops((d) => [...d, id]);
    setTimeout(() => setCoinDrops((d) => d.filter((c) => c !== id)), 1000);
  };

  return (
    <div ref={heroRef} className="relative mb-6 overflow-hidden rounded-3xl border border-white/10" style={{ willChange: "transform" }}>
      {/* Sky gradient, time-of-day accurate */}
      <motion.div className={cn("absolute inset-0 bg-gradient-to-br", SKY_GRADIENT[period])} style={{ opacity: skyOpacity }} />

      {/* Celestial body + mountains/mist, slower than scroll */}
      <motion.div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ y: cloudsY, willChange: "transform" }} aria-hidden>
        {period === "morning" && (
          <>
            <motion.div
              className="absolute bottom-[38%] left-1/2 h-16 w-16 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fef9c3,#fcd34d,#fb923c)] shadow-[0_0_60px_24px_rgba(251,191,36,0.55)] sm:h-20 sm:w-20"
              initial={{ y: 90, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 2.2, ease: "easeOut" }}
              style={{ willChange: "transform, opacity" }}
            />
            <motion.div
              className="absolute inset-x-0 bottom-8 h-10 bg-gradient-to-t from-white/50 to-transparent blur-md"
              animate={{ opacity: [0.3, 0.55, 0.3] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}

        {period === "afternoon" && (
          <>
            <motion.div
              className="absolute left-[12%] top-[16%] h-14 w-14 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fffbeb,#fdba74,#f87171)] shadow-[0_0_50px_20px_rgba(251,146,60,0.5)] sm:h-16 sm:w-16"
              animate={{ x: [0, 140, 0], y: [0, 60, 0] }}
              transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
              style={{ willChange: "transform" }}
            />
            <motion.div animate={{ x: [0, 18, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} className="absolute right-16 top-6">
              <Cloud className="h-8 w-8 text-white/50" />
            </motion.div>
            <motion.div animate={{ x: [0, -22, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }} className="absolute right-40 top-16">
              <Cloud className="h-6 w-6 text-white/40" />
            </motion.div>
          </>
        )}

        {period === "night" && (
          <>
            <motion.div
              className="absolute right-10 top-6 h-10 w-10 rounded-full bg-[radial-gradient(circle_at_35%_30%,#f8fafc,#e2e8f0,#cbd5e1)] shadow-[0_0_40px_14px_rgba(226,232,240,0.35)] sm:h-12 sm:w-12"
              style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 35% 50%)" }}
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="absolute inset-0 opacity-30 [background:radial-gradient(1px_1px_at_20%_30%,white,transparent),radial-gradient(1px_1px_at_60%_15%,white,transparent),radial-gradient(1px_1px_at_80%_45%,white,transparent),radial-gradient(1px_1px_at_35%_60%,white,transparent),radial-gradient(1px_1px_at_90%_70%,white,transparent),radial-gradient(1px_1px_at_10%_80%,white,transparent)]" />
            <motion.div
              className="absolute left-1/4 top-1/3 h-px w-16 -rotate-45 bg-gradient-to-r from-white to-transparent"
              animate={{ x: [0, 90], opacity: [0, 1, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 4, ease: "easeIn" }}
            />
            <motion.div
              className="absolute inset-0 opacity-20 [background:radial-gradient(60%_40%_at_70%_20%,rgba(168,85,247,0.5),transparent)]"
              animate={{ opacity: [0.15, 0.3, 0.15] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}

        <Mountain className="absolute -bottom-2 left-4 h-16 w-16 text-navy/20 dark:text-white/30 sm:h-20 sm:w-20" />
        <Mountain className="absolute -bottom-4 left-20 h-20 w-20 text-navy/15 dark:text-white/20 sm:h-28 sm:w-28" />
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
          absolutely-positioned scroll indicator never overlaps the tip
          carousel below. */}
      <div className="relative z-10 p-4 pb-14 sm:p-6 sm:pb-16">
        {/* Top row: greeting + dynamic time/weather badge */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <motion.div
              className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl backdrop-blur-sm sm:h-11 sm:w-11", pillClass)}
              animate={period === "morning" ? { y: [0, -4, 0] } : period === "night" ? { rotate: [0, 8, 0] } : undefined}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Icon className={cn("h-5 w-5 sm:h-[22px] sm:w-[22px]", textClass)} />
            </motion.div>
            <div className="min-w-0">
              <h1 className={cn("text-lg font-bold leading-snug sm:text-xl md:text-2xl", textClass)}>
                {meta.greeting}, {firstName ? firstName : "Pilot"} {meta.emoji}
              </h1>
              <p className={cn("text-xs sm:text-sm", period === "night" ? "text-white/60" : "text-slate-600 dark:text-white/60")}>
                Here&apos;s how your finances are looking today.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm", textClass, pillClass)}>
              {meta.badge}
            </span>
            <span
              className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm", textClass, pillClass)}
              title={`Financial Health Score: ${score}/100`}
            >
              {tierMeta.emoji} {score} · {tierMeta.label}
            </span>
          </div>
        </motion.div>

        {/* Middle row: net worth + permanent income/expense pills */}
        <div className="relative mt-4 flex flex-col gap-3 sm:mt-5">
          <button
            type="button"
            onClick={handleBalanceClick}
            className={cn(
              "relative flex flex-col items-start rounded-2xl p-4 text-left backdrop-blur-sm transition-colors hover:brightness-110 sm:p-6",
              pillClass
            )}
          >
            <span className={cn("text-[11px] font-semibold uppercase tracking-wider", period === "night" ? "text-white/60" : "text-slate-600 dark:text-white/50")}>
              Net Worth · Flight Deck Status
            </span>
            <span className={cn("mt-0.5 text-2xl font-extrabold sm:text-3xl", textClass)}>{netWorthLabel}</span>

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

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-400">
              Income: {incomeLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-400">
              Expenses: {expenseLabel}
            </span>
          </div>
        </div>

        {/* Bottom row: dynamic tagline + rotating actionable-tip carousel */}
        <p className={cn("mt-4 text-[13px] font-semibold leading-snug sm:mt-5", textClass)}>{tagline}</p>
        <div className="mt-2">
          <TipCarousel tips={tips} textClass={textClass} pillClass={pillClass} />
        </div>
      </div>

      {/* Scroll indicator — kept strictly at the container's true bottom
          edge; the reserved bottom padding on the content wrapper (pb-14
          sm:pb-16) guarantees clearance from the tip carousel above.
          Fades out as the user scrolls via indicatorOpacity. */}
      <motion.div
        style={{ opacity: indicatorOpacity }}
        className={cn(
          "pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-0.5",
          period === "night" ? "text-white/50" : "text-slate-500 dark:text-white/40"
        )}
      >
        <span className="text-[10px] font-medium tracking-wide">Scroll to explore</span>
        <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
      </motion.div>
    </div>
  );
}
