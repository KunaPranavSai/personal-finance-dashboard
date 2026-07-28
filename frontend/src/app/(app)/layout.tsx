"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useClerkUserProfile } from "@/lib/useClerkUserProfile";
import { Sidebar } from "@/components/layout/Sidebar";
import { SwipeSidebarHandler } from "@/components/layout/SwipeSidebarHandler";
import { OfflineSyncManager } from "@/components/pwa/OfflineSyncManager";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";
import { Footer } from "@/components/layout/Footer";
import { DataInit } from "@/components/DataInit";
import { SessionWarningModal } from "@/components/ui/SessionWarningModal";
import { SessionWarningBanner } from "@/components/ui/SessionWarningBanner";
import { LockScreen } from "@/components/ui/LockScreen";
import { TwoFactorReverifyDialog } from "@/components/ui/TwoFactorReverifyDialog";
import { useAuth } from "@/lib/AuthContext";
import { isClerkAuth } from "@/lib/authProvider";

/**
 * Legacy password/JWT app shell — unmodified from before the Clerk
 * migration. Renders when NEXT_PUBLIC_AUTH_PROVIDER is unset or "legacy"
 * (the default). Owns the custom session-timer UI (banner/modal/lock
 * screen/2FA reverify), none of which apply under Clerk, which manages its
 * own session lifetime.
 */
function LegacyAppShellLayout({ children }: { children: React.ReactNode }) {
  const {
    user,
    isAuthenticated,
    isLoading,
    sessionState,
    sessionSecondsRemaining,
    isLocked,
    logout,
    unlock,
    extendSession,
  } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Admins keep self-service access to their own Settings (password/UID/2FA), but
  // every other personal-finance page belongs to the USER role's dashboard only.
  const isSelfServiceRoute = pathname?.startsWith("/settings");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${redirect}`);
    } else if (!isLoading && user && user.role !== "USER" && !isSelfServiceRoute) {
      router.replace("/admin");
    }
  }, [isAuthenticated, isLoading, user, isSelfServiceRoute, router, pathname]);

  if (isLoading || (user && user.role !== "USER" && !isSelfServiceRoute)) {
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
      <SessionWarningBanner visible={sessionState === "warning"} secondsRemaining={sessionSecondsRemaining} />
      <SessionWarningModal
        isOpen={sessionState === "critical"}
        secondsRemaining={sessionSecondsRemaining}
        onExtend={extendSession}
        onLogout={() => logout()}
      />
      <LockScreen isOpen={isLocked} onUnlock={unlock} />
      <TwoFactorReverifyDialog />
    </div>
  );
}

/**
 * Clerk app shell — gates on Clerk's own sign-in state instead of the
 * legacy AuthContext. No custom session-timer UI: Clerk manages session
 * lifetime and expiry itself. The PWA install prompt is still only mounted
 * post-auth here, so it only ever appears after a successful Clerk login.
 */
function ClerkAppShellLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, profile, isResolving } = useClerkUserProfile();
  const router = useRouter();
  const pathname = usePathname();
  const isSelfServiceRoute = pathname?.startsWith("/settings");

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/sign-in${redirect}`);
    } else if (profile && profile.role !== "USER" && !isSelfServiceRoute) {
      router.replace("/admin");
    }
  }, [isLoaded, isSignedIn, profile, isSelfServiceRoute, router, pathname]);

  if (!isLoaded || isResolving || (profile && profile.role !== "USER" && !isSelfServiceRoute)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface dark:bg-navy-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal/30 border-t-teal" />
          <p className="text-sm text-navy/50 dark:text-white/50">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) return null;

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
    </div>
  );
}

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return isClerkAuth ? <ClerkAppShellLayout>{children}</ClerkAppShellLayout> : <LegacyAppShellLayout>{children}</LegacyAppShellLayout>;
}
