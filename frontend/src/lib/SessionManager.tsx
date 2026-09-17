"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, ReactNode } from "react";
import { useAuth, SESSION_EXPIRED_REASON_KEY, hasUnconfirmedRecentLogin } from "./AuthContext";
import { SESSION_EXPIRED_EVENT } from "./api";

const BROADCAST_CHANNEL_NAME = "pfd-session";
/** localStorage fallback for browsers without BroadcastChannel — any write
 * fires a 'storage' event in every OTHER tab. */
const CROSS_TAB_STORAGE_KEY = "pfd-session-broadcast";

type BroadcastMessage = { type: "logout"; ts: number };

interface SessionManagerContextType {
  logoutNow: () => void;
}

const SessionManagerContext = createContext<SessionManagerContextType | null>(null);

/** Exposed for anywhere that wants to trigger the same forced-logout path
 * this provider uses for genuine server-driven session invalidation. */
export function useSessionManager() {
  const ctx = useContext(SessionManagerContext);
  if (!ctx) throw new Error("useSessionManager must be used within SessionManagerProvider");
  return ctx;
}

/**
 * Follows genuine, server-driven session invalidation only — there is no
 * client-side inactivity timer, activity tracking, or warning countdown
 * here. The single trigger is `SESSION_EXPIRED_EVENT`, dispatched by
 * lib/api.ts when a request comes back 401 and a silent `/api/auth/refresh`
 * can't recover it (session-version bump, the account's own absolute
 * session deadline, or the refresh cookie itself expiring/being revoked —
 * all decided by the server, never by this component watching a clock).
 * Cross-tab sync exists so that when one tab is told its session died, every
 * other open tab follows immediately instead of continuing to act as if
 * still signed in.
 */
export function SessionManagerProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const channelRef = useRef<BroadcastChannel | null>(null);

  const broadcastLogout = useCallback(() => {
    const message: BroadcastMessage = { type: "logout", ts: Date.now() };
    channelRef.current?.postMessage(message);
    try {
      localStorage.setItem(CROSS_TAB_STORAGE_KEY, JSON.stringify(message));
    } catch {
      // ignore — BroadcastChannel above already covers most browsers
    }
  }, []);

  const forceLogout = useCallback(
    async (broadcastToOtherTabs: boolean) => {
      // A login succeeded moments ago in this tab but the very next
      // authenticated request already came back unauthenticated — that's a
      // session that never actually stuck (most commonly a cookie the
      // browser refused to persist/attach), not a genuine expiry. Label it
      // honestly so the login page doesn't tell someone who was active
      // seconds ago that their session expired.
      const reason = hasUnconfirmedRecentLogin() ? "cookie-not-persisted" : "inactivity";
      if (broadcastToOtherTabs) broadcastLogout();
      // logout() clears sessionStorage as part of its own privacy cleanup,
      // so the expiry-reason marker the login page reads must be set
      // *after* it returns, not before.
      await logout();
      try {
        sessionStorage.setItem(SESSION_EXPIRED_REASON_KEY, reason);
      } catch {
        // ignore
      }
      // Hard navigation — see Topbar's handleLogout for why router.replace
      // isn't enough for a real logout.
      window.location.href = "/login";
    },
    [broadcastLogout, logout]
  );

  // The server told us (via a 401 that a silent refresh couldn't recover
  // from) that the session is genuinely no longer valid — follow suit.
  useEffect(() => {
    if (!isAuthenticated) return;
    const onExpired = () => void forceLogout(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [isAuthenticated, forceLogout]);

  // Cross-tab sync: BroadcastChannel where available, localStorage 'storage'
  // events as a fallback for older browsers. Only "logout" is ever
  // broadcast — there is no activity signal to relay any more.
  useEffect(() => {
    if (!isAuthenticated) return;
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channelRef.current = channel;
      channel.onmessage = (e: MessageEvent<BroadcastMessage>) => {
        if (e.data.type === "logout") void forceLogout(false);
      };
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CROSS_TAB_STORAGE_KEY || !e.newValue) return;
      try {
        const message = JSON.parse(e.newValue) as BroadcastMessage;
        if (message.type === "logout") void forceLogout(false);
      } catch {
        // ignore malformed payloads
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      channel?.close();
      channelRef.current = null;
      window.removeEventListener("storage", onStorage);
    };
  }, [isAuthenticated, forceLogout]);

  const logoutNow = useCallback(() => {
    void forceLogout(true);
  }, [forceLogout]);

  const value = useMemo<SessionManagerContextType>(() => ({ logoutNow }), [logoutNow]);

  return <SessionManagerContext.Provider value={value}>{children}</SessionManagerContext.Provider>;
}
