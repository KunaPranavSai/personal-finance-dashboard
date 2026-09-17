"use client";

import { useEffect, useRef, useState } from "react";
import type { Insight } from "./HomeInsights";

const PAGE_SIZE = 2;
const AUTO_ADVANCE_MS = 6000;
const ROW_HEIGHT = 34; // px, one insight row (icon + up-to-2-line clamped text)
const CONTAINER_HEIGHT = ROW_HEIGHT * PAGE_SIZE + 10; // + inter-row gap

/**
 * Fixed-height, swipeable Financial Intelligence carousel — 2 insights per
 * page, no dot/arrow chrome. Height never changes regardless of insight
 * text length (each row is capped at 2 lines via line-clamp), so this
 * never pushes the merged Net Worth card taller. Pages slide via a single
 * `transform: translateX` transition, driven by either the auto-advance
 * timer or a touch swipe — both go through the same `goTo`, so a manual
 * swipe always resets the auto-advance clock instead of fighting it.
 */
export function InsightCarousel({ insights }: { insights: Insight[] }) {
  const pageCount = Math.max(1, Math.ceil(insights.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    setPage(0);
  }, [insights.length]);

  const restartTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pageCount > 1) {
      timerRef.current = setInterval(() => setPage((p) => (p + 1) % pageCount), AUTO_ADVANCE_MS);
    }
  };

  useEffect(() => {
    restartTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount]);

  const goTo = (next: number) => {
    setPage(((next % pageCount) + pageCount) % pageCount);
    restartTimer();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const SWIPE_THRESHOLD = 40;
    if (delta > SWIPE_THRESHOLD) goTo(page - 1);
    else if (delta < -SWIPE_THRESHOLD) goTo(page + 1);
  };

  const pages = Array.from({ length: pageCount }, (_, i) => insights.slice(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE));

  return (
    <div
      style={{ height: CONTAINER_HEIGHT, overflow: "hidden", position: "relative", touchAction: "pan-y" }}
      onTouchStart={pageCount > 1 ? onTouchStart : undefined}
      onTouchEnd={pageCount > 1 ? onTouchEnd : undefined}
    >
      <div
        style={{
          display: "flex",
          width: `${pageCount * 100}%`,
          height: "100%",
          transform: `translateX(-${(100 / pageCount) * page}%)`,
          transition: reducedMotionRef.current ? "none" : "transform 0.4s ease",
        }}
      >
        {pages.map((pageInsights, i) => (
          <div key={i} style={{ width: `${100 / pageCount}%`, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {pageInsights.map((ins) => (
              <div key={ins.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", height: ROW_HEIGHT }}>
                <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1.3, flexShrink: 0 }}>{ins.icon}</span>
                <p
                  style={{
                    fontSize: 13, lineHeight: 1.4, color: "var(--ppm-text)", margin: 0,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {ins.text}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
