"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SettingsProvider } from "@/lib/SettingsContext";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/lib/AuthContext";
import { SessionManagerProvider } from "@/lib/SessionManager";

export function Providers({ children }: { children: React.ReactNode }) {
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
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <SessionManagerProvider>
              {children}
            </SessionManagerProvider>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
