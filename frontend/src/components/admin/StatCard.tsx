"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LucideIcon, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/format";

const TONE_COLOR: Record<string, string> = {
  teal: "var(--cc-accent)",
  amber: "var(--cc-amber)",
  red: "var(--cc-red)",
  emerald: "var(--cc-green)",
  navy: "var(--cc-text-dim)",
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
  tone?: keyof typeof TONE_COLOR;
  trendPct?: number;
}) {
  const numeric = typeof value === "number" ? value : null;
  const animated = useCountUp(numeric ?? 0);
  const color = TONE_COLOR[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25 }}
      className="cc-panel p-4 transition-shadow hover:shadow-lg"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="cc-mono truncate text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>{label}</p>
          <div className="flex items-center gap-2">
            <p className="cc-mono text-lg font-bold" style={{ color: "var(--cc-text)" }}>{numeric !== null ? animated : value}</p>
            {trendPct !== undefined && (
              <span className={cn("cc-mono flex items-center gap-0.5 text-xs font-medium")} style={{ color: trendPct >= 0 ? "var(--cc-green)" : "var(--cc-red)" }}>
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
  return <div className="cc-panel h-[68px] animate-pulse" />;
}
