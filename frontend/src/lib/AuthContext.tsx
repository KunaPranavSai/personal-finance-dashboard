"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { API_BASE_URL } from "./api";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

interface AuthUser {
  uid: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
}

// Purely time-based session countdown — never extended by mouse/keyboard/scroll
// activity or background API calls. Shared across tabs via localStorage so the
// timer (and a logout in one tab) stays in sync everywhere.
const SESSION_EXPIRES_KEY = "pfd-session-expires-at";
export const POST_LOGIN_REDIRECT_KEY = "pfd-post-login-redirect";
const WARNING_THRESHOLD_SECONDS = 30;
const CRITICAL_THRESHOLD_SECONDS = 15;

export type SessionState = "active" | "warning" | "critical";

interface LoginResult {
  requires2FA: boolean;
  challengeToken?: string;
  requiresPasswordChange: boolean;
  passwordChangeToken?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionState: SessionState;
  sessionSecondsRemaining: number;
  isLocked: boolean;
  twoFactorEnabled: boolean;
  sessionTimeoutMinutes: number;
  login: (uid: string, password: string) => Promise<LoginResult>;
  loginWithPasskey: () => Promise<void>;
  signup: (name: string, email: string, phone: string) => Promise<void>;
  verifyLogin2FA: (challengeToken: string, code: string) => Promise<void>;
  forceChangePassword: (passwordChangeToken: string, newPassword: string) => Promise<{ justOnboarded: boolean; user: AuthUser }>;
  logout: (opts?: { preserveRedirect?: boolean }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  extendSession: () => Promise<boolean>;
  setupTwoFactor: () => Promise<{ secret: string; qrCode: string }>;
  confirmTwoFactor: (code: string) => Promise<{ backupCodes: string[] }>;
  disableTwoFactor: (password: string, code: string) => Promise<void>;
  requestPasswordReset: (uid: string) => Promise<void>;
  confirmPasswordReset: (uid: string, code: string, newPassword: string, method?: string) => Promise<void>;
  getRecoveryOptions: (uid: string) => Promise<{ email: boolean; totp: boolean; backup: boolean }>;
  changeUid: (password: string, newUid: string) => Promise<void>;
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

function writeStoredExpiry(expiresAt: number) {
  try {
    localStorage.setItem(SESSION_EXPIRES_KEY, String(expiresAt));
  } catch {
    // ignore
  }
}

function clearStoredExpiry() {
  try {
    localStorage.removeItem(SESSION_EXPIRES_KEY);
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(30); // minutes
  const [autoLockTimeout, setAutoLockTimeout] = useState(15); // minutes
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [sessionSecondsRemaining, setSessionSecondsRemaining] = useState(Infinity);

  /**
   * Mirrors the server's absolute session deadline (embedded in the signed
   * session cookie — see backend/src/lib/sessionExpiry.ts). The client never
   * computes this value itself: doing so on every page load/PWA relaunch is
   * exactly what let sessions run forever as long as the refresh cookie
   * survived. `expiresAt` always comes from a `sessionExpiresAt` field in an
   * auth API response.
   */
  const applySessionExpiry = useCallback((expiresAt: number | undefined | null) => {
    if (!expiresAt) return;
    setSessionExpiresAt(expiresAt);
    writeStoredExpiry(expiresAt);
  }, []);

  const refreshTwoFactorStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/auth/2fa/status");
      if (res.ok) {
        const data = await res.json();
        setTwoFactorEnabled(Boolean(data.enabled));
      }
    } catch {
      // ignore
    }
  }, []);

  const restore = useCallback(async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        refreshTwoFactorStatus();
        // Always the server's real deadline for this session — never a freshly
        // computed one, so reopening the app never grants extra time.
        applySessionExpiry(data.sessionExpiresAt);
      } else if (res.status === 401) {
        // Access token expired (or missing) — try a silent refresh. The server
        // rejects this itself once the session's absolute deadline has passed,
        // even though the 7-day refresh cookie is still cryptographically valid.
        const ref = await apiFetch("/api/auth/refresh", { method: "POST" });
        if (ref.ok) {
          const data = await ref.json();
          setUser(data.user);
          refreshTwoFactorStatus();
          applySessionExpiry(data.sessionExpiresAt);
        } else {
          setUser(null);
          setSessionExpiresAt(null);
          clearStoredExpiry();
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshTwoFactorStatus, applySessionExpiry]);

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

