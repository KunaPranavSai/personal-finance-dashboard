"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import { SettingsProvider } from "@/lib/SettingsContext";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/lib/AuthContext";
import { SessionManagerProvider } from "@/lib/SessionManager";
import { DeviceProvider } from "@/lib/DeviceContext";
import { initClientDataLifecycle } from "@/lib/clientDataCleanup";
import { CookieConsentProvider } from "@/components/consent/CookieConsentContext";
import { CookieConsentGate } from "@/components/consent/CookieConsentGate";
import { useAuth } from "@/lib/AuthContext";
import { LivePlaceholders } from "@/components/ui/LivePlaceholders";

/** Persistent banner while an admin's "Access as User" session is active. */
function ImpersonationBanner() {
  const { impersonating, exitImpersonation } = useAuth();
  if (!impersonating) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sm font-medium text-black">
      Viewing as {impersonating.targetUser.name} ({impersonating.targetUser.email}) — accessed by {impersonating.adminName}
      <button onClick={() => void exitImpersonation()} className="rounded bg-black/20 px-2 py-0.5 text-xs font-semibold hover:bg-black/30">
        Exit
      </button>
    </div>
  );
}

/**
 * React-Query keys carry no user id, so the cache must never outlive the signed-in identity:
 * on logout or a user switch, cancel in-flight requests (their results would land in the new
 * session) and drop every cached response. Fresh login (null -> user) needs nothing: logout already cleared.
 */
function QueryCacheScope() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    const id = user?.uid ?? null;
    if (prev.current !== null && prev.current !== id) {
      void qc.cancelQueries();
      qc.clear();
    }
    prev.current = id;
  }, [user?.uid, qc]);
  return null;
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
    <MotionConfig reducedMotion="user">
    <QueryClientProvider client={client}>
      <DeviceProvider isMobile={isMobile}>
        <AuthProvider>
          <QueryCacheScope />
          <SettingsProvider>
            <ToastProvider>
              <SessionManagerProvider>
                <CookieConsentProvider>
                  <ImpersonationBanner />
                  {children}
                  <CookieConsentGate />
                  <LivePlaceholders />
                </CookieConsentProvider>
              </SessionManagerProvider>
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </DeviceProvider>
    </QueryClientProvider>
    </MotionConfig>
  );
}
