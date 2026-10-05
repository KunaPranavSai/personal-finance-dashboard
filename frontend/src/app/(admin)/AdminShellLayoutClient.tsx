"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { SwipeSidebarHandler } from "@/components/layout/SwipeSidebarHandler";
import { Footer } from "@/components/layout/Footer";
import { TwoFactorReverifyDialog } from "@/components/ui/TwoFactorReverifyDialog";
import { CommandHeader } from "@/components/admin/CommandHeader";
import { AdminMobileShell } from "@/components/admin/AdminMobileShell";
import { PinGate } from "@/components/auth/pin";
import { PinSetupGate } from "@/components/auth/PinSetupGate";
import { useAuth } from "@/lib/AuthContext";
import { useIsMobile } from "@/lib/DeviceContext";
import { useDailyLogin } from "@/lib/useDailyLogin";
import "@/styles/admin-command-center.css";

export function AdminShellLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isMobile = useIsMobile();
  useDailyLogin("/admin-login");
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/admin-login");
    } else if (!isLoading && user && user.role === "USER") {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading || (user && user.role === "USER")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface dark:bg-navy-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal/30 border-t-teal" />
          <p className="text-sm text-navy/50 dark:text-white/50">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Phones get the same app bar + bottom navigation as the user app; desktop keeps the sidebar console.
  if (isMobile) {
    return (
      <PinGate userId={user?.uid ?? ""}>
        <AdminMobileShell>{children}</AdminMobileShell>
        <TwoFactorReverifyDialog />
        <PinSetupGate />
      </PinGate>
    );
  }

  return (
    <PinGate userId={user?.uid ?? ""}>
      <div className="cc-root dark flex min-h-screen">
        <SwipeSidebarHandler />
        <AdminSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <CommandHeader />
          {children}
          <Footer />
        </div>
        <TwoFactorReverifyDialog />
        <PinSetupGate />
      </div>
    </PinGate>
  );
}
