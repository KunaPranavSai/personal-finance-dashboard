"use client";

// Reusable client-side voice-greeting utility built on the browser's native
// SpeechSynthesis API — no new dependency, no external/paid TTS service,
// since the project has none of its own to reuse (confirmed by inspection).
// Every call site is expected to fire this from inside a user-gesture event
// handler (form submit, button click), never from a bare useEffect — that's
// what naturally satisfies both "no duplicate speech from re-renders" (an
// event only fires once per real user action) and "respect autoplay
// restrictions" (speech synthesis started synchronously off a click/submit
// is treated as user-initiated), without any extra bookkeeping here.

let cachedVoice: SpeechSynthesisVoice | null = null;
let cachedVoiceForVoicesListVersion = -1;
let voicesListVersion = 0;

function isSpeechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

if (isSpeechAvailable()) {
  // Most browsers load the voice list asynchronously; this just invalidates
  // the cached pick once the real list is in, rather than being required to
  // speak at all — pickVoice() already tolerates an empty list gracefully.
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    voicesListVersion += 1;
  });
}

/** No hard-coded voice names — just generic signals a browser/OS voice list
 * commonly exposes in its own `name`/`lang` fields: language region, an
 * explicit "female"/"male" label when present, and quality descriptors
 * ("Natural"/"Neural"/etc.) that correlate with a less robotic result. */
function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name;
  const lang = (v.lang || "").toLowerCase();
  let score = 0;
  if (lang.startsWith("en-in")) score += 100;
  else if (lang.startsWith("en")) score += 10;
  if (/female/i.test(name)) score += 50;
  if (/natural|neural|enhanced|premium|online/i.test(name)) score += 20;
  if (v.localService) score += 1;
  return score;
}

/** Picks a natural, calm-sounding English voice — preferring en-IN, then
 * any other natural-sounding English female voice, then falling back to
 * whatever's installed. Never throws; null means "use the browser default
 * voice" (still perfectly safe to speak with). */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechAvailable()) return null;
  if (cachedVoice && cachedVoiceForVoicesListVersion === voicesListVersion) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = english.length ? english : voices;

  // Avoid an explicitly male-labeled voice when a non-male-labeled
  // alternative exists at all — never excludes everything down to nothing.
  const isExplicitlyMale = (v: SpeechSynthesisVoice) => /\bmale\b/i.test(v.name) && !/female/i.test(v.name);
  const nonMale = pool.filter((v) => !isExplicitlyMale(v));
  const candidates = nonMale.length ? nonMale : pool;

  const picked = candidates.reduce<SpeechSynthesisVoice | null>(
    (best, v) => (best === null || scoreVoice(v) > scoreVoice(best) ? v : best),
    null
  );
  cachedVoice = picked;
  cachedVoiceForVoicesListVersion = voicesListVersion;
  return picked;
}

export interface PlayVoiceGreetingOptions {
  /** The caller's resolved Voice Greetings preference. Defaults to true
   * (the feature's own documented default for new/not-yet-loaded users) so
   * a caller that hasn't finished loading settings yet still gets the
   * "ON by default" behavior instead of silently never speaking. */
  enabled?: boolean;
}

/**
 * Speaks a short greeting, softly and warmly, respecting the user's Voice
 * Greetings preference. Safe to call unconditionally from any auth flow:
 * it never throws, and silently no-ops if speech is unavailable, disabled,
 * or the preference is off — a voice failure can never break signup,
 * login, or logout.
 */
export function playVoiceGreeting(message: string, options: PlayVoiceGreetingOptions = {}): void {
  try {
    if (options.enabled === false) return;
    if (!isSpeechAvailable()) return;
    const synth = window.speechSynthesis;
    // Cancel, don't stack, anything already mid-utterance (e.g. a second
    // quick sign-in attempt) instead of overlapping two greetings.
    synth.cancel();
    // A brief beat after cancel() so playback doesn't start abruptly right
    // on top of a just-cancelled utterance/UI transition.
    setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 0.85; // slow and unhurried
        utterance.pitch = 1.1; // soft, warm, not flat
        utterance.volume = 0.8; // gentle, not jarring
        const voice = pickVoice();
        if (voice) utterance.voice = voice;
        synth.speak(utterance);
      } catch {
        // Never let a speech failure break the caller's auth/navigation flow.
      }
    }, 150);
  } catch {
    // Never let a speech failure break the caller's auth/navigation flow.
  }
}

/** Stops whatever greeting is currently playing, if any. Safe no-op when
 * speech is unavailable or nothing is in progress. */
export function stopVoiceGreeting(): void {
  try {
    if (isSpeechAvailable()) window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

export const VOICE_GREETINGS = {
  signup: "Welcome to Penny Pilot! Your journey toward smarter money management starts here. Let's make every rupee count.",
  login: "Welcome back to Penny Pilot! It's great to have you back. Let's take a look at your finances.",
  firstLogin: "Welcome to Penny Pilot! Your financial dashboard is ready. Let's take control of your spending, savings, and goals.",
  signOut: "Goodbye for now! Take care, and we'll see you back at Penny Pilot.",
} as const;

/** Reads the Voice Greetings preference out of a settings.preferences bag,
 * defaulting to true (ON) when unset/not yet loaded. */
export function isVoiceGreetingsEnabled(preferences: Record<string, unknown> | undefined): boolean {
  return preferences?.voiceGreetings !== false;
}
