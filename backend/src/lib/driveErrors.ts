import { ApiError } from "../middleware/errorHandler";

/** Duck-typed shape of a googleapis (Gaxios) error — avoids a hard dependency
 * on its internal error class, which isn't exported in a stable way. */
interface GaxiosLikeError {
  response?: {
    status?: number;
    data?: { error?: { errors?: { reason?: string }[]; message?: string } };
  };
  code?: string | number;
  message?: string;
}

function reasonOf(err: GaxiosLikeError): string | undefined {
  return err.response?.data?.error?.errors?.[0]?.reason;
}

/** Maps a raw Google Drive API failure to the app's structured error contract
 * (Master Plan §16/§23) — the caller (dataService.ts) always sees a specific,
 * actionable ApiError instead of a bare network/HTTP error that would
 * otherwise fall through errorHandler.ts to a generic 500. `op` only affects
 * the fallback message when the failure doesn't match a known reason. */
export function mapGoogleDriveError(err: unknown, op: "read" | "write"): ApiError {
  const e = err as GaxiosLikeError;
  const status = e?.response?.status;
  const reason = reasonOf(e ?? {});

  if (reason === "storageQuotaExceeded" || status === 507) {
    return new ApiError(
      507,
      "Your Google Drive storage is full, so this couldn't be saved.",
      "DRIVE_STORAGE_QUOTA_EXCEEDED",
      "FREE_DRIVE_SPACE"
    );
  }
  if (reason === "insufficientPermissions" || reason === "insufficientFilePermissions" || status === 403) {
    return new ApiError(
      403,
      "Penny Pilot no longer has permission to access your Google Drive. Please reconnect Google Drive.",
      "DRIVE_PERMISSION_DENIED",
      "RECONNECT_DRIVE"
    );
  }
  if (status === 401) {
    return new ApiError(
      401,
      "Your Google Drive authorization has expired. Reconnect Google Drive to continue.",
      "DRIVE_AUTH_EXPIRED",
      "RECONNECT_DRIVE"
    );
  }
  if (status === 404) {
    return new ApiError(
      404,
      "A file Penny Pilot expected in your Google Drive is missing.",
      "DRIVE_FILE_NOT_FOUND",
      "VERIFY_DATA"
    );
  }
  if (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded" || status === 429) {
    return new ApiError(429, "Google Drive is temporarily rate-limiting requests. Please try again shortly.", "DRIVE_API_UNAVAILABLE", "RETRY");
  }
  if (typeof status === "number" && status >= 500) {
    return new ApiError(
      502,
      "Google Drive isn't responding right now. Your data has not been intentionally changed — please try again shortly.",
      "DRIVE_API_UNAVAILABLE",
      "RETRY"
    );
  }
  if (e?.code === "ENOTFOUND" || e?.code === "ECONNRESET" || e?.code === "ETIMEDOUT") {
    return new ApiError(504, "Couldn't reach Google Drive. Check your connection and try again.", "DRIVE_API_UNAVAILABLE", "RETRY");
  }

  return new ApiError(
    502,
    op === "write" ? "Couldn't save this to Google Drive. Please try again." : "Couldn't read this from Google Drive. Please try again.",
    op === "write" ? "DRIVE_WRITE_FAILED" : "DRIVE_READ_FAILED",
    "RETRY"
  );
}
