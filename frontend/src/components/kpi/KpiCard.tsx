"use client";

import { useRef, useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/format";

interface KpiCardProps {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
  changePct?: number | null;
  sparklineData?: number[];
  tooltip?: string;
  tone?: "positive" | "negative" | "neutral";
  onClick?: () => void;
}

const TILT_RANGE = 8; // degrees

export function KpiCard({
  id,
  label,
  value,
  icon: Icon,
  changePct,
  sparklineData,
  tooltip,
  tone = "neutral",
  onClick,
}: KpiCardProps) {
  const isPositive = (changePct ?? 0) >= 0;
  const chartData = (sparklineData ?? []).map((v, i) => ({ i, v }));
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  // Raw pixel offsets from the card's center, used to derive both the 3D
  // tilt and the cursor-following spotlight — motion values update outside
  // React's render cycle, so this stays smooth even across a dense grid of
  // cards without re-rendering on every pixel of mouse movement.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useMotionValue(0), { stiffness: 300, damping: 25 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 300, damping: 25 });
  const spotlightX = useMotionValue(50);
  const spotlightY = useMotionValue(50);
  const spotlight = useMotionTemplate`radial-gradient(circle at ${spotlightX}% ${spotlightY}%, rgba(14,165,165,0.16), transparent 60%)`;
  // Cursor-tracking gradient BORDER (distinct from the internal spotlight
  // above) — dark mode glows violet/gold, light mode a soft cyan/indigo
  // shimmer, per the design spec.
  const borderGlow = useMotionTemplate`radial-gradient(180px circle at ${spotlightX}% ${spotlightY}%, var(--kpi-border-glow), transparent 70%)`;

  const updateFromPoint = (clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = (clientX - rect.left) / rect.width; // 0..1
    const relY = (clientY - rect.top) / rect.height;
    px.set(relX);
    py.set(relY);
    rotateY.set((relX - 0.5) * TILT_RANGE * 2);
    rotateX.set(-(relY - 0.5) * TILT_RANGE * 2);
    spotlightX.set(relX * 100);
    spotlightY.set(relY * 100);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => updateFromPoint(e.clientX, e.clientY);

  const resetTilt = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    resetTilt();
  };

  // Touch devices: don't let the spotlight/tilt "stick" at the last-touched
  // point once the finger lifts — reset immediately on touch end/cancel.
  const handleTouchEnd = () => {
    setHovered(false);
    resetTilt();
  };

  return (
    <motion.div
      layoutId={`kpi-card-${id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative"
      style={{ perspective: "800px", ["--kpi-border-glow" as string]: "rgba(99,102,241,0.4)" }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onTouchMove={(e) => { const t = e.touches[0]; if (t) updateFromPoint(t.clientX, t.clientY); }}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Cursor-tracking gradient border: 1px padding shows only the glow
          ring through, independent of the card's own background. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-[1.25rem] opacity-0 transition-opacity duration-300 dark:[--kpi-border-glow:rgba(139,92,246,0.6)]"
        style={{ background: borderGlow, opacity: hovered ? 1 : 0 }}
      />

      <motion.div
        ref={ref}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d", willChange: "transform" }}
      >
        <div
          className={cn(
            "group relative overflow-hidden rounded-xl2 border border-black/5 bg-white/70 p-3 shadow-card backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:p-4",
            onClick && "cursor-pointer transition-shadow hover:shadow-md"
          )}
          title={tooltip}
          role={onClick ? "button" : undefined}
          tabIndex={onClick ? 0 : undefined}
          onClick={onClick}
          onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
        >
          {/* Faint background watermark, fades in on hover */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute -bottom-3 -right-2 select-none text-4xl font-black italic tracking-tighter text-navy/[0.04] transition-opacity duration-300 dark:text-white/[0.05] sm:text-5xl",
              hovered ? "opacity-100" : "opacity-0"
            )}
          >
            PILOT
          </span>

          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: spotlight }}
          />

          <div className="relative flex items-start justify-between">
            {/* Invisible spacer preserving the icon's layout slot — the visible icon
                is an absolutely-positioned sibling below, so it can pop out above
                this card's overflow-hidden border without being clipped. */}
            <div className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" aria-hidden />
            {changePct !== undefined && changePct !== null && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                  isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                )}
              >
                {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(changePct * 100).toFixed(1)}%
              </span>
            )}
          </div>

          <p className="relative mt-2 truncate text-xs font-medium text-navy/50 dark:text-white/50">{label}</p>
          <p className="relative mt-0.5 truncate text-lg font-bold text-navy dark:text-white sm:text-xl" style={{ fontSize: "clamp(14px, 2vw, 22px)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
            {value}
          </p>

          {chartData.length > 1 && (
            <div className="relative mt-2 h-8 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={tone === "negative" ? "#C0392B" : "#0EA5A5"}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div
        className="pointer-events-none absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-teal/10 shadow-sm sm:left-4 sm:top-4 sm:h-9 sm:w-9"
        animate={{ y: hovered ? -14 : 0, z: hovered ? 40 : 0, scale: hovered ? 1.15 : 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 16 }}
        style={{ willChange: "transform" }}
      >
        <Icon className="h-4 w-4 text-teal sm:h-4.5 sm:w-4.5" />
      </motion.div>
    </motion.div>
  );
}
