"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LucideIcon, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/format";

const TONE_CLASSES: Record<string, string> = {
  teal: "bg-teal/10 text-teal",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red: "bg-red-500/10 text-red-500",
  emerald: "bg-emerald-500/10 text-emerald-600",
  navy: "bg-navy/10 text-navy/70 dark:bg-white/10 dark:text-white/70",
};

function useCountUp(target: number, durationMs = 700) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    startRef.current = null;
    let frame: number;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const progress = Math.min(1, (t - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "teal",
  trendPct,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASSES;
  trendPct?: number;
}) {
  const numeric = typeof value === "number" ? value : null;
  const animated = useCountUp(numeric ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl2 border border-black/5 bg-white p-4 shadow-card transition-shadow hover:shadow-lg dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONE_CLASSES[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-navy/50 dark:text-white/50">{label}</p>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-navy dark:text-white">{numeric !== null ? animated : value}</p>
            {trendPct !== undefined && (
              <span className={cn("flex items-center gap-0.5 text-xs font-medium", trendPct >= 0 ? "text-emerald-600" : "text-red-500")}>
                {trendPct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(trendPct)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function StatCardSkeleton() {
  return <div className="h-[68px] animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />;
}
