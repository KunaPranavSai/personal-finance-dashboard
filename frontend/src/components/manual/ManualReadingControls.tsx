"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, ListTree, X } from "lucide-react";
import { cn } from "@/lib/format";
import type { ManualHeading } from "@/lib/manual";
import { useActiveHeading } from "./useActiveHeading";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToY(y: number) {
  window.scrollTo({ top: y, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/**
 * Compact fixed reading utility for the manual: jump to top, jump to a
 * chapter (built from the same heading list the Contents panel and search
 * already use, never a second hardcoded list), and jump to bottom. Hidden
 * near the very top/bottom of the page rather than always shown.
 */
export function ManualReadingControls({ headings }: { headings: ManualHeading[] }) {
  const parts = headings.filter((h) => h.level === 2);
  const active = useActiveHeading(headings);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const topicButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      setAtTop(scrollY < 200);
      setAtBottom(maxScroll <= 0 || scrollY >= maxScroll - 200);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!topicOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTopicOpen(false);
        topicButtonRef.current?.focus();
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || topicButtonRef.current?.contains(target)) return;
      setTopicOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [topicOpen]);

  // Update the disabled/hidden state immediately on click rather than
  // waiting for a "scroll" event: a programmatic scrollTo doesn't always
  // fire enough scroll events for the listener to catch the final resting
  // position, which could otherwise leave a button stuck disabled.
  const jumpToTop = () => {
    setAtTop(true);
    setAtBottom(false);
    scrollToY(0);
  };
  const jumpToBottom = () => {
    setAtTop(false);
    setAtBottom(true);
    scrollToY(document.documentElement.scrollHeight);
  };
  const jumpToTopic = (id: string) => {
    setTopicOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  };

  const buttonBase =
    "flex h-11 w-11 items-center justify-center rounded-xl border border-pp-border bg-pp-surface text-pp-text-dim shadow-pp transition-[opacity,background-color,color] duration-200 hover:bg-pp-surface-2 hover:text-pp-text disabled:pointer-events-none disabled:opacity-0";

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2 [padding-bottom:env(safe-area-inset-bottom)] lg:bottom-8 lg:right-8">
      {topicOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Jump to a chapter"
          className="mb-1 max-h-[60vh] w-64 overflow-y-auto rounded-pp border border-pp-border bg-pp-surface p-2 shadow-pp"
        >
          <div className="mb-1 flex items-center justify-between px-2 pt-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-pp-text-dim">Chapters</span>
            <button
              type="button"
              onClick={() => setTopicOpen(false)}
              aria-label="Close chapter list"
              className="flex h-7 w-7 items-center justify-center rounded-full text-pp-text-dim hover:bg-pp-surface-2"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <nav>
            {parts.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => jumpToTopic(h.id)}
                className={cn(
                  "block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  active === h.id ? "bg-pp-accent/10 font-medium text-pp-accent" : "text-pp-text-dim hover:bg-pp-surface-2 hover:text-pp-text"
                )}
              >
                {h.title}
              </button>
            ))}
          </nav>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button type="button" onClick={jumpToTop} disabled={atTop} aria-label="Jump to top" className={buttonBase}>
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          ref={topicButtonRef}
          type="button"
          onClick={() => setTopicOpen((v) => !v)}
          aria-label="Jump to topic"
          aria-expanded={topicOpen}
          className={cn(buttonBase, topicOpen && "bg-pp-surface-2 text-pp-text")}
        >
          <ListTree className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={jumpToBottom} disabled={atBottom} aria-label="Jump to bottom" className={buttonBase}>
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
