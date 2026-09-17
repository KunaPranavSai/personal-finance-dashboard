"use client";

/**
 * Privacy cleanup for browser storage Penny Pilot itself owns — never the
 * browser's HTTP cache, never another site's storage, and never the
 * server-side account/profile data or Google Drive financial data (those
 * live entirely server-side / in the user's own Drive and aren't touched
 * from here).
 *
 * Deliberately NOT cleared, even though Penny Pilot owns the keys:
 *  - `pfd-theme` / `pp-storage-mode` / passkey preference / remembered
 *    email — per-device UI preferences the user would expect to survive a
 *    logout on their own machine, not secrets.
 *  - the `penny-pilot-local` IndexedDB database — for a Local-Only-mode
 *    user this IS their financial data (the only copy, there's no server
 *    backup), not a cache. Deleting it on logout would be data loss.
 *  - the `penny-pilot-offline` IndexedDB database — the service worker's
 *    background-sync queue for writes that haven't reached the server yet;
 *    clearing it could silently drop a pending financial-data write.
 */

const SENSITIVE_LOCALSTORAGE_KEYS = [
  "pfd-session-broadcast", // cross-tab logout signal, meaningless after logout
];

const LOCALSTORAGE_KEY_PREFIXES = [
  "pfd-analytics-custom-chart", // saved custom-chart config (see analytics pages) — per-account UI state
  "pfd-financial-health-history", // locally cached derived financial-health snapshots
];

/** Workbox runtime caches (see frontend/next.config.ts) that hold cached
 * *responses* to this account's own API calls — safe and worth purging so a
 * different account signing in on the same device/browser never sees a
 * flash of the previous account's cached dashboard data. Precache /
 * static-asset caches are left alone; those aren't account-specific and
 * clearing them would degrade offline/PWA behavior for no privacy benefit. */
const ACCOUNT_SCOPED_CACHE_NAMES = ["api-dashboard", "api-lookup"];

function clearLocalStorage(): void {
  try {
    for (const key of SENSITIVE_LOCALSTORAGE_KEYS) localStorage.removeItem(key);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && LOCALSTORAGE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore — private browsing / storage disabled
  }
}

function clearSessionStorage(): void {
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
}

async function clearAccountScopedCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await Promise.all(ACCOUNT_SCOPED_CACHE_NAMES.map((name) => caches.delete(name)));
  } catch {
    // ignore — Cache Storage unavailable or blocked
  }
}

/** Call once an explicit logout's own API call has completed — never race
 * it, so a slow/failed logout request is never affected by this. */
export async function clearClientSensitiveStorage(): Promise<void> {
  clearSessionStorage();
  clearLocalStorage();
  await clearAccountScopedCaches();
}

// --- "closed for a while" detection -----------------------------------
//
// A page cannot run JavaScript minutes after its tab has actually closed.
// Instead: stamp a last-active marker while the app is open (on load, and
// periodically while visible), and on the *next* load, if that marker is
// older than the threshold, treat it as "the previous session was closed
// (or backgrounded) for a while" and run the same privacy cleanup. This
// never logs the user out and never touches Local-Only financial data or
// the offline sync queue — see the module comment above.

const LAST_ACTIVE_KEY = "pfd-last-active-at";
const CLOSED_THRESHOLD_MS = 10 * 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;

function stampLastActive(): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/** Runs once per app load: if the last stamp is older than the threshold
 * (or missing, on a completely fresh browser/profile), the previous tab is
 * treated as long-closed and the privacy cleanup runs. Then starts a
 * heartbeat that keeps the marker fresh for as long as this tab is open. */
export function initClientDataLifecycle(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY);
    const last = raw ? Number(raw) : null;
    if (last && Date.now() - last > CLOSED_THRESHOLD_MS) {
      void clearClientSensitiveStorage();
    }
  } catch {
    // ignore
  }

  stampLastActive();
  const heartbeat = window.setInterval(stampLastActive, HEARTBEAT_MS);

  const onVisibility = () => {
    if (document.visibilityState === "visible") stampLastActive();
  };
  document.addEventListener("visibilitychange", onVisibility);
  // `pagehide` fires reliably on tab close/navigation across mobile and
  // desktop browsers (unlike `beforeunload`, which mobile browsers often
  // skip) — a last best-effort stamp so the "closed at" time is as accurate
  // as possible for the next load's threshold check.
  window.addEventListener("pagehide", stampLastActive);

  window.addEventListener("beforeunload", () => {
    window.clearInterval(heartbeat);
  });
}
