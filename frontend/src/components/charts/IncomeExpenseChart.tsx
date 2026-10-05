"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart, Area, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { TooltipProps } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/PpCard";
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
  income: { label: "Income", swatchClass: "bg-gradient-to-r from-cypress to-pp-accent" },
  expense: { label: "Expenses", swatchClass: "bg-gradient-to-r from-vulcanico to-vulcanico" },
  netCashFlow: { label: "Net Surplus", swatchClass: "bg-gradient-to-r from-mantis to-vulcanico" },
  budgetLimit: { label: "Budget Limit", swatchClass: "bg-pp-surface-2" },
};

/** Glassmorphic tooltip per the Midnight Cockpit spec — formatted currency
 * per series, net cash-flow sign called out in emerald/rose. */
function GlassTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p) => p.dataKey === "income")?.value as number | undefined;
  const expense = payload.find((p) => p.dataKey === "expense")?.value as number | undefined;
  const net = payload.find((p) => p.dataKey === "netCashFlow")?.value as number | undefined;
  return (
    <div className="rounded-xl border border-pp-border bg-pp-surface-2 p-3 text-xs shadow-xl backdrop-blur-md">
      <p className="mb-1.5 font-semibold text-pp-text-dim">{label}</p>
      {income !== undefined && (
        <p className="flex items-center justify-between gap-4 text-pp-accent">
          <span>Income</span> <span className="font-semibold">{formatCompactCurrency(income)}</span>
        </p>
      )}
      {expense !== undefined && (
        <p className="flex items-center justify-between gap-4 text-vulcanico">
          <span>Expenses</span> <span className="font-semibold">{formatCompactCurrency(expense)}</span>
        </p>
      )}
      {net !== undefined && (
        <p className={cn("flex items-center justify-between gap-4", net >= 0 ? "text-mantis" : "text-vulcanico")}>
          <span>Net Surplus</span> <span className="font-semibold">{net >= 0 ? "+" : ""}{formatCompactCurrency(net)}</span>
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
                        ? "border-pp-border bg-pp-surface-2 text-pp-text-dim dark:border-pp-border dark:bg-pp-surface-2 dark:text-pp-text-dim"
                        : "border-pp-border bg-transparent text-pp-text-dim "
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", METRIC_META[key].swatchClass, !visible[key] && "opacity-30")} />
                    {METRIC_META[key].label}
                  </button>
                ))}
            </div>

            <ResponsiveContainer width="100%" height={300} style={{ willChange: "transform", transform: "translateZ(0)" }}>
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#21F1A8" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0E8478" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF4103" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#B91C1C" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pp-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 500, fill: "var(--pp-text-dim)" }} axisLine={{ stroke: "var(--pp-border)" }} tickLine={false} />
                <YAxis yAxisId="left" tickFormatter={(v) => formatCompactCurrency(v)} tick={{ fontSize: 12, fontWeight: 500, fill: "var(--pp-text-dim)" }} axisLine={{ stroke: "var(--pp-border)" }} tickLine={false} width={64} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatCompactCurrency(v)} tick={{ fontSize: 12, fontWeight: 500, fill: "var(--pp-text-dim)" }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<GlassTooltip />} cursor={{ stroke: "var(--pp-accent)", strokeOpacity: 0.3, strokeWidth: 1 }} />

                {visible.income && (
                  <Area yAxisId="left" type="monotone" dataKey="income" stroke="#21F1A8" strokeWidth={2} fill="url(#incomeGradient)" fillOpacity={0.2} name="Income" />
                )}
                {visible.expense && (
                  <Area yAxisId="left" type="monotone" dataKey="expense" stroke="#FF4103" strokeWidth={2} fill="url(#expenseGradient)" fillOpacity={0.15} name="Expenses" />
                )}
                {visible.netCashFlow && (
                  <Bar yAxisId="right" dataKey="netCashFlow" radius={[4, 4, 4, 4]} name="Net Surplus" barSize={14} opacity={0.85}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.netCashFlow >= 0 ? "#59C749" : "#FF4103"} />
                    ))}
                  </Bar>
                )}
                {visible.budgetLimit && budgetLimit && (
                  <ReferenceLine
                    yAxisId="left"
                    y={budgetLimit}
                    stroke="var(--pp-text-dim)"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{ value: "Budget Ceiling", position: "insideTopRight", fill: "var(--pp-text-dim)", fontSize: 11 }}
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
