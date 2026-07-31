"use client";

import { useId } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { cn } from "@/lib/format";

interface Tier {
  min: number;
  label: string;
  status: string;
  stops: [string, string];
  textClass: string;
}

const TIERS: Tier[] = [
  { min: 75, label: "Thriving", status: "Flight Path Optimal", stops: ["#10B981", "#0D9488"], textClass: "text-emerald-500 dark:text-emerald-400" },
  { min: 50, label: "Fair", status: "Flight Path Stable", stops: ["#F59E0B", "#06B6D4"], textClass: "text-amber-500 dark:text-amber-400" },
  { min: 0, label: "Critical", status: "Turbulence Ahead", stops: ["#F43F5E", "#BE123C"], textClass: "text-rose-500 dark:text-rose-400" },
];

function tierFor(score: number): Tier {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
}

/** Small radial tick marks at 25/50/75/100 around the semicircular arc,
 * overlaid on top of the recharts Pie via an absolutely-positioned SVG. */
function TickMarks() {
  const cx = 100;
  const cy = 100;
  const r = 82;
  const ticks = [0, 25, 50, 75, 100];
  return (
    <svg viewBox="0 0 200 110" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {ticks.map((v) => {
        const angleDeg = 180 - (v / 100) * 180;
        const rad = (angleDeg * Math.PI) / 180;
        const x1 = cx + (r - 6) * Math.cos(rad);
        const y1 = cy - (r - 6) * Math.sin(rad);
        const x2 = cx + (r + 4) * Math.cos(rad);
        const y2 = cy - (r + 4) * Math.sin(rad);
        return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(148,163,184,0.5)" strokeWidth={2} strokeLinecap="round" />;
      })}
    </svg>
  );
}

export function FinancialHealthGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const tier = tierFor(clamped);
  const gradientId = `health-gauge-${useId()}`;
  const data = [
    { name: "score", value: clamped },
    { name: "remaining", value: 100 - clamped },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Health Score</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={tier.stops[0]} />
                  <stop offset="100%" stopColor={tier.stops[1]} />
                </linearGradient>
              </defs>
              <Pie data={data} dataKey="value" startAngle={180} endAngle={0} innerRadius={60} outerRadius={85} cornerRadius={6} isAnimationActive>
                <Cell fill={`url(#${gradientId})`} />
                <Cell fill="rgba(148,163,184,0.15)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <TickMarks />
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
            <span
              className="text-3xl font-extrabold text-slate-900 dark:text-slate-100"
              style={{ filter: `drop-shadow(0 0 12px ${tier.stops[0]}66)` }}
            >
              {Math.round(clamped)}
            </span>
            <span className={cn("mt-0.5 text-xs font-semibold", tier.textClass)}>
              {tier.label} · {tier.status}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
