// One place that turns any thrown error into words a person can act on, and into per-field messages for inline display.
// Servers already send plain-language text (see backend errorHandler); this adds the pieces only the client can know:
// network state, how long to wait, the support reference, and a safe fallback when a proxy returns something unreadable.
import { ApiClientError } from "./api";

interface Body { error?: string; code?: string; reference?: string; retryAfterSeconds?: number; details?: { fieldErrors?: Record<string, string[]> } }

const bodyOf = (err: unknown): Body => (err instanceof ApiClientError && err.details && typeof err.details === "object" ? (err.details as Body) : {});

const BY_STATUS: Record<number, string> = {
  400: "Something in that request isn't right. Check what you entered and try again.",
  401: "Your session has ended. Please sign in again.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: "That conflicts with something that already exists.",
  413: "That is too large to send. Try a smaller file or less data.",
  423: "This account is temporarily locked. Try again later.",
  429: "You're going a bit fast. Please wait a moment and try again.",
  500: "Something went wrong on our side. Please try again.",
  502: "The server is temporarily unavailable. Please try again shortly.",
  503: "The server is temporarily unavailable. Please try again shortly.",
  504: "The server took too long to respond. Please try again.",
};

// Server wording that is technical or empty; replaced by the status text above.
const TECHNICAL = /^(request failed with status|validation failed|route not found|failed to fetch|load failed|networkerror|internal server error|bad request|unauthorized|forbidden|not found)/i;

export function retryAfterOf(err: unknown): number | undefined {
  const n = bodyOf(err).retryAfterSeconds;
  return typeof n === "number" && n > 0 ? n : undefined;
}

/** "in 45 seconds", "in 5 minutes", "in 2 hours" */
export function waitPhrase(seconds: number): string {
  if (seconds < 90) return `in ${Math.max(1, Math.round(seconds))} seconds`;
  if (seconds < 5400) return `in ${Math.round(seconds / 60)} minutes`;
  return `in ${Math.round(seconds / 3600)} hours`;
}

export function toUserMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiClientError) {
    const b = bodyOf(err);
    let msg = b.error && !TECHNICAL.test(b.error) ? b.error : err.message && !TECHNICAL.test(err.message) ? err.message : BY_STATUS[err.status] ?? fallback;
    const wait = retryAfterOf(err);
    if ((err.status === 429 || err.status === 423) && wait && !/minute|second|hour/i.test(msg)) msg = `${msg.replace(/[.\s]+$/, "")}. Try again ${waitPhrase(wait)}.`;
    if (err.status >= 500 && b.reference && !msg.includes(b.reference)) msg = `${msg} (Ref: ${b.reference})`;
    return msg;
  }
  if (err instanceof TypeError || (err instanceof Error && TECHNICAL.test(err.message))) {
    return typeof navigator !== "undefined" && !navigator.onLine
      ? "You're offline. Check your connection and try again."
      : "Couldn't reach the server. Check your connection and try again.";
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** { fieldName: first message } from a server validation error, or {} when it carries none. */
export function fieldErrorsOf(err: unknown): Record<string, string> {
  const fe = bodyOf(err).details?.fieldErrors;
  const out: Record<string, string> = {};
  if (fe) for (const [k, v] of Object.entries(fe)) if (k !== "_" && v?.[0]) out[k] = v[0];
  return out;
}

export const errorCodeOf = (err: unknown): string | undefined => bodyOf(err).code;
export const isNetworkError = (err: unknown): boolean => err instanceof ApiClientError && err.status === 0;

if (process.env.NODE_ENV === "test") {
  const e = new ApiClientError(429, "Too many attempts.", { retryAfterSeconds: 300 });
  console.assert(toUserMessage(e).includes("5 minutes"));
  console.assert(toUserMessage(new ApiClientError(500, "Something went wrong.", { reference: "PP-1" })).includes("PP-1"));
  console.assert(toUserMessage(new ApiClientError(413, "Request failed with status 413")) === BY_STATUS[413]);
  console.assert(fieldErrorsOf(new ApiClientError(400, "x", { details: { fieldErrors: { amount: ["Amount must be a number."] } } })).amount !== undefined);
}
