"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { DataInit } from "@/components/DataInit";
import { SessionWarningModal } from "@/components/ui/SessionWarningModal";
import { LockScreen } from "@/components/ui/LockScreen";
import { useAuth } from "@/lib/AuthContext";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const {
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
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
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
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <SessionWarningModal
        isOpen={sessionTimeoutWarning}
        onDismiss={dismissTimeoutWarning}
        onLogout={logout}
      />
      <LockScreen isOpen={isLocked} onUnlock={unlock} />
    </div>
  );
}
