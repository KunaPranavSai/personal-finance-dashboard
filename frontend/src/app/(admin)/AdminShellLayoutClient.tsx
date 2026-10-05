"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TwoFactorReverifyDialog } from "@/components/ui/TwoFactorReverifyDialog";
import { AdminShell } from "@/components/admin/AdminShell";
import { PinGate } from "@/components/auth/pin";
import { PinSetupGate } from "@/components/auth/PinSetupGate";
import { useAuth } from "@/lib/AuthContext";
import { useDailyLogin } from "@/lib/useDailyLogin";

/** One responsive admin layout for every screen size (the old separate phone and desktop shells are gone). */
export function AdminShellLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  useDailyLogin("/admin-login");
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/admin-login");
    else if (!isLoading && user && user.role === "USER") router.replace("/dashboard");
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading || (user && user.role === "USER")) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0a0e16" }} role="status" aria-label="Loading">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-400/30 border-t-teal-400" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <PinGate userId={user?.uid ?? ""}>
      <AdminShell>{children}</AdminShell>
      <TwoFactorReverifyDialog />
      <PinSetupGate />
    </PinGate>
  );
}
