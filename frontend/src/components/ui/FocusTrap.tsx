"use client";

import { useRef, useEffect, ReactNode } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function FocusTrap({ children, active }: { children: ReactNode; active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focused = document.activeElement;
      if (e.shiftKey) {
        if (focused === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (focused === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [active]);

  return <div ref={containerRef}>{children}</div>;
}