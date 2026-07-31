"use client";

import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Sector, Tooltip, ResponsiveContainer } from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { formatCompactCurrency, cn } from "@/lib/format";
import { PieChart as PieChartIcon } from "lucide-react";

// Vivid Midnight Cockpit accent palette, replacing the old muted set.
const COLORS = ["#06B6D4", "#6366F1", "#F59E0B", "#F43F5E", "#10B981", "#8B5CF6", "#3B82F6", "#F97316"];

interface Slice {
  category: string;
  total: number;
}

function GlassTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 text-xs shadow-xl backdrop-blur-md">
      <p className="font-semibold text-slate-200">{p.name}</p>
      <p className="mt-0.5 text-slate-300">{formatCompactCurrency(p.value)}</p>
    </div>
  );
}

export function CategoryDonutChart({ data }: { data: Slice[] }) {
  const [hiddenSet, setHiddenSet] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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
            <div className="relative">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
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
                      <Sector {...props} outerRadius={Number(props.outerRadius) + 8} />
                    )}
                    onMouseEnter={(_, i) => setActiveIndex(i)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {visibleData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} className="cursor-pointer transition-opacity" />
                    ))}
                  </Pie>
                  <Tooltip content={<GlassTooltip />} />
                </PieChart>
              </ResponsiveContainer>
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
