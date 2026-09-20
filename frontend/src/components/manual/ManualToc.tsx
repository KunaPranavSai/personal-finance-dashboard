"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";
import type { ManualHeading } from "@/lib/manual";
import { useActiveHeading } from "./useActiveHeading";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Left-hand table of contents on desktop (sticky, no independent scrollbar
 * of its own, native sticky positioning does the rest), a collapsible menu
 * on mobile. Built directly from the manual's own H2 headings, so it can
 * never drift from the actual document structure. */
export function ManualToc({ headings }: { headings: ManualHeading[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = useActiveHeading(headings);
  const parts = headings.filter((h) => h.level === 2);
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const activeItemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  // Keep the active chapter comfortably visible inside the Contents panel's
  // own scroll position as the reader scrolls the document — without ever
  // moving the page itself. Only scrolls the TOC's internal container
  // (scrollIntoView with a block/inline that stays inside the nearest
  // scrollable ancestor never touches window scroll).
  useEffect(() => {
    if (!active) return;
    const el = activeItemRefs.current.get(active);
    const container = desktopScrollRef.current;
    if (!el || !container) return;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    const margin = 24;
    if (elTop >= viewTop + margin && elBottom <= viewBottom - margin) return; // already comfortably visible
    const target = elTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [active]);

  const list = (setRef?: boolean) => (
    <nav aria-label="Table of contents" className="space-y-0.5">
      {parts.map((h) => (
        <a
          key={h.id}
          ref={setRef ? (el) => { if (el) activeItemRefs.current.set(h.id, el); else activeItemRefs.current.delete(h.id); } : undefined}
          href={`#${h.id}`}
          onClick={() => setMobileOpen(false)}
          aria-current={active === h.id ? "location" : undefined}
          className={cn(
            "block min-h-[36px] rounded-lg px-3 py-1.5 text-sm leading-tight transition-colors",
            active === h.id
              ? "bg-pp-accent/10 font-medium text-pp-accent"
              : "text-pp-text-dim hover:bg-pp-surface-2 hover:text-pp-text"
          )}
        >
          {h.title}
        </a>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile: collapsible */}
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-controls="manual-toc-mobile"
          className="flex min-h-[44px] w-full items-center justify-between rounded-pp border border-pp-border bg-pp-surface px-4 text-sm font-semibold text-pp-text"
        >
          Table of contents
          <ChevronDown className={cn("h-4 w-4 transition-transform", mobileOpen && "rotate-180")} aria-hidden="true" />
        </button>
        {mobileOpen && (
          <div id="manual-toc-mobile" className="mt-2 max-h-80 overflow-y-auto rounded-pp border border-pp-border bg-pp-surface p-2">
            {list(false)}
          </div>
        )}
      </div>

      {/* Desktop: outer wrapper stays sticky (pinned near the top of the
          viewport, page itself is still the only thing that scrolls). The
          inner container can scroll on its own — needed so the active
          chapter can be brought into view and so hovering the panel with a
          mouse/trackpad feels natural — but its scrollbar is hidden and,
          by default browser behavior, wheel input over it only scrolls the
          list itself; once it hits its own top/bottom the scroll chains
          straight through to the page (no `overscroll-behavior: contain`,
          which would otherwise trap the cursor at the boundary). */}
      <aside aria-label="Table of contents" className="hidden lg:block">
        <div className="sticky top-24">
          <div
            ref={desktopScrollRef}
            className="manual-toc-scroll max-h-[calc(100vh-7rem)] overflow-y-auto pr-1"
          >
            {list(true)}
          </div>
        </div>
      </aside>
    </>
  );
}
