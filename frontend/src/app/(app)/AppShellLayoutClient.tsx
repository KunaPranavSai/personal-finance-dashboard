"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { SwipeSidebarHandler } from "@/components/layout/SwipeSidebarHandler";
import { OfflineSyncManager } from "@/components/pwa/OfflineSyncManager";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";
import { Footer } from "@/components/layout/Footer";
import { DataInit } from "@/components/DataInit";
import { TwoFactorReverifyDialog } from "@/components/ui/TwoFactorReverifyDialog";
import { PpToastProvider } from "@/components/ui/PpToast";
import { PpConfirmProvider } from "@/components/ui/PpConfirm";
import { useAuth } from "@/lib/AuthContext";
import { useDriveStatus, isDriveReady } from "@/lib/driveStatus";
import { getStorageMode } from "@/lib/storage";
import { useIsMobile } from "@/lib/DeviceContext";
import { useDailyLogin } from "@/lib/useDailyLogin";

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
  const queryClient = useQueryClient();
  useDailyLogin();

  // Reconcile financial state when the tab regains focus/visibility — the
  // same data may have changed from another device/tab/session since Drive
  // is the shared source of truth. Drive-mode CRUD already writes through
  // synchronously (see DriveStorageProvider), so there's no separate
  // "background sync" queue to manage here; this just makes sure a
  // returning tab doesn't keep showing whatever it had cached before the
  // user switched away. No-op in Local-Only mode (nothing to reconcile —
  // the data never leaves this device) and while auth/Drive gating hasn't
  // resolved yet.
  useEffect(() => {
    if (isLocalOnly || !isAuthenticated) return;
    const reconcile = () => {
      if (document.visibilityState !== "visible") return;
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"], refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: ["transactions"], refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: ["budgets"], refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: ["investments"], refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: ["bills"], refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: ["goals"], refetchType: "active" });
    };
    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    return () => {
      window.removeEventListener("focus", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, [isLocalOnly, isAuthenticated, queryClient]);

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
      <div className="flex min-h-screen items-center justify-center bg-pp-surface ">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-pp-accent/30 border-t-pp-accent" />
          <p className="text-sm text-pp-text-dim">Loading…</p>
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
      <PpToastProvider>
        <PpConfirmProvider>
          <div className="pp-mobile">
            <DataInit />
            {children}
            <TwoFactorReverifyDialog />
          </div>
        </PpConfirmProvider>
      </PpToastProvider>
    );
  }

  return (
    <PpToastProvider>
      <PpConfirmProvider>
        <div className="flex min-h-screen bg-pp-surface ">
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
      </PpConfirmProvider>
    </PpToastProvider>
  );
}
