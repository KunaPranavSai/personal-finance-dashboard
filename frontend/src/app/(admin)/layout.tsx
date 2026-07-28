"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { SwipeSidebarHandler } from "@/components/layout/SwipeSidebarHandler";
import { Footer } from "@/components/layout/Footer";
import { SessionWarningModal } from "@/components/ui/SessionWarningModal";
import { SessionWarningBanner } from "@/components/ui/SessionWarningBanner";
import { LockScreen } from "@/components/ui/LockScreen";
import { TwoFactorReverifyDialog } from "@/components/ui/TwoFactorReverifyDialog";
import { useAuth } from "@/lib/AuthContext";
import { useClerkUserProfile } from "@/lib/useClerkUserProfile";
import { isClerkAuth } from "@/lib/authProvider";

/** Legacy password/JWT admin shell — unmodified from before the Clerk migration. */
function LegacyAdminShellLayout({ children }: { children: React.ReactNode }) {
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${redirect}`);
    } else if (!isLoading && user && user.role === "USER") {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, user, router, pathname]);

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

  return (
    <div className="flex min-h-screen bg-surface dark:bg-navy-dark">
      <SwipeSidebarHandler />
      <AdminSidebar />
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

/** Clerk admin shell — gates on Clerk sign-in plus this app's own role (resolved via /api/auth/me). */
function ClerkAdminShellLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, profile, isResolving } = useClerkUserProfile();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/sign-in${redirect}`);
    } else if (profile && profile.role === "USER") {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, profile, router, pathname]);

  if (!isLoaded || isResolving || (profile && profile.role === "USER")) {
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
      <SwipeSidebarHandler />
      <AdminSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
        <Footer />
      </div>
    </div>
  );
}

export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  return isClerkAuth ? <ClerkAdminShellLayout>{children}</ClerkAdminShellLayout> : <LegacyAdminShellLayout>{children}</LegacyAdminShellLayout>;
}
