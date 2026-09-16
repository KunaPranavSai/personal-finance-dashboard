import { StorageMode, StorageProvider } from "./types";
import { DriveStorageProvider } from "./driveStorageProvider";
import { LocalStorageProvider } from "./localStorageProvider";

export * from "./types";
export { DriveStorageProvider } from "./driveStorageProvider";
export { LocalStorageProvider } from "./localStorageProvider";

const STORAGE_MODE_KEY = "pp-storage-mode";

/** Every existing account today is implicitly Drive-mode — this only ever
 * returns "local" once a user has explicitly gone through the Local-Only
 * onboarding flow (which is what writes this key), so introducing it changes
 * behavior for nobody by default. */
export function getStorageMode(): StorageMode {
  if (typeof window === "undefined") return "drive";
  try {
    const stored = window.localStorage.getItem(STORAGE_MODE_KEY);
    return stored === "local" ? "local" : "drive";
  } catch {
    return "drive";
  }
}

export function setStorageMode(mode: StorageMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_MODE_KEY, mode);
  } catch {
    // Storage write failing here just means the mode preference itself won't
    // persist across reloads — not a data-loss risk, so it's safe to ignore.
  }
}

let cachedProvider: StorageProvider | null = null;
let cachedMode: StorageMode | null = null;

/** Resolves the active StorageProvider for the current session. Cached per
 * mode so callers don't each construct a new adapter instance. */
export function getStorageProvider(): StorageProvider {
  const mode = getStorageMode();
  if (cachedProvider && cachedMode === mode) return cachedProvider;
  cachedProvider = mode === "local" ? new LocalStorageProvider() : new DriveStorageProvider();
  cachedMode = mode;
  return cachedProvider;
}
