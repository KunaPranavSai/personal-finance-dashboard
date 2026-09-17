"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { API_BASE_URL } from "./api";
import { clearClientSensitiveStorage } from "./clientDataCleanup";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

interface AuthUser {
  uid: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
}

export const POST_LOGIN_REDIRECT_KEY = "pfd-post-login-redirect";
/** Set by SessionManager right before a forced logout so the login page can
 * show "Your session expired due to inactivity." after the redirect. */
export const SESSION_EXPIRED_REASON_KEY = "pfd-session-expired-reason";
/** Set the instant a login/2FA/passkey/force-change action successfully
 * establishes a session (server returned the user object), cleared the
 * instant that session is independently confirmed by restore()'s own
 * `/api/auth/me` check. If (app)/layout.tsx's auth guard ever finds
 * `!isAuthenticated` while this is still set, it means the browser
 * accepted a login moments ago but didn't actually keep the session alive
 * (most commonly a cookie the browser silently refused to persist/attach —
 * e.g. cross-site cookie restrictions) — a materially different, and more
 * actionable, situation than "never signed in" or "timed out from
 * inactivity." Never used to change any auth/cookie behavior, only to pick
 * an honest message instead of a silent or misleading one. */
export const RECENT_LOGIN_MARKER_KEY = "pfd-recent-login";
const RECENT_LOGIN_WINDOW_MS = 60 * 1000;

function markRecentLogin(): void {
  try {
    sessionStorage.setItem(RECENT_LOGIN_MARKER_KEY, String(Date.now()));
  } catch {
    // ignore — private browsing etc.; worst case this diagnostic signal is unavailable
  }
}

function clearRecentLoginMarker(): void {
  try {
    sessionStorage.removeItem(RECENT_LOGIN_MARKER_KEY);
  } catch {
    // ignore
  }
}

/** True if a login/2FA/passkey/force-change action succeeded within the
 * last minute in this tab but hasn't yet been confirmed durable. */
export function hasUnconfirmedRecentLogin(): boolean {
  try {
    const raw = sessionStorage.getItem(RECENT_LOGIN_MARKER_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < RECENT_LOGIN_WINDOW_MS;
  } catch {
    return false;
  }
}

interface LoginResult {
  requires2FA: boolean;
  challengeToken?: string;
  requiresPasswordChange: boolean;
  passwordChangeToken?: string;
}

export type RecoveryMethod = "email_otp" | "totp" | "security_questions";

export interface RecoverySecurityQuestion {
  key: string;
  text: string;
}

export interface SelectRecoveryMethodResult {
  method: RecoveryMethod;
  /** Only present when method === "security_questions". */
  questions?: RecoverySecurityQuestion[];
}

export interface SignupInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  signedName: string;
}

