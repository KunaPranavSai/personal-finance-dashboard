"use client";

import { motion } from "framer-motion";

/**
 * FIFA-loading-screen-style animated wordmark: "Penny Pilot" rendered with a
 * dotless ı (U+0131 — a real Unicode glyph with no dot, not a CSS trick) in
 * place of the lowercase i in "Pilot", with a small 3D gold coin bouncing
 * and spinning directly above its stem. Everything is sized in `em` units
 * relative to the wrapping text, so it scales and stays perfectly centered
 * over the stem at any font size / breakpoint — no fixed pixel offsets.
 */

const BOUNCE_DURATION = 0.9; // seconds per up-down cycle

// Gravity-like easing: fast liftoff that decelerates near the peak, then
// accelerates back down — the cubic-bezier pair below approximates that,
// and the shared `times` keyframe array keeps every synced element (coin,
// shadow, text squash) landing at the exact same instant.
const BOUNCE_TIMES = [0, 0.42, 1];
const BOUNCE_Y = ["0em", "-0.85em", "0em"];

function Coin() {
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 z-10"
      style={{ bottom: "100%", marginBottom: "0.12em", perspective: "6em" }}
      animate={{ y: BOUNCE_Y }}
      transition={{ duration: BOUNCE_DURATION, times: BOUNCE_TIMES, repeat: Infinity, ease: ["easeOut", "easeIn"] }}
    >
      <motion.div
        className="relative"
        style={{ width: "0.62em", height: "0.62em", left: "-50%", transformStyle: "preserve-3d" }}
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: BOUNCE_DURATION, repeat: Infinity, ease: "linear" }}
      >
        {/* Front face */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backfaceVisibility: "hidden",
            background: "radial-gradient(circle at 32% 28%, #FFF3C4 0%, #FFD966 28%, #E8AC1E 62%, #A9740F 100%)",
            boxShadow: "inset 0 0.03em 0.05em rgba(255,255,255,0.6), inset 0 -0.05em 0.06em rgba(120,75,0,0.5), 0 0.02em 0.05em rgba(0,0,0,0.35)",
            border: "0.02em solid rgba(140,95,10,0.6)",
          }}
        >
          <span
            className="absolute inset-0 flex items-center justify-center font-bold text-[0.32em] leading-none"
            style={{ color: "#7A4E08", textShadow: "0 0.01em 0 rgba(255,255,255,0.4)" }}
          >
            P
          </span>
        </div>
        {/* Back face */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
            background: "radial-gradient(circle at 68% 28%, #FFF3C4 0%, #FFD966 28%, #E8AC1E 62%, #A9740F 100%)",
            boxShadow: "inset 0 0.03em 0.05em rgba(255,255,255,0.6), inset 0 -0.05em 0.06em rgba(120,75,0,0.5), 0 0.02em 0.05em rgba(0,0,0,0.35)",
            border: "0.02em solid rgba(140,95,10,0.6)",
          }}
        />
      </motion.div>
    </motion.div>
  );
}

function CoinShadow() {
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 z-0 rounded-full"
      style={{ bottom: "100%", marginBottom: "0.02em", width: "0.5em", height: "0.14em", x: "-50%", background: "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 72%)" }}
      animate={{ opacity: [0.55, 0.12, 0.55], scaleX: [1, 0.55, 1] }}
      transition={{ duration: BOUNCE_DURATION, times: BOUNCE_TIMES, repeat: Infinity, ease: ["easeOut", "easeIn"] }}
    />
  );
}

interface PennyPilotCoinLoaderProps {
  className?: string;
  style?: React.CSSProperties;
}

export function PennyPilotCoinLoader({ className, style }: PennyPilotCoinLoaderProps) {
  return (
    // Deliberately no `uppercase` text-transform: browsers render the CSS
    // uppercase transform of "ı" as a dotted "I", which would defeat the
    // whole point of using the dotless glyph here.
    <h1 className={`select-none whitespace-nowrap font-extrabold tracking-wide ${className ?? ""}`} style={style}>
      <span>Penny P</span>
      <motion.span
        className="relative inline-block"
        animate={{ scaleY: [1, 1, 0.82, 1.08, 1], scaleX: [1, 1, 1.12, 0.95, 1] }}
        transition={{ duration: BOUNCE_DURATION, times: [0, 0.42, 0.5, 0.6, 0.72], repeat: Infinity, ease: "easeOut" }}
        style={{ transformOrigin: "bottom" }}
      >
        <CoinShadow />
        {/* U+0131 LATIN SMALL LETTER DOTLESS I — a real glyph with no dot, so the coin above it reads as replacing the dot rather than a CSS hack. */}
        ı
        <Coin />
      </motion.span>
      <span>lot</span>
    </h1>
  );
}
