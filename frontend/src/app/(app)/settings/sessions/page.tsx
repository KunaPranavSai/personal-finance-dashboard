"use client";

import { Suspense } from "react";
import { useIsMobile } from "@/lib/DeviceContext";
import { Topbar } from "@/components/layout/AppTopbar";
import { MobileShell } from "@/components/mobile/MobileShell";
import { SessionList } from "@/components/security/SessionList";

export default function SessionsPage() {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <Suspense><MobileShell title="Sessions"><SessionList /></MobileShell></Suspense>;
  }
  return (
    <>
      <Topbar title="Sessions" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 2xl:px-10">
        <div className="pp-mobile mx-auto w-full max-w-3xl" style={{ minHeight: 0, background: "transparent" }}>
          <Suspense><SessionList /></Suspense>
        </div>
      </main>
    </>
  );
}
