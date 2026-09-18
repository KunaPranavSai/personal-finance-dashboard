"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { SwipeSidebarHandler } from "@/components/layout/SwipeSidebarHandler";
import { OfflineSyncManager } from "@/components/pwa/OfflineSyncManager";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";
import { Footer } from "@/components/layout/Footer";
import { DataInit } from "@/components/DataInit";
import { TwoFactorReverifyDialog } from "@/components/ui/TwoFactorReverifyDialog";
import { useAuth } from "@/lib/AuthContext";
import { useDriveStatus, isDriveReady } from "@/lib/driveStatus";
import { getStorageMode } from "@/lib/storage";
import { useIsMobile } from "@/lib/DeviceContext";

export function AppShellLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  // Admins keep self-service access to their own Settings (password/UID/2FA), but
  // every other personal-finance page belongs to the USER role's dashboard only.
  const isSelfServiceRoute = pathname?.startsWith("/settings");
  // Google Drive is the only persistent store for a USER account's financial data — the
  // mandatory-onboarding gate below redirects here until it's connected. Admins don't use
  // this app for personal finances, so they're exempt (mirrors the backend's
  // requireDriveConnected middleware, which skips non-USER roles the same way).
  // A user who has explicitly chosen "This Device Only" storage (see
  // lib/storage) never connects Drive at all — the mandatory-Drive gate
  // below must not apply to them. This is a per-browser preference (not
  // server-known), which matches Local-Only mode's own nature: the data
  // itself never leaves this device either.
  const isLocalOnly = getStorageMode() === "local";
  const requiresDrive = Boolean(user && user.role === "USER" && !isLocalOnly);
  const { data: driveStatus, isLoading: driveStatusLoading } = useDriveStatus();
  const driveReady = !requiresDrive || isDriveReady(driveStatus);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${redirect}`);
    } else if (!isLoading && user && user.role !== "USER" && !isSelfServiceRoute) {
      router.replace("/admin");
    } else if (!isLoading && requiresDrive && !driveStatusLoading && !driveReady) {
      router.replace("/connect-drive");
    }
  }, [isAuthenticated, isLoading, user, isSelfServiceRoute, requiresDrive, driveStatusLoading, driveReady, router, pathname]);

  if (isLoading || (user && user.role !== "USER" && !isSelfServiceRoute) || (requiresDrive && (driveStatusLoading || !driveReady))) {
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

  // Mobile UAs get no Sidebar/Footer/desktop chrome — each page renders its
  // own MobileShell (app bar + bottom nav) directly, same as the previous
  // separate mobile app did. Everything above this point (auth, admin, and
  // Drive gating) is identical for both, so there is only ever one gating
  // implementation now instead of a duplicated one.
  if (isMobile) {
    return (
      <div className="pp-mobile">
        <DataInit />
        {children}
        <TwoFactorReverifyDialog />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface dark:bg-navy-dark">
      <DataInit />
      <OfflineSyncManager />
      <PwaInstallPrompt />
      <SwipeSidebarHandler />
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
        <Footer />
      </div>
      <TwoFactorReverifyDialog />
    </div>
  );
}
