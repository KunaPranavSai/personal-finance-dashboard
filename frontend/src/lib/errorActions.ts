import { ApiClientError } from "./api";

export interface RecoveryAction {
  label: string;
  onClick: () => void;
}

/** Turns the backend's optional `action` code (Master Plan §16/§23) into a
 * concrete, clickable recovery step — so a Drive failure toast can offer
 * "Reconnect Google Drive" or "Free Up Space" instead of just an error
 * string. Returns undefined when there's nothing more useful to do than
 * dismiss (e.g. plain validation errors carry no action code at all). */
export function getRecoveryAction(err: unknown, router: { push: (path: string) => void }, onRetry?: () => void): RecoveryAction | undefined {
  if (!(err instanceof ApiClientError)) return undefined;
  const details = err.details as { action?: string; code?: string } | undefined;
  const action = details?.action;
  switch (action) {
    case "RECONNECT_DRIVE":
      return { label: "Reconnect Google Drive", onClick: () => router.push("/connect-drive") };
    case "FREE_DRIVE_SPACE":
      return { label: "Open Google Drive Storage", onClick: () => window.open("https://drive.google.com/settings/storage", "_blank", "noopener,noreferrer") };
    case "VERIFY_DATA":
      return { label: "Go to Data & Storage", onClick: () => router.push("/settings?tab=backup") };
    case "RETRY":
      return onRetry ? { label: "Try Again", onClick: onRetry } : undefined;
  }
  // Fall back to the stable error `code` (Master Plan §16 catalog) when no
  // explicit `action` hint was set — covers codes that were only ever meant
  // to classify the failure, not necessarily drive a specific button, but
  // still have an obviously useful next step.
  switch (details?.code) {
    case "AUTH_REQUIRED":
    case "AUTH_EXPIRED":
      return { label: "Sign In", onClick: () => router.push("/login") };
    // AUTH_INVALID (wrong credentials/code) and AUTH_FORBIDDEN (authenticated
    // but not authorized) are already surfaced via the backend's own
    // human-readable, anti-enumeration-safe `error` message at the call site
    // (e.g. the login form's inline error) — no extra button, and critically
    // no redirect, since the user is often still mid-form on these.
    case "AUTH_INVALID":
    case "AUTH_FORBIDDEN":
      return undefined;
    // Rate limiting resolves with time, not a click — never offer a retry
    // button here (that would just re-trigger the limiter).
    case "AUTH_RATE_LIMITED":
      return undefined;
    case "DRIVE_NOT_CONNECTED":
    case "DRIVE_AUTH_EXPIRED":
      return { label: "Connect Google Drive", onClick: () => router.push("/connect-drive") };
    case "DRIVE_STORAGE_QUOTA_EXCEEDED":
      return { label: "Manage Drive Storage", onClick: () => window.open("https://drive.google.com/settings/storage", "_blank", "noopener,noreferrer") };
    case "NETWORK_OFFLINE":
    case "NETWORK_TIMEOUT":
    case "SERVER_UNAVAILABLE":
    case "DATABASE_UNAVAILABLE":
      return onRetry ? { label: "Try Again", onClick: onRetry } : undefined;
    default:
      return undefined;
  }
}

/** Same idea as getRecoveryAction, but for local, non-ApiClientError failures
 * (import/export/local-storage) that carry a plain `{code, message}` shape
 * instead of going through the API client — e.g. DataStorageCard's backup
 * import flow. Never triggers an automatic retry for these; the user always
 * takes the next step explicitly (re-select a file, re-enter a password). */
export function getLocalRecoveryAction(code: string | undefined, onPickAnotherFile?: () => void): RecoveryAction | undefined {
  switch (code) {
    case "IMPORT_DECRYPTION_FAILED":
      return undefined; // handled inline as "check your password" — no separate action needed
    case "IMPORT_INVALID":
    case "IMPORT_VALIDATION_FAILED":
      return onPickAnotherFile ? { label: "Choose a Different File", onClick: onPickAnotherFile } : undefined;
    default:
      return undefined;
  }
}
