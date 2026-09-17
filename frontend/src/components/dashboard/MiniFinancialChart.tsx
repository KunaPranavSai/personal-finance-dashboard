"use client";

import { useEffect, useRef, useState } from "react";

interface MiniFinancialChartProps {
  income: number;
  expense: number;
  savings: number;
  format: (v: number) => string;
  formatCompact: (v: number) => string;
}

/**
 * Compact vertical Income / Expenses / Savings bar trio for the Net Worth
 * card's right column. Bars grow height sequentially once (income, then
 * expense, then savings) on mount/data-change — never on every render,
 * since the "has this exact data played already" guard only re-triggers
 * when the underlying values actually change, and `prefers-reduced-motion`
 * skips the animation entirely (bars render at full height immediately).
 * The track height is fixed regardless of animation state, so nothing
 * shifts layout while it plays. Colors reuse the app's existing --ppm-*
 * status tokens (positive/warning), not one-off literals.
 */
export function MiniFinancialChart({ income, expense, savings, format, formatCompact }: MiniFinancialChartProps) {
  const [playedFor, setPlayedFor] = useState<string | null>(null);
  const reducedMotionRef = useRef(false);

  const dataKey = `${income}:${expense}:${savings}`;
  const animated = playedFor === dataKey;

  useEffect(() => {
    reducedMotionRef.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotionRef.current) {
      setPlayedFor(dataKey);
      return;
    }
    setPlayedFor(null);
    const t = setTimeout(() => setPlayedFor(dataKey), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  const TRACK_HEIGHT = 76;
  const max = Math.max(income, expense, Math.abs(savings), 1);
  const bars: { label: string; value: number; color: string; border?: string; delayMs: number }[] = [
    { label: "INC", value: income, color: "var(--ppm-accent)", delayMs: 0 },
    { label: "EXP", value: expense, color: "var(--ppm-warning)", delayMs: 180 },
    { label: "SAV", value: savings, color: savings >= 0 ? "var(--ppm-positive)" : "var(--ppm-critical)", border: "var(--ppm-accent)", delayMs: 360 },
  ];

  return (
    <div
      role="img"
      aria-label={`Income ${format(income)}, Expenses ${format(expense)}, Savings ${format(savings)}`}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: TRACK_HEIGHT }}>
        {bars.map((b) => {
          const pct = Math.max(6, Math.min(100, (Math.abs(b.value) / max) * 100));
          return (
            <div key={b.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", width: 16 }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: b.color, marginBottom: 2, whiteSpace: "nowrap" }}>{formatCompact(b.value)}</span>
              <div
                style={{
                  width: 16,
                  height: animated ? `${pct}%` : "0%",
                  minHeight: animated ? 6 : 0,
                  background: b.color,
                  border: b.border ? `1px solid ${b.border}` : undefined,
                  borderRadius: 4,
                  transition: reducedMotionRef.current ? "none" : `height 0.5s ease ${b.delayMs}ms`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ width: 16 * 3 + 8 * 2, borderTop: "1px solid var(--ppm-border)", marginTop: 4 }} />
      <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
        {bars.map((b) => (
          <span key={b.label} style={{ width: 16, fontSize: 8, fontWeight: 700, color: "var(--ppm-text-dim)", textAlign: "center" }}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}