  // Auto-lock (screen lock behind a password re-entry, separate from session
  // expiry below) is still allowed to reset on activity — it's a "step away
  // from the keyboard" convenience lock, not the security-critical session
  // timeout, and the user explicitly unlocks with their password each time.
  const lastActivityRef = useRef(Date.now());
  useEffect(() => {
    if (!user || isLocked) return;
    const handleActivity = () => { lastActivityRef.current = Date.now(); };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, handleActivity));
    return () => events.forEach((e) => window.removeEventListener(e, handleActivity));
  }, [user, isLocked]);

  useEffect(() => {
    if (!user || autoLockTimeout === 0 || isLocked) return;
    const checkLock = setInterval(() => {
      if (Date.now() - lastActivityRef.current > autoLockTimeout * 60 * 1000) {
        setIsLocked(true);
      }
    }, 10000);
    return () => clearInterval(checkLock);
  }, [user, autoLockTimeout, isLocked]);

  // Strict, elapsed-time-only session countdown. Nothing in this effect ever
  // resets sessionExpiresAt in response to activity or API calls — the only
  // ways it changes are login, an explicit "Extend Session", or expiring.
  useEffect(() => {
    if (!user || sessionExpiresAt === null) {
      setSessionSecondsRemaining(Infinity);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.round((sessionExpiresAt - Date.now()) / 1000));
      setSessionSecondsRemaining(remaining);
      if (remaining <= 0) {
        void handleSessionExpired();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sessionExpiresAt]);

  // Cross-tab sync: another tab extending the session (or logging out)
  // updates localStorage, which fires 'storage' here in every OTHER tab.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== SESSION_EXPIRES_KEY) return;
      if (e.newValue === null) {
        // Another tab logged out (or expired) — follow immediately, no re-request.
        setUser(null);
        setSessionExpiresAt(null);
      } else {
        const next = Number(e.newValue);
        if (Number.isFinite(next)) setSessionExpiresAt(next);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const login = useCallback(async (uid: string, password: string): Promise<LoginResult> => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ uid, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Login failed");
    }
    const data = await res.json();
    if (data.requiresPasswordChange) {
      return { requires2FA: false, requiresPasswordChange: true, passwordChangeToken: data.passwordChangeToken };
    }
    if (data.requires2FA) {
      return { requires2FA: true, requiresPasswordChange: false, challengeToken: data.challengeToken };
    }
    setUser(data.user);
    refreshTwoFactorStatus();
    applySessionExpiry(data.sessionExpiresAt); // session timer starts immediately on login
    return { requires2FA: false, requiresPasswordChange: false };
  }, [refreshTwoFactorStatus, applySessionExpiry]);

  /**
   * Usernameless passkey sign-in: fetches a challenge, prompts the platform
   * authenticator (Windows Hello/Touch ID/Face ID/security key), then hands
   * the signed assertion back to the server. No uid or password involved.
   */
  const loginWithPasskey = useCallback(async () => {
    const optionsRes = await apiFetch("/api/auth/passkey/login/options", { method: "POST" });
    if (!optionsRes.ok) {
      throw new Error("Could not start passkey sign-in");
    }
    const { options, challengeToken } = (await optionsRes.json()) as {
      options: PublicKeyCredentialRequestOptionsJSON;
      challengeToken: string;
    };
    const response = await startAuthentication({ optionsJSON: options });
    const verifyRes = await apiFetch("/api/auth/passkey/login/verify", {
      method: "POST",
      body: JSON.stringify({ response, challengeToken }),
    });
    if (!verifyRes.ok) {
      const data = await verifyRes.json().catch(() => ({}));
      throw new Error(data.error || "Passkey sign-in failed");
    }
    const data = await verifyRes.json();
    setUser(data.user);
    refreshTwoFactorStatus();
    applySessionExpiry(data.sessionExpiresAt);
  }, [refreshTwoFactorStatus, applySessionExpiry]);

  const signup = useCallback(async (name: string, email: string, phone: string) => {
    const res = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, phone }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Signup failed");
    }
  }, []);

  const forceChangePassword = useCallback(async (passwordChangeToken: string, newPassword: string) => {
    const res = await apiFetch("/api/auth/force-change-password", {
      method: "POST",
      body: JSON.stringify({ passwordChangeToken, newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to set new password");
    }
    const data = await res.json();
    setUser(data.user);
    refreshTwoFactorStatus();
    applySessionExpiry(data.sessionExpiresAt);
    return { justOnboarded: Boolean(data.justOnboarded), user: data.user as AuthUser };
  }, [refreshTwoFactorStatus, applySessionExpiry]);

  const verifyLogin2FA = useCallback(async (challengeToken: string, code: string) => {
    const res = await apiFetch("/api/auth/2fa/login-verify", {
      method: "POST",
      body: JSON.stringify({ challengeToken, code }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Verification failed");
    }
    const data = await res.json();
    setUser(data.user);
    setTwoFactorEnabled(true);
    applySessionExpiry(data.sessionExpiresAt);
  }, [applySessionExpiry]);

  const logout = useCallback(async (opts?: { preserveRedirect?: boolean }) => {
    if (opts?.preserveRedirect && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, window.location.pathname + window.location.search);
      } catch {
        // ignore
      }
    }
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setSessionExpiresAt(null);
    clearStoredExpiry(); // fires 'storage' in every other tab, logging them out too
  }, []);

  /** Called only when the countdown itself hits zero — never by activity or a background call. */
  const handleSessionExpired = useCallback(async () => {
    await logout({ preserveRedirect: true });
  }, [logout]);

  /**
   * The only way (besides login) the countdown is ever reset. Requires a
   * real, server-validated refresh — the `extend: true` flag tells the
   * server to recompute a fresh deadline (still clamped to the next IST
   * midnight) instead of its default behavior of carrying the old one
   * forward unchanged.
   */
  const extendSession = useCallback(async (): Promise<boolean> => {
    const res = await apiFetch("/api/auth/refresh", { method: "POST", body: JSON.stringify({ extend: true }) });
    if (!res.ok) {
      await handleSessionExpired();
      return false;
    }
    const data = await res.json().catch(() => null);
    if (data?.user) setUser(data.user);
    applySessionExpiry(data?.sessionExpiresAt);
    return true;
  }, [handleSessionExpired, applySessionExpiry]);

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
    lastActivityRef.current = Date.now();
  }, []);

  const setupTwoFactor = useCallback(async () => {
    const res = await apiFetch("/api/auth/2fa/setup", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to start 2FA setup");
    }
    return res.json();
  }, []);

  const confirmTwoFactor = useCallback(async (code: string) => {
    const res = await apiFetch("/api/auth/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Invalid verification code");
    }
    const data = await res.json();
    setTwoFactorEnabled(true);
    return { backupCodes: data.backupCodes as string[] };
  }, []);

  const disableTwoFactor = useCallback(async (password: string, code: string) => {
    const res = await apiFetch("/api/auth/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ password, code }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to disable 2FA");
    }
    setTwoFactorEnabled(false);
  }, []);

  const requestPasswordReset = useCallback(async (uid: string) => {
    const res = await apiFetch("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ uid }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to request password reset");
    }
  }, []);

  const confirmPasswordReset = useCallback(async (uid: string, code: string, newPassword: string, method?: string) => {
    const res = await apiFetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ uid, code, newPassword, method }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to reset password");
    }
  }, []);

  const getRecoveryOptions = useCallback(async (uid: string) => {
    const res = await apiFetch("/api/auth/recovery-options", {
      method: "POST",
      body: JSON.stringify({ uid }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to load recovery options");
    }
    return res.json();
  }, []);

  const changeUid = useCallback(async (password: string, newUid: string) => {
    const res = await apiFetch("/api/auth/change-uid", {
      method: "POST",
      body: JSON.stringify({ password, newUid }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to change UID");
    }
    const data = await res.json();
    setUser((u) => (u ? { ...u, uid: data.uid } : u));
  }, []);

  const sessionState: SessionState =
    sessionSecondsRemaining <= CRITICAL_THRESHOLD_SECONDS
      ? "critical"
      : sessionSecondsRemaining <= WARNING_THRESHOLD_SECONDS
      ? "warning"
      : "active";

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      sessionState,
      sessionSecondsRemaining,
      isLocked,
      twoFactorEnabled,
      sessionTimeoutMinutes: sessionTimeout,
      login,
      loginWithPasskey,
      signup,
      verifyLogin2FA,
      forceChangePassword,
      logout,
      changePassword,
      unlock,
      extendSession,
      setupTwoFactor,
      confirmTwoFactor,
      disableTwoFactor,
      requestPasswordReset,
      confirmPasswordReset,
      getRecoveryOptions,
      changeUid,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
