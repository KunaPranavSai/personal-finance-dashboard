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
  const spotlight = useMotionTemplate`radial-gradient(circle at ${spotlightX}% ${spotlightY}%, rgba(0,71,65,0.16), transparent 60%)`;
  // Cursor-tracking gradient BORDER (distinct from the internal spotlight
  // above) — a soft Tiffany glow in both themes, per the approved palette.
  const borderGlow = useMotionTemplate`radial-gradient(180px circle at ${spotlightX}% ${spotlightY}%, var(--kpi-border-glow), transparent 70%)`;

  // Fine-pointer devices only get the 3D tilt — on touch, continuously
  // recalculating rotateX/rotateY from touchmove caused visible sub-pixel
  // jitter (the finger never holds perfectly still the way a mouse does).
  // Mobile keeps just the spotlight/border-glow tracking plus a plain
  // active:scale-95 press effect instead.
  const supportsFineHover = () =>
    typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const updateFromPoint = (clientX: number, clientY: number, withTilt: boolean) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = (clientX - rect.left) / rect.width; // 0..1
    const relY = (clientY - rect.top) / rect.height;
    px.set(relX);
    py.set(relY);
    if (withTilt) {
      rotateY.set((relX - 0.5) * TILT_RANGE * 2);
      rotateX.set(-(relY - 0.5) * TILT_RANGE * 2);
    }
    spotlightX.set(relX * 100);
    spotlightY.set(relY * 100);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) =>
    updateFromPoint(e.clientX, e.clientY, supportsFineHover());

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
      style={{ perspective: "800px", ["--kpi-border-glow" as string]: "rgba(33,241,168,0.35)" }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onTouchMove={(e) => { const t = e.touches[0]; if (t) updateFromPoint(t.clientX, t.clientY, false); }}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Cursor-tracking gradient border: 1px padding shows only the glow
          ring through, independent of the card's own background. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-[1.25rem] opacity-0 transition-opacity duration-300 dark:[--kpi-border-glow:rgba(33,241,168,0.3)]"
        style={{ background: borderGlow, opacity: hovered ? 1 : 0 }}
      />

      <motion.div
        ref={ref}
        style={{ rotateX, rotateY, z: 0, transformStyle: "preserve-3d", willChange: "transform" }}
      >
        <div
          className={cn(
            // Surface separation from the canvas: crisp near-opaque frosted
            // glass with a visible border (was too translucent and blended
            // into the background at rest, only standing out via the
            // cursor-tracking glow layer above).
            "group relative overflow-hidden rounded-xl2 border border-pp-accent/80 bg-white/[0.92] p-3 shadow-[0_4px_20px_-2px_rgba(0,71,65,0.08),0_2px_6px_-1px_rgba(0,0,0,0.04)] backdrop-blur-md transition-[color,background-color,border-color,box-shadow,transform] duration-200 will-change-transform hover:border-pp-accent/70 dark:bg-pp-surface-2 dark:shadow-card dark:backdrop-blur-xl dark:hover:border-pp-accent/40 dark:hover:shadow-lg dark:hover:shadow-pp-accent/10 sm:p-4",
            onClick && "cursor-pointer ease-out hover:shadow-md active:scale-95 sm:active:scale-100"
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
              "pointer-events-none absolute -bottom-3 -right-2 select-none text-4xl font-black italic tracking-tighter text-pp-text/[0.04] transition-opacity duration-300 /[0.05] sm:text-5xl",
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
                  isPositive ? "bg-mantis/10 text-mantis" : "bg-vulcanico/10 text-vulcanico"
                )}
              >
                {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(changePct * 100).toFixed(1)}%
              </span>
            )}
          </div>

          <p className="relative mt-2 truncate text-xs font-medium text-pp-text-dim dark:text-pp-text-dim">{label}</p>
          <p className="relative mt-0.5 truncate text-lg font-extrabold text-pp-text-dim dark:text-pp-text-dim sm:text-xl" style={{ fontSize: "clamp(14px, 2vw, 22px)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
            {value}
          </p>

          {chartData.length > 1 && (
            <div className="relative mt-2 h-8 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={tone === "negative" ? "#FF4103" : "#21F1A8"}
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
        className="pointer-events-none absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-pp-accent/60 bg-pp-accent/10 text-pp-accent shadow-sm dark:border-pp-accent/20 dark:bg-pp-accent/15 dark:text-pp-accent sm:left-4 sm:top-4 sm:h-9 sm:w-9"
        animate={{ y: hovered ? -14 : 0, z: hovered ? 40 : 0, scale: hovered ? 1.15 : 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 16 }}
        style={{ willChange: "transform" }}
      >
        <Icon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
      </motion.div>
    </motion.div>
  );
}
