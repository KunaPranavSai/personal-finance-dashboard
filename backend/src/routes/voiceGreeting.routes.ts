import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Public (unauthenticated) — the signup-success voice greeting fires before
// any session exists, so this endpoint can't sit behind `authenticate`. Kept
// safe anyway: only ever synthesizes one of the four fixed, known-in-advance
// messages below (never arbitrary client-supplied text), and is rate-limited
// like every other public auth-adjacent endpoint in this app.
const speakLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// Mirrors frontend/src/lib/voiceGreeting.ts's VOICE_GREETINGS exactly — kept
// server-side too so the endpoint never has to trust client-supplied text.
const GREETING_MESSAGES = {
  signup: "Welcome to Penny Pilot! Your journey toward smarter money management starts here. Let's make every rupee count.",
  login: "Welcome back to Penny Pilot! It's great to have you back. Let's take a look at your finances.",
  firstLogin: "Welcome to Penny Pilot! Your financial dashboard is ready. Let's take control of your spending, savings, and goals.",
  signOut: "Goodbye for now! Take care, and we'll see you back at Penny Pilot.",
} as const;

type GreetingKey = keyof typeof GREETING_MESSAGES;

function isGreetingKey(value: unknown): value is GreetingKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(GREETING_MESSAGES, value);
}

// Natural-sounding female en-IN voices first, falling back to progressively
// more widely-available options if a given voice/model isn't provisioned on
// this Google Cloud project — never falls back to a male or robotic-sounding
// voice while any of these are reachable.
const VOICE_FALLBACK_CHAIN: { languageCode: string; name: string }[] = [
  { languageCode: "en-IN", name: "en-IN-Neural2-A" },
  { languageCode: "en-IN", name: "en-IN-Wavenet-A" },
  { languageCode: "en-IN", name: "en-IN-Standard-A" },
  { languageCode: "en-US", name: "en-US-Neural2-F" },
];

async function synthesizeWithGoogleTts(text: string, apiKey: string): Promise<Buffer> {
  let lastError: unknown = null;
  for (const voice of VOICE_FALLBACK_CHAIN) {
    try {
      const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: voice.languageCode, name: voice.name, ssmlGender: "FEMALE" },
          audioConfig: {
            audioEncoding: "MP3",
            // Soft, calm, unhurried — matches the browser-TTS tuning this
            // replaces (rate ~0.85, pitch fractionally warmer than neutral).
            speakingRate: 0.85,
            pitch: 2.0,
            volumeGainDb: -1.0,
          },
        }),
      });
      if (!res.ok) {
        lastError = new Error(`Google TTS ${voice.name} responded ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { audioContent?: string };
      if (!data.audioContent) {
        lastError = new Error(`Google TTS ${voice.name} returned no audio`);
        continue;
      }
      return Buffer.from(data.audioContent, "base64");
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("Google TTS: all voice fallbacks failed");
}

// ─── POST /api/voice-greeting/speak ──────────────────────────────────────────
router.post(
  "/speak",
  speakLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.body as { key?: unknown };
    if (!isGreetingKey(key)) {
      res.status(400).json({ error: "Unknown greeting key" });
      return;
    }
    const apiKey = process.env.GOOGLE_TTS_API_KEY;
    if (!apiKey) {
      // Voice greetings degrade gracefully to silence — never a hard error
      // that could be mistaken for an auth/navigation failure by a caller.
      res.status(503).json({ error: "Voice greeting service is not configured" });
      return;
    }
    try {
      const audio = await synthesizeWithGoogleTts(GREETING_MESSAGES[key], apiKey);
      res.setHeader("Content-Type", "audio/mpeg");
      // These four messages never change at runtime — safe for the browser
      // to cache and never re-request per greeting per session.
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(audio);
    } catch {
      res.status(502).json({ error: "Voice greeting synthesis failed" });
    }
  })
);

export default router;
