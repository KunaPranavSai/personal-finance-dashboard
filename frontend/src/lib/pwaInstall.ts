"use client";

// Captures the browser's native install prompt so we can control exactly
// when it's shown (post-login only) instead of letting Chrome/Edge show it
// unprompted the moment install criteria are met.

const DISMISS_KEY = "pfd-pwa-install-dismissed-at";
const INSTALLED_KEY = "pfd-pwa-installed";
const DISMISS_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let captured = false;
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
    try {
      localStorage.setItem(INSTALLED_KEY, "1");
    } catch {
      // ignore
    }
    deferredPrompt = null;
    notify();
  });
}

export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(INSTALLED_KEY) === "1") return true;
  } catch {
    // ignore
  }
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
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function subscribeToInstallAvailability(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function dismissInstallPrompt() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
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
    try {
      localStorage.setItem(INSTALLED_KEY, "1");
    } catch {
      // ignore
    }
  }
  deferredPrompt = null;
  notify();
  return choice.outcome;
}
