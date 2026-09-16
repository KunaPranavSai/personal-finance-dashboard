"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import "./mobile.css";
import { DataInit } from "@/components/DataInit";
import { LockScreen } from "@/components/ui/LockScreen";
import { TwoFactorReverifyDialog } from "@/components/ui/TwoFactorReverifyDialog";
import { useAuth, hasUnconfirmedRecentLogin, SESSION_EXPIRED_REASON_KEY } from "@/lib/AuthContext";
import { useDriveStatus, isDriveReady } from "@/lib/driveStatus";
import { getStorageMode } from "@/lib/storage";

/**
 * Root layout for the isolated /m mobile-UI tree (Section 2/26 of the
 * approved implementation brief). Reuses the exact same auth/Drive gating
 * as (app)/layout.tsx — same redirects, same DataInit/LockScreen/2FA
 * reverify wiring — so a signed-in session behaves identically whether the
 * user is on /dashboard or /m/dashboard. Only the visual chrome differs:
 * each /m/* page renders its own MobileShell (app bar + bottom nav) instead
 * of the desktop Sidebar. The existing (app) tree is never imported or
 * modified by anything under this directory.
 */
export default function MobileShellLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, isLocked, unlock } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isLocalOnly = getStorageMode() === "local";
  const requiresDrive = Boolean(user && user.role === "USER" && !isLocalOnly);
  const { data: driveStatus, isLoading: driveStatusLoading } = useDriveStatus();
  const driveReady = !requiresDrive || isDriveReady(driveStatus);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (hasUnconfirmedRecentLogin()) {
        try {
          sessionStorage.setItem(SESSION_EXPIRED_REASON_KEY, "cookie-not-persisted");
        } catch {
          // ignore
        }
      }
      const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${redirect}`);
    } else if (!isLoading && user && user.role !== "USER") {
      // Admin accounts have no personal finance workspace of their own —
      // same rule as the desktop shell.
      router.replace("/admin");
    } else if (!isLoading && requiresDrive && !driveStatusLoading && !driveReady) {
      router.replace("/connect-drive");
    }
  }, [isAuthenticated, isLoading, user, requiresDrive, driveStatusLoading, driveReady, router, pathname]);

  if (isLoading || (user && user.role !== "USER") || (requiresDrive && (driveStatusLoading || !driveReady))) {
    return (
      <div className="pp-mobile" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div
            style={{
              height: 40,
              width: 40,
              borderRadius: "50%",
              border: "4px solid var(--ppm-border)",
              borderTopColor: "var(--ppm-accent)",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p style={{ fontSize: 14, color: "var(--ppm-text-dim)" }}>Loading…</p>
        </div>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="pp-mobile">
      <DataInit />
      {children}
      <LockScreen isOpen={isLocked} onUnlock={unlock} />
      <TwoFactorReverifyDialog />
    </div>
  );
}
