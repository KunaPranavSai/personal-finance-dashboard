"use client";

import { useEffect, useState } from "react";
import type { ManualHeading } from "@/lib/manual";

/** Tracks which Part (H2) is currently in view, shared by the Contents
 * panel (active highlight) and the breadcrumb (current-section label) so
 * there is exactly one observer and one notion of "where the reader is",
 * not two that could disagree. */
export function useActiveHeading(headings: ManualHeading[]): string | null {
  const parts = headings.filter((h) => h.level === 2);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const elements = parts
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-100px 0px -70% 0px" }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return active;
}
