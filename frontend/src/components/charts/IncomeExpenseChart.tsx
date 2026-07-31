"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart, Area, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { TooltipProps } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { formatCompactCurrency, cn } from "@/lib/format";
import { LineChart as LineChartIcon } from "lucide-react";

interface Point {
  month: string;
  income: number;
  expense: number;
}

type MetricKey = "income" | "expense" | "netCashFlow" | "budgetLimit";

const METRIC_META: Record<MetricKey, { label: string; swatchClass: string }> = {
  income: { label: "Income", swatchClass: "bg-gradient-to-r from-cyan-500 to-blue-500" },
  expense: { label: "Expenses", swatchClass: "bg-gradient-to-r from-rose-500 to-red-600" },
  netCashFlow: { label: "Net Cash Flow", swatchClass: "bg-gradient-to-r from-emerald-500 to-rose-500" },
  budgetLimit: { label: "Budget Limit", swatchClass: "bg-slate-400" },
};

/** Glassmorphic tooltip per the Midnight Cockpit spec — formatted currency
 * per series, net cash-flow sign called out in emerald/rose. */
function GlassTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p) => p.dataKey === "income")?.value as number | undefined;
  const expense = payload.find((p) => p.dataKey === "expense")?.value as number | undefined;
  const net = payload.find((p) => p.dataKey === "netCashFlow")?.value as number | undefined;
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 text-xs shadow-xl backdrop-blur-md">
      <p className="mb-1.5 font-semibold text-slate-200">{label}</p>
      {income !== undefined && (
        <p className="flex items-center justify-between gap-4 text-cyan-300">
          <span>Income</span> <span className="font-semibold">{formatCompactCurrency(income)}</span>
        </p>
      )}
      {expense !== undefined && (
        <p className="flex items-center justify-between gap-4 text-rose-300">
          <span>Expenses</span> <span className="font-semibold">{formatCompactCurrency(expense)}</span>
        </p>
      )}
      {net !== undefined && (
        <p className={cn("flex items-center justify-between gap-4", net >= 0 ? "text-emerald-300" : "text-rose-300")}>
          <span>Net Cash Flow</span> <span className="font-semibold">{net >= 0 ? "+" : ""}{formatCompactCurrency(net)}</span>
        </p>
      )}
    </div>
  );
}

export function IncomeExpenseChart({ data, budgetLimit }: { data: Point[]; budgetLimit?: number }) {
  const [visible, setVisible] = useState<Record<MetricKey, boolean>>({
    income: true, expense: true, netCashFlow: true, budgetLimit: Boolean(budgetLimit),
  });

  const chartData = useMemo(() => data.map((d) => ({ ...d, netCashFlow: d.income - d.expense })), [data]);

  const toggle = (key: MetricKey) => setVisible((v) => ({ ...v, [key]: !v[key] }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs Expense</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState icon={LineChartIcon} title="No Data Available" description="Add transactions to see this trend." />
        ) : (
          <>
            {/* Toggle pills: turn each parameter (income/expense area, net
                cash-flow bars, budget ceiling reference line) on or off. */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(Object.keys(METRIC_META) as MetricKey[])
                .filter((k) => k !== "budgetLimit" || budgetLimit)
                .map((key) => (
                  <button
                    key={key}
                    onClick={() => toggle(key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      visible[key]
                        ? "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600/50 dark:bg-slate-800/60 dark:text-slate-200"
                        : "border-black/10 bg-transparent text-navy/40 dark:border-white/10 dark:text-white/30"
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", METRIC_META[key].swatchClass, !visible[key] && "opacity-30")} />
                    {METRIC_META[key].label}
                  </button>
                ))}
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#E11D48" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 500, fill: "#94A3B8" }} axisLine={{ stroke: "rgba(148,163,184,0.2)" }} tickLine={false} />
                <YAxis yAxisId="left" tickFormatter={(v) => formatCompactCurrency(v)} tick={{ fontSize: 12, fontWeight: 500, fill: "#94A3B8" }} axisLine={{ stroke: "rgba(148,163,184,0.2)" }} tickLine={false} width={64} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatCompactCurrency(v)} tick={{ fontSize: 12, fontWeight: 500, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<GlassTooltip />} cursor={{ stroke: "rgba(99,102,241,0.3)", strokeWidth: 1 }} />

                {visible.income && (
                  <Area yAxisId="left" type="monotone" dataKey="income" stroke="#06B6D4" strokeWidth={2} fill="url(#incomeGradient)" fillOpacity={0.25} name="Income" />
                )}
                {visible.expense && (
                  <Area yAxisId="left" type="monotone" dataKey="expense" stroke="#F43F5E" strokeWidth={2} fill="url(#expenseGradient)" fillOpacity={0.25} name="Expenses" />
                )}
                {visible.netCashFlow && (
                  <Bar yAxisId="right" dataKey="netCashFlow" radius={[4, 4, 4, 4]} name="Net Cash Flow" barSize={14} opacity={0.85}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.netCashFlow >= 0 ? "#10B981" : "#F43F5E"} />
                    ))}
                  </Bar>
                )}
                {visible.budgetLimit && budgetLimit && (
                  <ReferenceLine
                    yAxisId="left"
                    y={budgetLimit}
                    stroke="#94A3B8"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{ value: "Budget Ceiling", position: "insideTopRight", fill: "#94A3B8", fontSize: 11 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
