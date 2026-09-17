"use client";

// Reusable client-side voice-greeting utility — plays a real, high-quality
// TTS audio clip synthesized server-side (Google Cloud Text-to-Speech, a
// natural en-IN female voice), never the browser's own robotic-sounding
// SpeechSynthesis. The API key lives only in the backend; the frontend just
// requests a greeting by its fixed key and plays back the returned audio.
// Every call site is expected to fire this from inside a user-gesture event
// handler (form submit, button click), never from a bare useEffect — that's
// what naturally satisfies both "no duplicate speech from re-renders" (an
// event only fires once per real user action) and "respect autoplay
// restrictions" (playback started synchronously off a click/submit is
// treated as user-initiated), without any extra bookkeeping here.

import { API_BASE_URL } from "./api";

export const VOICE_GREETINGS = {
  signup: "Welcome to Penny Pilot! Your journey toward smarter money management starts here. Let's make every rupee count.",
  login: "Welcome back to Penny Pilot! It's great to have you back. Let's take a look at your finances.",
  firstLogin: "Welcome to Penny Pilot! Your financial dashboard is ready. Let's take control of your spending, savings, and goals.",
  signOut: "Goodbye for now! Take care, and we'll see you back at Penny Pilot.",
} as const;

export type VoiceGreetingKey = keyof typeof VOICE_GREETINGS;

export interface PlayVoiceGreetingOptions {
  /** The caller's resolved Voice Greetings preference. Defaults to true
   * (the feature's own documented default for new/not-yet-loaded users) so
   * a caller that hasn't finished loading settings yet still gets the
   * "ON by default" behavior instead of silently never playing. */
  enabled?: boolean;
}

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

function cleanupCurrent(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      // ignore
    }
    currentAudio = null;
  }
  if (currentObjectUrl) {
    try {
      URL.revokeObjectURL(currentObjectUrl);
    } catch {
      // ignore
    }
    currentObjectUrl = null;
  }
}

/**
 * Plays a short, soft, natural-sounding spoken greeting for `key`, respecting
 * the user's Voice Greetings preference. Safe to call unconditionally from
 * any auth flow: it never throws, and silently no-ops if the preference is
 * off, the network request fails, or playback is blocked — a voice failure
 * can never break signup, login, or logout.
 */
export function playVoiceGreeting(key: VoiceGreetingKey, options: PlayVoiceGreetingOptions = {}): void {
  try {
    if (options.enabled === false) return;
    if (typeof window === "undefined" || typeof Audio === "undefined") return;

    // Cancel, don't stack, anything already playing (e.g. a second quick
    // sign-in attempt) instead of overlapping two greetings.
    cleanupCurrent();

    fetch(`${API_BASE_URL}/api/voice-greeting/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = 0.8; // gentle, not jarring
        currentAudio = audio;
        currentObjectUrl = url;
        const cleanupIfCurrent = () => {
          if (currentAudio === audio) {
            currentAudio = null;
          }
          try {
            URL.revokeObjectURL(url);
          } catch {
            // ignore
          }
          if (currentObjectUrl === url) currentObjectUrl = null;
        };
        audio.addEventListener("ended", cleanupIfCurrent);
        audio.addEventListener("error", cleanupIfCurrent);
        // Browsers may still block autoplay in edge cases (e.g. the user
        // gesture chain was too indirect) — never let a rejected play()
        // promise surface as an unhandled rejection.
        void audio.play().catch(() => {
          cleanupIfCurrent();
        });
      })
      .catch(() => {
        // Network/service failure — silently no-op, exactly like an
        // unavailable browser voice would.
      });
  } catch {
    // Never let a playback failure break the caller's auth/navigation flow.
  }
}

/** Stops whatever greeting is currently playing, if any. Safe no-op when
 * nothing is in progress. */
export function stopVoiceGreeting(): void {
  try {
    cleanupCurrent();
  } catch {
    // ignore
  }
}

/** Reads the Voice Greetings preference out of a settings.preferences bag,
 * defaulting to true (ON) when unset/not yet loaded. */
export function isVoiceGreetingsEnabled(preferences: Record<string, unknown> | undefined): boolean {
  return preferences?.voiceGreetings !== false;
}
