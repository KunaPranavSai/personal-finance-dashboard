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
  login: (uid: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return res;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  // Keep session alive every 10 minutes
  useEffect(() => {
    const iv = setInterval(() => {
      if (user) {
        apiFetch("/api/auth/refresh", { method: "POST" })
          .then((r) => r.ok ? r.json() : null)
          .then((data) => { if (data?.user) setUser(data.user); })
          .catch(() => {});
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [user]);

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

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}