export interface SignupResult {
  consent: { signedName: string; termsVersion: string; privacyVersion: string; acceptedAt: string };
  /** base64-encoded PDF, or null if generation failed — account creation still succeeded either way. */
  consentPdfBase64: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  twoFactorEnabled: boolean;
  sessionTimeoutMinutes: number;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithPasskey: () => Promise<void>;
  signup: (input: SignupInput) => Promise<SignupResult>;
  verifyLogin2FA: (challengeToken: string, code: string) => Promise<void>;
  forceChangePassword: (passwordChangeToken: string, newPassword: string) => Promise<{ justOnboarded: boolean; user: AuthUser }>;
  logout: (opts?: { preserveRedirect?: boolean }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  extendSession: () => Promise<boolean>;
  setupTwoFactor: () => Promise<{ secret: string; qrCode: string }>;
  confirmTwoFactor: (code: string) => Promise<{ backupCodes: string[] }>;
  disableTwoFactor: (password: string, code: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  selectRecoveryMethod: (method: RecoveryMethod) => Promise<SelectRecoveryMethodResult>;
  resendRecoveryOtp: () => Promise<void>;
  verifyRecoveryOtp: (code: string) => Promise<void>;
  verifyRecoveryTotp: (code: string) => Promise<void>;
  verifyRecoverySecurityAnswers: (answer1: string, answer2: string) => Promise<void>;
  completePasswordReset: (newPassword: string) => Promise<void>;
  changeUid: (password: string, newUid: string) => Promise<void>;
  /** Locally patches the signed-in user's display name — call this right
   * after a profile save succeeds so greetings/the topbar/etc. (which all
   * read `user.name` from this context) update immediately instead of only
   * on the next login/page load. No network request; the account record
   * itself is already updated server-side by the profile save. */
  updateUserName: (name: string) => void;
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
  const [sessionTimeout, setSessionTimeout] = useState(30); // minutes; server-enforced session window, surfaced for display only
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

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
        clearRecentLoginMarker(); // session independently confirmed durable
        refreshTwoFactorStatus();
      } else if (res.status === 401) {
        // Access token expired (or missing) — try a silent refresh. The server
        // rejects this itself once the session's inactivity deadline has
        // lapsed, even though the 7-day refresh cookie is still valid.
        const ref = await apiFetch("/api/auth/refresh", { method: "POST" });
        if (ref.ok) {
          const data = await ref.json();
          setUser(data.user);
          clearRecentLoginMarker();
          refreshTwoFactorStatus();
        } else {
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshTwoFactorStatus]);

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
          if (typeof data?.security?.sessionTimeout === "number") {
            setSessionTimeout(data.security.sessionTimeout);
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

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
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
    markRecentLogin();
    refreshTwoFactorStatus();
    return { requires2FA: false, requiresPasswordChange: false };
  }, [refreshTwoFactorStatus]);

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
    markRecentLogin();
    refreshTwoFactorStatus();
  }, [refreshTwoFactorStatus]);

  const signup = useCallback(async (input: SignupInput): Promise<SignupResult> => {
    const res = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Signup failed");
    }
    return { consent: data.consent, consentPdfBase64: data.consentPdfBase64 ?? null };
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
    markRecentLogin();
    refreshTwoFactorStatus();
    return { justOnboarded: Boolean(data.justOnboarded), user: data.user as AuthUser };
  }, [refreshTwoFactorStatus]);

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
    markRecentLogin();
    setTwoFactorEnabled(true);
  }, []);

  const logout = useCallback(async (opts?: { preserveRedirect?: boolean }) => {
    const redirectTarget = typeof window !== "undefined" ? window.location.pathname + window.location.search : null;
    // Never let client-storage cleanup race or block the logout request
    // itself — the server-side session invalidation (cookie clear + session
    // version bump) always completes first.
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    await clearClientSensitiveStorage();
    if (opts?.preserveRedirect && redirectTarget) {
      try {
        sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, redirectTarget);
      } catch {
        // ignore
      }
    }
  }, []);

  /**
   * Called by SessionManager's "Stay Logged In" action. This is itself an
   * authenticated request, so the server-side inactivity middleware already
   * slides the deadline forward on success — this just also refreshes the
   * user object and surfaces failure (e.g. the inactivity window had already
   * lapsed server-side) back to the caller.
   */
  const extendSession = useCallback(async (): Promise<boolean> => {
    const res = await apiFetch("/api/auth/refresh", { method: "POST" });
    if (!res.ok) {
      setUser(null);
      return false;
    }
    const data = await res.json().catch(() => null);
    if (data?.user) setUser(data.user);
    return true;
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

  // Account recovery v3 — choice-based, cookie-bound recovery session. The
  // recovery credential is a Secure+HttpOnly+signed cookie the browser
  // attaches automatically (via credentials:"include" in apiFetch); it is
  // never present in any request body, response body, or client-readable
  // storage, and no function here ever handles a token value directly.
  const requestPasswordReset = useCallback(async (email: string): Promise<void> => {
    const res = await apiFetch("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to request password reset");
    }
  }, []);

  const selectRecoveryMethod = useCallback(async (method: RecoveryMethod): Promise<SelectRecoveryMethodResult> => {
    const res = await apiFetch("/api/auth/recovery/select-method", {
      method: "POST",
      body: JSON.stringify({ method }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "That recovery method isn't available right now.");
    }
    return { method: data.method, questions: data.questions };
  }, []);

  const resendRecoveryOtp = useCallback(async (): Promise<void> => {
    const res = await apiFetch("/api/auth/recovery/resend-otp", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to resend code");
    }
  }, []);

  const verifyRecoveryOtp = useCallback(async (code: string): Promise<void> => {
    const res = await apiFetch("/api/auth/recovery/verify-otp", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Invalid or expired code");
    }
  }, []);

  const verifyRecoveryTotp = useCallback(async (code: string): Promise<void> => {
    const res = await apiFetch("/api/auth/recovery/verify-totp", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Invalid verification code");
    }
  }, []);

  const verifyRecoverySecurityAnswers = useCallback(async (answer1: string, answer2: string): Promise<void> => {
    const res = await apiFetch("/api/auth/recovery/verify-security-answers", {
      method: "POST",
      body: JSON.stringify({ answer1, answer2 }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Incorrect answers");
    }
  }, []);

  const completePasswordReset = useCallback(async (newPassword: string): Promise<void> => {
    const res = await apiFetch("/api/auth/recovery/reset-password", {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to reset password");
    }
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

  const updateUserName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setUser((u) => (u ? { ...u, name: trimmed } : u));
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      twoFactorEnabled,
      sessionTimeoutMinutes: sessionTimeout,
      login,
      loginWithPasskey,
      signup,
      verifyLogin2FA,
      forceChangePassword,
      logout,
      changePassword,
      extendSession,
      setupTwoFactor,
      confirmTwoFactor,
      disableTwoFactor,
      requestPasswordReset,
      selectRecoveryMethod,
      resendRecoveryOtp,
      verifyRecoveryOtp,
      verifyRecoveryTotp,
      verifyRecoverySecurityAnswers,
      completePasswordReset,
      changeUid,
      updateUserName,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
