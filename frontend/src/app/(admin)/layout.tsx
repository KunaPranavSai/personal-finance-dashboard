"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Footer } from "@/components/layout/Footer";
import { SessionWarningModal } from "@/components/ui/SessionWarningModal";
import { LockScreen } from "@/components/ui/LockScreen";
import { useAuth } from "@/lib/AuthContext";

export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const {
    user,
    isAuthenticated,
    isLoading,
    sessionTimeoutWarning,
    isLocked,
    logout,
    unlock,
    dismissTimeoutWarning,
  } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
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

  return (
    <div className="flex min-h-screen bg-surface dark:bg-navy-dark">
      <AdminSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
        <Footer />
      </div>
      <SessionWarningModal
        isOpen={sessionTimeoutWarning}
        onDismiss={dismissTimeoutWarning}
        onLogout={logout}
      />
      <LockScreen isOpen={isLocked} onUnlock={unlock} />
    </div>
  );
}
