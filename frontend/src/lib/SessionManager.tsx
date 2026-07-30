"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, SESSION_EXPIRED_REASON_KEY } from "./AuthContext";
import { API_ACTIVITY_EVENT, SESSION_EXPIRED_EVENT } from "./api";
import { SessionWarningModal } from "@/components/ui/SessionWarningModal";

/** How long before the inactivity timeout expires the warning modal appears. */
const WARNING_SECONDS = 60;
/** Activity events firing faster than this are coalesced into one reset. */
const ACTIVITY_DEBOUNCE_MS = 1000;

const BROADCAST_CHANNEL_NAME = "pfd-session";
/** localStorage fallback for browsers without BroadcastChannel — any write
 * fires a 'storage' event in every OTHER tab. */
const CROSS_TAB_STORAGE_KEY = "pfd-session-broadcast";

type BroadcastMessage = { type: "activity" | "logout"; ts: number };

interface SessionManagerContextType {
  warningOpen: boolean;
  secondsRemaining: number;
  stayLoggedIn: () => void;
  logoutNow: () => void;
}

const SessionManagerContext = createContext<SessionManagerContextType | null>(null);

/** Exposed for anywhere that wants to read the live warning/countdown state
 * outside of the modal itself (currently unused, but keeps the context reusable). */
export function useSessionManager() {
  const ctx = useContext(SessionManagerContext);
  if (!ctx) throw new Error("useSessionManager must be used within SessionManagerProvider");
  return ctx;
}

export function SessionManagerProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, sessionTimeoutMinutes, extendSession, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(WARNING_SECONDS);

  const warnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastProcessedActivityRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const clearTimers = useCallback(() => {
    if (warnTimeoutRef.current) clearTimeout(warnTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    warnTimeoutRef.current = null;
    countdownIntervalRef.current = null;
  }, []);

  const broadcast = useCallback((message: BroadcastMessage) => {
    channelRef.current?.postMessage(message);
    try {
      localStorage.setItem(CROSS_TAB_STORAGE_KEY, JSON.stringify(message));
    } catch {
      // ignore — BroadcastChannel above already covers most browsers
    }
  }, []);

  const forceLogout = useCallback(
    async (broadcastToOtherTabs: boolean) => {
      clearTimers();
      setWarningOpen(false);
      try {
        sessionStorage.setItem(SESSION_EXPIRED_REASON_KEY, "inactivity");
      } catch {
        // ignore
      }
      if (broadcastToOtherTabs) broadcast({ type: "logout", ts: Date.now() });
      await logout();
      router.replace("/login");
    },
    [clearTimers, broadcast, logout, router]
  );

  const startWarningCountdown = useCallback(() => {
    setWarningOpen(true);
    const deadline = Date.now() + WARNING_SECONDS * 1000;
    setSecondsRemaining(WARNING_SECONDS);
    countdownIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearTimers();
        void forceLogout(true);
      }
    }, 250);
  }, [clearTimers, forceLogout]);

  const scheduleTimers = useCallback(() => {
    clearTimers();
    setWarningOpen(false);
    if (!isAuthenticated || !sessionTimeoutMinutes || sessionTimeoutMinutes <= 0) return; // 0 = "Never"
    const totalMs = sessionTimeoutMinutes * 60 * 1000;
    const warnAfterMs = Math.max(0, totalMs - WARNING_SECONDS * 1000);
    warnTimeoutRef.current = setTimeout(startWarningCountdown, warnAfterMs);
  }, [clearTimers, isAuthenticated, sessionTimeoutMinutes, startWarningCountdown]);

  /** The single entry point for "the user (or another tab) was just active." */
  const handleActivity = useCallback(
    (broadcastToOtherTabs: boolean) => {
      const now = Date.now();
      if (now - lastProcessedActivityRef.current < ACTIVITY_DEBOUNCE_MS) return;
      lastProcessedActivityRef.current = now;
      scheduleTimers();
      if (broadcastToOtherTabs) broadcast({ type: "activity", ts: now });
    },
    [scheduleTimers, broadcast]
  );

  // Local activity listeners: mouse, keyboard, touch, scroll.
  useEffect(() => {
    if (!isAuthenticated) return;
    const onActivity = () => handleActivity(true);
    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onActivity));
  }, [isAuthenticated, handleActivity]);

  // Route changes count as activity too.
  useEffect(() => {
    if (!isAuthenticated) return;
    handleActivity(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isAuthenticated]);

  // Successful authenticated API requests count as activity.
  useEffect(() => {
    if (!isAuthenticated) return;
    const onApiActivity = () => handleActivity(true);
    window.addEventListener(API_ACTIVITY_EVENT, onApiActivity);
    return () => window.removeEventListener(API_ACTIVITY_EVENT, onApiActivity);
  }, [isAuthenticated, handleActivity]);

  // The server told us (via a 401 that a silent refresh couldn't recover
  // from) that the inactivity window has genuinely lapsed — follow suit
  // immediately rather than waiting for the local countdown.
  useEffect(() => {
    if (!isAuthenticated) return;
    const onExpired = () => void forceLogout(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [isAuthenticated, forceLogout]);

  // Whenever the configured timeout changes (e.g. saved from Settings) or
  // the user logs in/out, (re)schedule from a clean slate.
  useEffect(() => {
    scheduleTimers();
    return clearTimers;
  }, [scheduleTimers, clearTimers]);

  // Cross-tab sync: BroadcastChannel where available, localStorage 'storage'
  // events as a fallback for older browsers.
  useEffect(() => {
    if (!isAuthenticated) return;
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channelRef.current = channel;
      channel.onmessage = (e: MessageEvent<BroadcastMessage>) => {
        if (e.data.type === "logout") void forceLogout(false);
        else handleActivity(false);
      };
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CROSS_TAB_STORAGE_KEY || !e.newValue) return;
      try {
        const message = JSON.parse(e.newValue) as BroadcastMessage;
        if (message.type === "logout") void forceLogout(false);
        else handleActivity(false);
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
  }, [isAuthenticated, handleActivity, forceLogout]);

  const stayLoggedIn = useCallback(() => {
    void (async () => {
      const ok = await extendSession();
      if (!ok) {
        await forceLogout(true);
        return;
      }
      scheduleTimers();
      broadcast({ type: "activity", ts: Date.now() });
    })();
  }, [extendSession, forceLogout, scheduleTimers, broadcast]);

  const logoutNow = useCallback(() => {
    void forceLogout(true);
  }, [forceLogout]);

  const value = useMemo<SessionManagerContextType>(
    () => ({ warningOpen, secondsRemaining, stayLoggedIn, logoutNow }),
    [warningOpen, secondsRemaining, stayLoggedIn, logoutNow]
  );

  return (
    <SessionManagerContext.Provider value={value}>
      {children}
      <SessionWarningModal
        isOpen={isAuthenticated && warningOpen}
        secondsRemaining={secondsRemaining}
        totalSeconds={WARNING_SECONDS}
        onStayLoggedIn={stayLoggedIn}
        onLogoutNow={logoutNow}
      />
    </SessionManagerContext.Provider>
  );
}
