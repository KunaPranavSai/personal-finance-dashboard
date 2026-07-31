"use client";

import { useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, Sector } from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { formatCompactCurrency, cn } from "@/lib/format";
import { PieChart as PieChartIcon } from "lucide-react";

// Vivid Midnight Cockpit accent palette, replacing the old muted set.
const COLORS = ["#06B6D4", "#6366F1", "#F59E0B", "#F43F5E", "#10B981", "#8B5CF6", "#3B82F6", "#F97316"];

const WIDTH = 320;
const HEIGHT = 280;

interface Slice {
  category: string;
  total: number;
}

export function CategoryDonutChart({ data }: { data: Slice[] }) {
  const [hiddenSet, setHiddenSet] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleData = useMemo(() => data.filter((d) => !hiddenSet.has(d.category)), [data, hiddenSet]);
  const total = useMemo(() => visibleData.reduce((s, d) => s + d.total, 0), [visibleData]);
  const active = activeIndex !== null ? visibleData[activeIndex] : undefined;
  const activePct = active && total > 0 ? Math.round((active.total / total) * 100) : null;

  const toggleCategory = (category: string) => {
    setHiddenSet((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category-wise Expense</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState icon={PieChartIcon} title="No Data Available" description="Add expenses to see the category breakdown." />
        ) : (
          <>
            {/* Fixed pixel size (not a "100%"-wide ResponsiveContainer) — the
                previous responsive width let recharts render its default SVG
                <Tooltip> wrapper (a plain white-bordered box, clipped
                unpredictably by the card's overflow-hidden) over the slices.
                Tooltip below is a fully custom, absolutely-positioned
                floating card driven by real mouse coordinates instead, so
                recharts' own tooltip mechanism is never used. The 24px
                margin on the chart itself gives the hover-expanded slice
                (see activeShape) room to grow without clipping. */}
            <div
              ref={containerRef}
              className="relative mx-auto [&_svg_*]:outline-none"
              style={{ width: WIDTH, height: HEIGHT, willChange: "transform", transform: "translateZ(0)" }}
              onMouseMove={handleMouseMove}
            >
              <PieChart width={WIDTH} height={HEIGHT} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <Pie
                  data={visibleData}
                  dataKey="total"
                  nameKey="category"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                  activeIndex={activeIndex ?? undefined}
                  // Expand the hovered slice outward, per the spec's
                  // "outerRadius animation" hover-offset requirement.
                  activeShape={(props: PieSectorDataItem) => (
                    <Sector {...props} outerRadius={Number(props.outerRadius) + 8} style={{ outline: "none" }} />
                  )}
                  onMouseEnter={(_, i) => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(null)}
                  style={{ outline: "none" }}
                >
                  {visibleData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" className="cursor-pointer transition-opacity" style={{ outline: "none" }} />
                  ))}
                </Pie>
              </PieChart>

              {/* Center metric: total by default, switches to the hovered
                  category's amount + share while hovering a slice. */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  {formatCompactCurrency(active ? active.total : total)}
                </span>
                <span className="mt-0.5 max-w-[8rem] truncate text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  {active ? `${active.category} · ${activePct}%` : "Total"}
                </span>
              </div>

              <AnimatePresence>
                {active && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.12 }}
                    className="pointer-events-none absolute z-10 rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 text-xs text-white shadow-2xl backdrop-blur-md"
                    style={{
                      left: Math.min(Math.max(pos.x + 14, 0), WIDTH - 140),
                      top: Math.min(Math.max(pos.y - 40, 0), HEIGHT - 60),
                    }}
                  >
                    <p className="font-semibold text-slate-200">{active.category}</p>
                    <p className="mt-0.5 text-slate-300">{formatCompactCurrency(active.total)} · {activePct}%</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Interactive legend: toggling a category hides it from the
                donut and recalculates every remaining slice's percentage. */}
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {data.map((d, i) => {
                const hidden = hiddenSet.has(d.category);
                return (
                  <button
                    key={d.category}
                    onClick={() => toggleCategory(d.category)}
                    onMouseEnter={() => !hidden && setActiveIndex(visibleData.findIndex((v) => v.category === d.category))}
                    onMouseLeave={() => setActiveIndex(null)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      hidden
                        ? "border-black/10 bg-transparent text-navy/30 line-through dark:border-white/10 dark:text-white/25"
                        : "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600/50 dark:bg-slate-800/60 dark:text-slate-200"
                    )}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length], opacity: hidden ? 0.3 : 1 }} />
                    {d.category}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
