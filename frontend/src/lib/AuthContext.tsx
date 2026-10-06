"use client";

import { markLoggedInToday, setRememberSession, isRememberSession } from "@/lib/pinDay";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { API_BASE_URL, ApiClientError } from "./api";
import { toUserMessage } from "./errorMessage";
import { clearClientSensitiveStorage } from "./clientDataCleanup";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

interface AuthUser {
  uid: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  /** Progressive sign-up: false = explorer (email provided, not yet verified). Absent for admins. */
  emailVerified?: boolean;
  profileCompleted?: boolean;
  /** A Super Admin has placed this account under supervision; the API refuses everything but sign-in. */
  supervised?: boolean;
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
  /** Only meaningful when both of the above are false (login actually
   * completed) — whether the backend's existing lastLoginAt field was still
   * null before this login, i.e. a genuine first successful login. */
  isFirstLogin?: boolean;
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
  impersonating: { adminName: string; targetUser: { id: string; name: string; email: string } } | null;
  exitImpersonation: () => Promise<void>;
  twoFactorEnabled: boolean;
  sessionTimeoutMinutes: number;
  login: (email: string, password: string, portal?: "admin", rememberMe?: boolean) => Promise<LoginResult>;
  loginWithPin: (pin: string, identifier?: string, portal?: "admin") => Promise<LoginResult>;
  /** Get Started: new email -> explorer session ("explore"); known verified email -> a sign-in code was emailed ("code"). */
  startWithEmail: (email: string) => Promise<"explore" | "code">;
  loginWithCode: (email: string, code: string, rememberMe?: boolean) => Promise<LoginResult>;
  sendEmailCode: () => Promise<void>;
  verifyEmailCode: (code: string) => Promise<void>;
  completeProfile: (data: { name: string; phone: string; pin: string; termsAccepted: boolean; privacyAccepted: boolean; signedName: string }) => Promise<void>;
  loginWithPasskey: () => Promise<{ isFirstLogin: boolean }>;
  signup: (input: SignupInput) => Promise<SignupResult>;
  verifyLogin2FA: (challengeToken: string, code: string) => Promise<{ isFirstLogin: boolean }>;
  forceChangePassword: (passwordChangeToken: string, newPassword: string) => Promise<{ justOnboarded: boolean; user: AuthUser; isFirstLogin: boolean }>;
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

// Status and wait time of the most recent response, so a thrown error keeps them (pages branch on code/status, not English).
let lastMeta: { status: number; retryAfter?: number } = { status: 0 };

/** Builds the error every sign-in method throws: friendly text, plus status/code/retry-after for the page to act on. */
function authError(data: { error?: string; code?: string; [k: string]: unknown } | null | undefined, fallback: string): ApiClientError {
  const body = { ...(data ?? {}), ...(lastMeta.retryAfter ? { retryAfterSeconds: lastMeta.retryAfter } : {}) };
  const e = new ApiClientError(lastMeta.status, (data?.error as string) || fallback, body);
  e.message = toUserMessage(e, fallback);
  return e;
}

async function apiFetch(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {};
  if (options?.method !== "GET" && options?.method !== "DELETE") {
    headers["Content-Type"] = "application/json";
  }
  Object.assign(headers, options?.headers);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers,
      signal: controller.signal,
      ...options,
    });
  } catch {
    // Never let the browser's raw "Failed to fetch" reach a sign-in screen.
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    throw new ApiClientError(0, controller.signal.aborted
      ? "That took too long to respond. Check your connection and try again."
      : offline ? "You're offline. Check your connection and try again." : "Couldn't reach the server. Check your connection and try again.",
      { code: controller.signal.aborted ? "NETWORK_TIMEOUT" : offline ? "NETWORK_OFFLINE" : "NETWORK_UNREACHABLE" });
  } finally {
    clearTimeout(timer);
  }
  const retry = Number(res.headers.get("Retry-After"));
  lastMeta = { status: res.status, retryAfter: Number.isFinite(retry) && retry > 0 ? retry : undefined };
  return res;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [impersonating, setImpersonating] = useState<{ adminName: string; targetUser: { id: string; name: string; email: string } } | null>(null);
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
        setImpersonating(data.impersonating ?? null);
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

  const login = useCallback(async (email: string, password: string, portal?: "admin", rememberMe = false): Promise<LoginResult> => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, portal, rememberMe }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw authError(data, "We couldn't sign you in. Check your details and try again.");
    }
    const data = await res.json();
    if (data.requiresPasswordChange) {
      return { requires2FA: false, requiresPasswordChange: true, passwordChangeToken: data.passwordChangeToken };
    }
    if (data.requires2FA) {
      setRememberSession(rememberMe);
      return { requires2FA: true, requiresPasswordChange: false, challengeToken: data.challengeToken };
    }
    setUser(data.user);
    markLoggedInToday(data.user.uid);
    setRememberSession(rememberMe);
    markRecentLogin();
    refreshTwoFactorStatus();
    return { requires2FA: false, requiresPasswordChange: false, isFirstLogin: Boolean(data.isFirstLogin) };
  }, [refreshTwoFactorStatus]);

  const startWithEmail = useCallback(async (email: string): Promise<"explore" | "code"> => {
    const res = await apiFetch("/api/auth/start", { method: "POST", body: JSON.stringify({ email }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw authError(data, "Could not get started");
    if (data.mode === "code") return "code";
    if (data.user) {
      setUser(data.user);
      markLoggedInToday(data.user.uid);
      setRememberSession(false);
      markRecentLogin();
      return "explore";
    }
    throw new Error("Could not get started");
  }, []);

  const loginWithCode = useCallback(async (email: string, code: string, rememberMe = false): Promise<LoginResult> => {
    const res = await apiFetch("/api/auth/code/login", { method: "POST", body: JSON.stringify({ email, code, rememberMe }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw authError(data, "That code isn't right or has expired. Check it or request a new one.");
    if (data.requires2FA) {
      setRememberSession(rememberMe);
      return { requires2FA: true, requiresPasswordChange: false, challengeToken: data.challengeToken };
    }
    setUser(data.user);
    markLoggedInToday(data.user.uid);
    setRememberSession(rememberMe);
    markRecentLogin();
    refreshTwoFactorStatus();
    return { requires2FA: false, requiresPasswordChange: false, isFirstLogin: Boolean(data.isFirstLogin) };
  }, [refreshTwoFactorStatus]);

  const sendEmailCode = useCallback(async () => {
    const res = await apiFetch("/api/auth/email/send-code", { method: "POST" });
    if (!res.ok) throw authError(await res.json().catch(() => ({})), "Could not send the code. Check your connection and try again.");
  }, []);

  const verifyEmailCode = useCallback(async (code: string) => {
    const res = await apiFetch("/api/auth/email/verify", { method: "POST", body: JSON.stringify({ code }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw authError(data, "That code isn't right or has expired. Check it or request a new one.");
    setUser(data.user);
    markLoggedInToday(data.user.uid);
    markRecentLogin();
  }, []);

  const completeProfile = useCallback(async (payload: { name: string; phone: string; pin: string; termsAccepted: boolean; privacyAccepted: boolean; signedName: string }) => {
    const res = await apiFetch("/api/auth/profile/complete", { method: "POST", body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw authError(data, "Could not save your profile");
    setUser(data.user);
  }, []);

  /** PIN sign-in for an account this device remembers (server reads the pin_device cookie). */
  const loginWithPin = useCallback(async (pin: string, identifier?: string, portal?: "admin"): Promise<LoginResult> => {
    const res = await apiFetch("/api/auth/pin/login", { method: "POST", body: JSON.stringify({ pin, identifier, portal, rememberMe: isRememberSession() }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw authError(data, "We couldn't sign you in. Check your details and try again.");
    }
    const data = await res.json();
    if (data.requiresPasswordChange) return { requires2FA: false, requiresPasswordChange: true, passwordChangeToken: data.passwordChangeToken };
    if (data.requires2FA) return { requires2FA: true, requiresPasswordChange: false, challengeToken: data.challengeToken };
    setUser(data.user);
    markLoggedInToday(data.user.uid);
    markRecentLogin();
    refreshTwoFactorStatus();
    return { requires2FA: false, requiresPasswordChange: false, isFirstLogin: Boolean(data.isFirstLogin) };
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
    // /admin-login has no passkey UI (only the regular /login page offers biometric sign-in), so
    // this always represents a normal-user-portal attempt — send the same portal marker
    // password login uses, so an ADMIN/SUPER_ADMIN account's passkey can't slip through here.
    const verifyRes = await apiFetch("/api/auth/passkey/login/verify", {
      method: "POST",
      body: JSON.stringify({ response, challengeToken, portal: "user" }),
    });
    if (!verifyRes.ok) {
      const data = await verifyRes.json().catch(() => ({}));
      throw authError(data, "Passkey sign-in didn't work. Try again or use your password.");
    }
    const data = await verifyRes.json();
    setUser(data.user);
    markLoggedInToday(data.user.uid);
    markRecentLogin();
    refreshTwoFactorStatus();
    return { isFirstLogin: Boolean(data.isFirstLogin) };
  }, [refreshTwoFactorStatus]);

  const signup = useCallback(async (input: SignupInput): Promise<SignupResult> => {
    const res = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw authError(data, "We couldn't create your account. Try again.");
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
      throw authError(data, "We couldn't set your new password. Try again.");
    }
    const data = await res.json();
    setUser(data.user);
    markLoggedInToday(data.user.uid);
    markRecentLogin();
    refreshTwoFactorStatus();
    return { justOnboarded: Boolean(data.justOnboarded), user: data.user as AuthUser, isFirstLogin: Boolean(data.isFirstLogin) };
  }, [refreshTwoFactorStatus]);

  const verifyLogin2FA = useCallback(async (challengeToken: string, code: string) => {
    const res = await apiFetch("/api/auth/2fa/login-verify", {
      method: "POST",
      body: JSON.stringify({ challengeToken, code }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw authError(data, "That code didn't work. Check it and try again.");
    }
    const data = await res.json();
    setUser(data.user);
    markLoggedInToday(data.user.uid);
    markRecentLogin();
    setTwoFactorEnabled(true);
    return { isFirstLogin: Boolean(data.isFirstLogin) };
  }, []);

  const logout = useCallback(async (opts?: { preserveRedirect?: boolean }) => {
    try { sessionStorage.removeItem("pp_pin_reminder"); } catch { /* ignore */ }
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
      throw authError(data, "We couldn't change your password. Check your current password.");
    }
  }, []);

  const setupTwoFactor = useCallback(async () => {
    const res = await apiFetch("/api/auth/2fa/setup", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw authError(data, "We couldn't start two-factor setup. Try again.");
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
      throw authError(data, "That code isn't right. Check your authenticator app and try again.");
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
      throw authError(data, "We couldn't turn off two-factor sign-in. Check your password and code.");
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
      throw authError(data, "We couldn't start the recovery. Check your details and try again.");
    }
  }, []);

  const selectRecoveryMethod = useCallback(async (method: RecoveryMethod): Promise<SelectRecoveryMethodResult> => {
    const res = await apiFetch("/api/auth/recovery/select-method", {
      method: "POST",
      body: JSON.stringify({ method }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw authError(data, "That recovery method isn't available right now.");
    }
    return { method: data.method, questions: data.questions };
  }, []);

  const resendRecoveryOtp = useCallback(async (): Promise<void> => {
    const res = await apiFetch("/api/auth/recovery/resend-otp", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw authError(data, "We couldn't send a new code. Wait a moment and try again.");
    }
  }, []);

  const verifyRecoveryOtp = useCallback(async (code: string): Promise<void> => {
    const res = await apiFetch("/api/auth/recovery/verify-otp", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw authError(data, "That code isn't right or has expired. Request a new one.");
    }
  }, []);

  const verifyRecoveryTotp = useCallback(async (code: string): Promise<void> => {
    const res = await apiFetch("/api/auth/recovery/verify-totp", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw authError(data, "That code isn't right. Check your authenticator app and try again.");
    }
  }, []);

  const verifyRecoverySecurityAnswers = useCallback(async (answer1: string, answer2: string): Promise<void> => {
    const res = await apiFetch("/api/auth/recovery/verify-security-answers", {
      method: "POST",
      body: JSON.stringify({ answer1, answer2 }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw authError(data, "Incorrect answers");
    }
  }, []);

  const completePasswordReset = useCallback(async (newPassword: string): Promise<void> => {
    const res = await apiFetch("/api/auth/recovery/reset-password", {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw authError(data, "Failed to reset password");
    }
  }, []);

  const changeUid = useCallback(async (password: string, newUid: string) => {
    const res = await apiFetch("/api/auth/change-uid", {
      method: "POST",
      body: JSON.stringify({ password, newUid }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw authError(data, "Failed to change UID");
    }
    const data = await res.json();
    setUser((u) => (u ? { ...u, uid: data.uid } : u));
  }, []);

  const updateUserName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setUser((u) => (u ? { ...u, name: trimmed } : u));
  }, []);

  const exitImpersonation = useCallback(async () => {
    await apiFetch("/api/auth/access/exit", { method: "POST" });
    setImpersonating(null);
    window.location.href = "/admin";
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      impersonating,
      exitImpersonation,
      twoFactorEnabled,
      sessionTimeoutMinutes: sessionTimeout,
      login,
      loginWithPin,
      startWithEmail,
      loginWithCode,
      sendEmailCode,
      verifyEmailCode,
      completeProfile,
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
