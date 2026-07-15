"use client";

import { motion } from "framer-motion";
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { Card } from "../ui/Card";
import { cn } from "@/lib/format";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  changePct?: number | null;
  sparklineData?: number[];
  tooltip?: string;
  tone?: "positive" | "negative" | "neutral";
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  changePct,
  sparklineData,
  tooltip,
  tone = "neutral",
}: KpiCardProps) {
  const isPositive = (changePct ?? 0) >= 0;
  const chartData = (sparklineData ?? []).map((v, i) => ({ i, v }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="group relative overflow-hidden p-3 sm:p-4" title={tooltip}>
        <div className="flex items-start justify-between">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal/10 sm:h-9 sm:w-9">
            <Icon className="h-4 w-4 text-teal sm:h-4.5 sm:w-4.5" />
          </div>
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

        <p className="mt-2 truncate text-xs font-medium text-navy/50 dark:text-white/50">{label}</p>
        <p className="mt-0.5 truncate text-lg font-bold text-navy dark:text-white sm:text-xl" style={{ fontSize: "clamp(14px, 2vw, 22px)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
          {value}
        </p>

        {chartData.length > 1 && (
          <div className="mt-2 h-8 w-full">
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
      </Card>
    </motion.div>
  );
}
