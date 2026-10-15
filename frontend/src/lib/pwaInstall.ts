"use client";

// Captures the browser's native install prompt so we can control exactly
// when it's shown (post-login only) instead of letting Chrome/Edge show it
// unprompted the moment install criteria are met.

// Dismissal lasts for the current login only: sessionStorage is wiped on logout (clientDataCleanup), so the
// prompt comes back at every sign-in from a browser. The old 1-hour localStorage cooldown and the permanent
// "installed" flag are gone: a stale flag (app uninstalled later) silently disabled the prompt forever.
const DISMISS_KEY = "pfd-pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let captured = false;
let installedThisSession = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/** Call once, as early as possible (root layout), before authentication resolves. */
export function initPwaInstallCapture() {
  if (typeof window === "undefined" || captured) return;
  captured = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    installedThisSession = true;
    deferredPrompt = null;
    notify();
  });
}

export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  if (installedThisSession) return true;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari's PWA-standalone flag
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return true;
  return false;
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export function wasDismissedRecently(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** iPhone/iPad Safari (and iPadOS desktop-mode): no install event exists; the user adds it from the Share sheet. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/** What the UI can honestly offer right now. */
export type InstallSupport = "installed" | "prompt" | "ios" | "unsupported";
export function installSupport(): InstallSupport {
  if (isPwaInstalled()) return "installed";
  if (canPromptInstall()) return "prompt";
  if (isIos()) return "ios";
  return "unsupported";
}

export function subscribeToInstallAvailability(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function dismissInstallPrompt() {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // ignore
  }
}

/** Shows the real native prompt. Resolves "unavailable" if the browser never fired beforeinstallprompt. */
export async function triggerInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === "dismissed") {
    dismissInstallPrompt();
  } else {
    installedThisSession = true;
  }
  deferredPrompt = null;
  notify();
  return choice.outcome;
}
