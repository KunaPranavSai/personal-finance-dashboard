const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Dispatched whenever a sensitive action is blocked pending fresh TOTP re-verification. */
export const TWO_FA_REVERIFY_EVENT = "pfd:2fa-reverify-required";

class ApiClientError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
