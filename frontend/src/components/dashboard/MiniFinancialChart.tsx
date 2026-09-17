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
 * Income / Expenses / Savings vertical bar trio for the Net Worth card,
 * rendered with a subtle 3D-block look (a brighter "top" face + a darker
 * "side" face, both derived from the same --ppm-* token via CSS filter()
 * rather than a hardcoded shade, so it holds up correctly in both light and
 * dark theme). Bars grow height sequentially once (income, then expense,
 * then savings) on mount/data-change — never on every render, since the
 * "has this exact data played already" guard only re-triggers when the
 * underlying values actually change, and `prefers-reduced-motion` skips the
 * animation entirely (bars render at full height immediately). The track
 * height is fixed regardless of animation state, so nothing shifts layout
 * while it plays.
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
  const BAR_WIDTH = 16;
  const GAP = 10;
  const DEPTH = 4; // px, size of the simulated top/side 3D faces
  const max = Math.max(income, expense, Math.abs(savings), 1);
  const bars: { label: string; value: number; color: string; delayMs: number }[] = [
    { label: "INC", value: income, color: "var(--ppm-accent)", delayMs: 0 },
    { label: "EXP", value: expense, color: "var(--ppm-warning)", delayMs: 180 },
    { label: "SAV", value: savings, color: savings >= 0 ? "var(--ppm-positive)" : "var(--ppm-critical)", delayMs: 360 },
  ];

  return (
    <div
      role="img"
      aria-label={`Income ${format(income)}, Expenses ${format(expense)}, Savings ${format(savings)}`}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: GAP, height: TRACK_HEIGHT, paddingRight: DEPTH, paddingTop: DEPTH }}>
        {bars.map((b) => {
          const pct = Math.max(6, Math.min(100, (Math.abs(b.value) / max) * 100));
          return (
            <div key={b.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", width: BAR_WIDTH }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: b.color, marginBottom: 2, whiteSpace: "nowrap" }}>{formatCompact(b.value)}</span>
              <div
                style={{
                  position: "relative",
                  width: BAR_WIDTH,
                  height: animated ? `${pct}%` : "0%",
                  transition: reducedMotionRef.current ? "none" : `height 0.5s ease ${b.delayMs}ms`,
                }}
              >
                {/* Front face */}
                <div style={{ position: "absolute", inset: 0, background: b.color, borderRadius: "3px 3px 0 0" }} />
                {/* Top face — brighter, skewed to read as the block's top */}
                <div
                  style={{
                    position: "absolute", top: -DEPTH, left: 0, width: "100%", height: DEPTH,
                    background: b.color, filter: "brightness(1.35)",
                    transform: "skewX(-45deg)", transformOrigin: "bottom left",
                  }}
                />
                {/* Side face — darker, skewed to read as the block's right side */}
                <div
                  style={{
                    position: "absolute", top: 0, right: -DEPTH, width: DEPTH, height: "100%",
                    background: b.color, filter: "brightness(0.7)",
                    transform: "skewY(-45deg)", transformOrigin: "top left",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ width: BAR_WIDTH * 3 + GAP * 2 + DEPTH, borderTop: "1px solid var(--ppm-border)", marginTop: 4 }} />
      <div style={{ display: "flex", gap: GAP, marginTop: 3, paddingRight: DEPTH }}>
        {bars.map((b) => (
          <span key={b.label} style={{ width: BAR_WIDTH, fontSize: 8, fontWeight: 700, color: "var(--ppm-text-dim)", textAlign: "center" }}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}
