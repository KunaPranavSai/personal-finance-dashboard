"use client";

import { Suspense } from "react";
import { useIsMobile } from "@/lib/DeviceContext";
import { Topbar } from "@/components/layout/AppTopbar";
import { MobileActivityView } from "@/components/mobile/MobileActivityView";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export default function ActivityPage() {
  const isMobile = useIsMobile();
  if (isMobile) return <Suspense><MobileActivityView /></Suspense>;
  return (
    <>
      <Topbar title="Activity" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 2xl:px-10">
        {/* Same ledger and styling as mobile: .pp-mobile supplies the --ppm tokens. */}
        <div className="pp-mobile mx-auto w-full max-w-3xl" style={{ minHeight: 0, background: "transparent" }}>
          <Suspense><ActivityFeed /></Suspense>
        </div>
      </main>
    </>
  );
}
