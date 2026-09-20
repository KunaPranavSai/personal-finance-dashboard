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
