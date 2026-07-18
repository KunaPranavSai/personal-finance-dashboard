"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { API_BASE_URL } from "./api";

interface AuthUser {
  uid: string;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionTimeoutWarning: boolean;
  isLocked: boolean;
  login: (uid: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  dismissTimeoutWarning: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function apiFetch(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {};
  if (options?.method !== "GET" && options?.method !== "DELETE") {
    headers["Content-Type"] = "application/json";
  }
  Object.assign(headers, options?.headers);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers,
    ...options,
  });
  return res;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [sessionTimeoutWarning, setSessionTimeoutWarning] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(30); // minutes
  const [autoLockTimeout, setAutoLockTimeout] = useState(15); // minutes

  const restore = useCallback(async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else if (res.status === 401) {
        // Try refresh
        const ref = await apiFetch("/api/auth/refresh", { method: "POST" });
        if (ref.ok) {
          const data = await ref.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  // Load session timeout and auto-lock settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await apiFetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data?.security?.sessionTimeout) {
            setSessionTimeout(data.security.sessionTimeout);
          }
          if (data?.security?.autoLock) {
            setAutoLockTimeout(Number(data.security.autoLock) || 15);
          }
        }
      } catch {
        // Use defaults if settings can't be loaded
      }
    };
    if (user) {
      loadSettings();
    }
  }, [user]);

  // Activity tracking
  useEffect(() => {
    if (!user || isLocked) return;

    const handleActivity = () => {
      setLastActivity(Date.now());
      setSessionTimeoutWarning(false);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, handleActivity));
    return () => events.forEach((e) => window.removeEventListener(e, handleActivity));
  }, [user, isLocked]);

  // Session timeout enforcement
  useEffect(() => {
    if (!user || sessionTimeout === 0 || isLocked) return;

    const checkTimeout = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;
      const timeoutMs = sessionTimeout * 60 * 1000;
      const warningThresholdMs = 60 * 1000; // Warn 60 seconds before timeout

      if (timeSinceActivity > timeoutMs) {
        logout();
      } else if (timeSinceActivity > timeoutMs - warningThresholdMs) {
        setSessionTimeoutWarning(true);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkTimeout);
  }, [user, lastActivity, sessionTimeout, isLocked]);

  // Auto-lock enforcement
  useEffect(() => {
    if (!user || autoLockTimeout === 0 || isLocked) return;

    const checkLock = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;
      const lockMs = autoLockTimeout * 60 * 1000;

      if (timeSinceActivity > lockMs) {
        setIsLocked(true);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkLock);
  }, [user, lastActivity, autoLockTimeout]);

  // Keep session alive every 10 minutes
  useEffect(() => {
    const iv = setInterval(() => {
      if (user && !isLocked) {
        apiFetch("/api/auth/refresh", { method: "POST" })
          .then((r) => r.ok ? r.json() : null)
          .then((data) => { if (data?.user) setUser(data.user); })
          .catch(() => {});
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [user, isLocked]);

  const login = useCallback(async (uid: string, password: string) => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ uid, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Login failed");
    }
    const data = await res.json();
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const res = await apiFetch("/api/auth/change-password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Password change failed");
    }
  }, []);

  const unlock = useCallback(async (password: string) => {
    const res = await apiFetch("/api/auth/verify-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Incorrect password");
    }
    setIsLocked(false);
    setLastActivity(Date.now());
  }, []);

  const dismissTimeoutWarning = useCallback(() => {
    setSessionTimeoutWarning(false);
    setLastActivity(Date.now());
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      sessionTimeoutWarning,
      isLocked,
      login,
      logout,
      changePassword,
      unlock,
      dismissTimeoutWarning,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
