"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { LucideIcon, X, ArrowUpRight, ArrowDownRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/format";

export interface KpiDetailAction {
  label: string;
  href: string;
}

export interface KpiDetailData {
  label: string;
  value: string;
  icon: LucideIcon;
  changePct?: number | null;
  sparklineData?: number[];
  description: string;
  actions?: KpiDetailAction[];
  tone?: "positive" | "negative" | "neutral";
}

export function KpiDetailDrawer({ data, onClose }: { data: KpiDetailData | null; onClose: () => void }) {
  const isOpen = Boolean(data);
  const isPositive = (data?.changePct ?? 0) >= 0;
  const chartData = (data?.sparklineData ?? []).map((v, i) => ({ i, v }));

  return (
    <AnimatePresence>
      {isOpen && data && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl dark:bg-navy-dark"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-label={`${data.label} details`}
          >
            <div className="flex items-center justify-between border-b border-black/5 p-5 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal/10">
                  <data.icon className="h-5 w-5 text-teal" />
                </div>
                <h2 className="text-base font-semibold text-navy dark:text-white">{data.label}</h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/5"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-3xl font-bold text-navy dark:text-white">{data.value}</p>
              {data.changePct !== undefined && data.changePct !== null && (
                <span
                  className={cn(
                    "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                    isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  )}
                >
                  {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(data.changePct * 100).toFixed(1)}% vs last month
                </span>
              )}

              {chartData.length > 1 && (
                <div className="mt-5 h-24 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={data.tone === "negative" ? "#C0392B" : "#0EA5A5"}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className="mt-5 text-sm text-navy/60 dark:text-white/60">{data.description}</p>

              {data.actions && data.actions.length > 0 && (
                <div className="mt-6 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-navy/40 dark:text-white/40">Quick Actions</p>
                  {data.actions.map((action) => (
                    <div
                      key={action.href}
                      className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-navy dark:border-white/10 dark:text-white"
                    >
                      {action.label}
                      <Link
                        href={action.href}
                        onClick={onClose}
                        aria-label={`Go to ${action.label}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-navy/40 transition-colors hover:bg-black/5 hover:text-teal dark:text-white/40 dark:hover:bg-white/10"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
