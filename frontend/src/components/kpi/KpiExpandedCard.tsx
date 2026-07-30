"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { LucideIcon, X, ArrowUpRight, ArrowDownRight, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import type { Transaction } from "@/types";

export interface KpiDetailAction {
  label: string;
  href: string;
}

export interface KpiDetailData {
  /** Must match the `id` passed to the originating <KpiCard/> so the shared layoutId animation connects the two. */
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
  changePct?: number | null;
  sparklineData?: number[];
  description: string;
  actions?: KpiDetailAction[];
  tone?: "positive" | "negative" | "neutral";
  /** When set, the recent-transactions list below is filtered to this entry type. */
  transactionType?: "EXPENSE" | "INCOME";
}

function RecentTransactionsList({ transactionType }: { transactionType?: "EXPENSE" | "INCOME" }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-transactions", transactionType],
    queryFn: () =>
      api.get<{ items: Transaction[] }>(
        `/api/transactions?pageSize=5&sortBy=date&sortDir=desc${transactionType ? `&type=${transactionType}` : ""}`
      ),
  });
  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="py-4 text-center text-xs text-navy/40 dark:text-white/40">No recent transactions yet.</p>;
  }

  return (
    <div className="space-y-1.5">
      {items.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-navy dark:text-white">{t.description}</p>
            <p className="truncate text-xs text-navy/40 dark:text-white/40">{t.category.name} · {new Date(t.date).toLocaleDateString()}</p>
          </div>
          <span className={cn("shrink-0 text-sm font-semibold", t.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : "text-navy dark:text-white")}>
            {t.type === "INCOME" ? "+" : "-"}{t.amount.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function KpiExpandedCard({ data, onClose }: { data: KpiDetailData | null; onClose: () => void }) {
  const isOpen = Boolean(data);
  const isPositive = (data?.changePct ?? 0) >= 0;
  const chartData = (data?.sparklineData ?? []).map((v, i) => ({ i, v }));

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && data && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Mobile: bottom-sheet slide-up. Desktop (sm+): centered glass modal.
              The layoutId shared with the originating KpiCard drives the
              expand/collapse FLIP animation regardless of which position
              this resolves to at the current breakpoint. */}
          <motion.div
            layoutId={`kpi-card-${data.id}`}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl border border-black/5 bg-white shadow-2xl dark:border-white/10 dark:bg-navy-dark sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[80vh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-label={`${data.label} details`}
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-black/10 dark:bg-white/20 sm:hidden" aria-hidden />

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

              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy/40 dark:text-white/40">Recent Transactions</p>
                <RecentTransactionsList transactionType={data.transactionType} />
              </div>

              {data.actions && data.actions.length > 0 && (
                <div className="mt-6 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-navy/40 dark:text-white/40">Quick Actions</p>
                  {data.actions.map((action) => (
                    <div
                      key={action.href}
                      className="flex items-center justify-between gap-2 rounded-lg border border-black/10 pl-4 text-sm font-medium text-navy dark:border-white/10 dark:text-white"
                    >
                      <span className="min-w-0 truncate py-3">{action.label}</span>
                      <Link
                        href={action.href}
                        onClick={onClose}
                        aria-label={`Go to ${action.label}`}
                        className="flex h-full min-h-[44px] w-14 shrink-0 items-center justify-center rounded-r-lg text-navy/40 transition-colors hover:bg-teal/10 hover:text-teal active:bg-teal/20 dark:text-white/40 dark:hover:bg-teal/10"
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
    </AnimatePresence>,
    document.body
  );
}
