const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Dispatched whenever a sensitive action is blocked pending fresh TOTP re-verification. */
export const TWO_FA_REVERIFY_EVENT = "pfd:2fa-reverify-required";
/** Dispatched after any successful authenticated request — SessionManager
 * treats this as user activity, resetting the client-side inactivity timer. */
export const API_ACTIVITY_EVENT = "pfd:api-activity";
/** Dispatched when a request 401s and a silent token refresh also fails —
 * i.e. the server-side inactivity window has genuinely lapsed. */
export const SESSION_EXPIRED_EVENT = "pfd:session-expired";

class ApiClientError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/** Silent token refresh, shared across concurrent 401s so a burst of requests
 * only triggers one /api/auth/refresh call. Itself authenticated activity, so
 * on success the server has already slid the inactivity deadline forward. */
function silentRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/api/auth/refresh`, { method: "POST", credentials: "include" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.method !== "GET" && options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  Object.assign(headers, options.headers);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    // A 401 on an ordinary API call (as opposed to /api/auth/*) might just
    // mean the short-lived access token expired while the session itself is
    // still within its inactivity window — try one silent refresh before
    // giving up, so activity never gets interrupted by a stale access token.
    if (res.status === 401 && !isRetry && !path.startsWith("/api/auth/")) {
      const refreshed = await silentRefresh();
      if (refreshed) return request<T>(path, options, true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    const message =
      (body as { error?: string })?.error ?? `Request failed with status ${res.status}`;
    if (res.status === 403 && (body as { code?: string })?.code === "2FA_REVERIFICATION_REQUIRED") {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(TWO_FA_REVERIFY_EVENT));
      }
    }
    throw new ApiClientError(res.status, message, body);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(API_ACTIVITY_EVENT));
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "DELETE", body: body ? JSON.stringify(body) : undefined }),
};

export { ApiClientError, API_BASE_URL };
