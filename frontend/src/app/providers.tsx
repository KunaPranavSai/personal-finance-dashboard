"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SettingsProvider } from "@/lib/SettingsContext";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/lib/AuthContext";
import { SessionManagerProvider } from "@/lib/SessionManager";
import { DeviceProvider } from "@/lib/DeviceContext";
import { initClientDataLifecycle } from "@/lib/clientDataCleanup";
import { CookieConsentProvider } from "@/components/consent/CookieConsentContext";
import { CookieConsentGate } from "@/components/consent/CookieConsentGate";
import { useAuth } from "@/lib/AuthContext";

/** Persistent banner while an admin's "Access as User" session is active. */
function ImpersonationBanner() {
  const { impersonating, exitImpersonation } = useAuth();
  if (!impersonating) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-black">
      Viewing as {impersonating.targetUser.name} ({impersonating.targetUser.email}) — accessed by {impersonating.adminName}
      <button onClick={() => void exitImpersonation()} className="rounded bg-black/20 px-2 py-0.5 text-xs font-semibold hover:bg-black/30">
        Exit
      </button>
    </div>
  );
}

export function Providers({ children, isMobile }: { children: React.ReactNode; isMobile: boolean }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      })
  );

  // Runs once per app load: clears Penny Pilot's own sensitive client
  // storage if the previous tab/session has been closed or backgrounded for
  // 10+ minutes, then keeps a last-active heartbeat going. See
  // lib/clientDataCleanup.ts for exactly what is/isn't cleared and why.
  useEffect(() => {
    initClientDataLifecycle();
  }, []);

  return (
    <QueryClientProvider client={client}>
      <DeviceProvider isMobile={isMobile}>
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <SessionManagerProvider>
                <CookieConsentProvider>
                  <ImpersonationBanner />
                  {children}
                  <CookieConsentGate />
                </CookieConsentProvider>
              </SessionManagerProvider>
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </DeviceProvider>
    </QueryClientProvider>
  );
}
