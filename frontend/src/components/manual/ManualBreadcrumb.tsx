"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ManualHeading } from "@/lib/manual";
import { useActiveHeading } from "./useActiveHeading";

/** Shows which Part (H2) is currently in view as the third breadcrumb
 * segment, so the reader always knows where they are in a long document. */
export function ManualBreadcrumb({ headings }: { headings: ManualHeading[] }) {
  const active = useActiveHeading(headings);
  const activeTitle = headings.find((h) => h.level === 2 && h.id === active)?.title;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-pp-text-dim">
      <Link href="/" className="hover:text-pp-accent">Penny Pilot</Link>
      <ChevronRight className="h-3 w-3" aria-hidden="true" />
      <Link href="/manual" className="hover:text-pp-accent">User Manual</Link>
      {activeTitle && (
        <>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span className="truncate text-pp-text" aria-current="location">{activeTitle}</span>
        </>
      )}
    </nav>
  );
}
