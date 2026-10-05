"use client";

import { Suspense } from "react";
import { useIsMobile } from "@/lib/DeviceContext";
import { Topbar } from "@/components/layout/AppTopbar";
import { MobileShell } from "@/components/mobile/MobileShell";
import { CapitalOverview } from "@/components/capital/CapitalOverview";

export default function CapitalPage() {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Suspense>
        <MobileShell title="Capital"><CapitalOverview /></MobileShell>
      </Suspense>
    );
  }
  return (
    <>
      <Topbar title="Capital" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 2xl:px-10">
        {/* Same cards as mobile: .pp-mobile supplies the --ppm tokens. */}
        <div className="pp-mobile mx-auto w-full max-w-3xl" style={{ minHeight: 0, background: "transparent" }}>
          <Suspense><CapitalOverview /></Suspense>
        </div>
      </main>
    </>
  );
}
