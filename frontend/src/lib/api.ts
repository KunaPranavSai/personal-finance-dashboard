const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Dispatched whenever a sensitive action is blocked pending fresh TOTP re-verification. */
export const TWO_FA_REVERIFY_EVENT = "pfd:2fa-reverify-required";
/** Dispatched after any successful authenticated request — SessionManager
 * treats this as user activity, resetting the client-side inactivity timer. */
export const API_ACTIVITY_EVENT = "pfd:api-activity";
/** Dispatched when a request 401s and a silent token refresh also fails —
 * i.e. the server-side inactivity window has genuinely lapsed. */
export const SESSION_EXPIRED_EVENT = "pfd:session-expired";
/** Dispatched whenever the backend reports Google Drive isn't connected/initialized
 * (or a reauth is needed) — lets the app redirect to /connect-drive immediately, even
 * mid-session (e.g. the connection was revoked in Google, or disconnected in another tab). */
export const DRIVE_DISCONNECTED_EVENT = "pfd:drive-disconnected";

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

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch {
    // fetch() itself throwing (not an HTTP error status) means the request
    // never reached the server at all — offline, DNS failure, connection
    // refused, etc. Previously this propagated as a raw, unclassified
    // TypeError; normalizing it here (status 0, Master Plan §16's NETWORK_*
    // codes) is what lets DriveStorageProvider's existing status===0 →
    // "unknown outcome" handling ever actually trigger.
    const online = typeof navigator === "undefined" || navigator.onLine;
    const code = online ? "NETWORK_TIMEOUT" : "NETWORK_OFFLINE";
    const message = online
      ? "Couldn't reach the server. Please try again."
      : "You're currently offline. Check your connection and try again.";
    throw new ApiClientError(0, message, { code });
  }

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
    const code = (body as { code?: string })?.code;
    if (code === "DRIVE_NOT_CONNECTED" || code === "DRIVE_REAUTH_REQUIRED" || code === "DRIVE_NOT_INITIALIZED") {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(DRIVE_DISCONNECTED_EVENT));
      }
    }
    // A gateway-level 502/503/504 with no JSON body at all (infra-level, never
    // reached our own error handler) still deserves a stable code rather than
    // a raw "Request failed with status 503".
    if (!code && res.status >= 502 && res.status <= 504) {
      throw new ApiClientError(res.status, "The server is temporarily unavailable. Please try again shortly.", { code: "SERVER_UNAVAILABLE" });
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
  /** `idempotencyKey`, when supplied, is sent as the `Idempotency-Key` header
   * (never in the URL/body) so a retried create of the same logical
   * operation is recognized by the backend instead of creating a duplicate
   * record. Callers are responsible for reusing the same key across retries
   * of one attempt and generating a fresh one for a genuinely new attempt —
   * see `lib/idempotencyKey.ts`. */
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      ...(idempotencyKey && { headers: { "Idempotency-Key": idempotencyKey } }),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "DELETE", body: body ? JSON.stringify(body) : undefined }),
};

export { ApiClientError, API_BASE_URL };
