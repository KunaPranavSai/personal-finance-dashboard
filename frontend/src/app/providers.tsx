"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SettingsProvider } from "@/lib/SettingsContext";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/lib/AuthContext";
import { SessionManagerProvider } from "@/lib/SessionManager";
import { DeviceProvider } from "@/lib/DeviceContext";

export function Providers({ children, isMobile }: { children: React.ReactNode; isMobile: boolean }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <DeviceProvider isMobile={isMobile}>
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <SessionManagerProvider>
                {children}
              </SessionManagerProvider>
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </DeviceProvider>
    </QueryClientProvider>
  );
}
