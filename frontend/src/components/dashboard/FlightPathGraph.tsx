"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useAnimationFrame } from "framer-motion";

const WIDTH = 120;
const HEIGHT = 36;
const DURATION_MS = 4000;

/** Builds a smooth (Catmull-Rom → cubic Bezier) SVG path through `values`,
 * normalized into a WIDTH x HEIGHT viewBox with a little vertical padding
 * so the line and its glow never clip. */
function buildSmoothPath(values: number[]): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = HEIGHT * 0.18;
  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * WIDTH,
    y: HEIGHT - pad - ((v - min) / range) * (HEIGHT - pad * 2),
  }));

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * A tiny animated "flight path" line graph: a smooth trend line with a
 * pulsing gradient trail and a glowing plane that loops continuously along
 * it. Position is driven by the real SVG path geometry (getPointAtLength)
 * rather than CSS offset-path, so it renders identically across browsers.
 */
export function FlightPathGraph({ data, className }: { data: number[]; className?: string }) {
  const pathRef = useRef<SVGPathElement>(null);
  const [plane, setPlane] = useState({ x: WIDTH, y: HEIGHT / 2, angle: 0 });
  // Stable across server and client renders (unlike Math.random()), so this
  // never trips a hydration mismatch on the gradient/filter references below.
  const reactId = useId();
  const gradientId = `flight-path-${reactId}`;
  const glowId = `flight-glow-${reactId}`;

  const d = useMemo(() => buildSmoothPath(data), [data]);

  useEffect(() => {
    // Snap the plane to the path's start as soon as it's laid out, so it
    // never flashes at the default (WIDTH, HEIGHT/2) position on mount.
    const el = pathRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    if (len > 0) {
      const p = el.getPointAtLength(0);
      setPlane({ x: p.x, y: p.y, angle: 0 });
    }
  }, [d]);

  useAnimationFrame((time) => {
    const el = pathRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    if (!len) return;
    const t = (time % DURATION_MS) / DURATION_MS;
    const dist = t * len;
    const p = el.getPointAtLength(dist);
    const ahead = el.getPointAtLength(Math.min(len, dist + 1));
    const angle = (Math.atan2(ahead.y - p.y, ahead.x - p.x) * 180) / Math.PI;
    setPlane({ x: p.x, y: p.y, angle });
  });

  if (!d) return null;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={className}
      style={{ overflow: "visible", willChange: "transform" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.9" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Pulsing trail glow beneath the crisp line, visualizing momentum. */}
      <motion.path
        d={d}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.35}
        animate={{ opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <path ref={pathRef} d={d} fill="none" stroke={`url(#${gradientId})`} strokeWidth={1.5} strokeLinecap="round" />

      <g transform={`translate(${plane.x} ${plane.y}) rotate(${plane.angle})`} filter={`url(#${glowId})`}>
        <path d="M -3.5 -2 L 3.5 0 L -3.5 2 L -2 0 Z" fill="currentColor" />
      </g>
    </svg>
  );
}
