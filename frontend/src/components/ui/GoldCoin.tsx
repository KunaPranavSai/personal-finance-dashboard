"use client";

import { motion } from "framer-motion";

interface GoldCoinProps {
  /** CSS size (e.g. "0.62em", "3rem", "64px"). */
  size?: string;
  /** Seconds per full Y-axis flip. Set to 0 to disable spinning. */
  spinDuration?: number;
  /** Character engraved on the coin's front face. */
  label?: string;
  className?: string;
}

const faceStyle = {
  backfaceVisibility: "hidden" as const,
  background: "radial-gradient(circle at 32% 28%, #FFF3C4 0%, #FFD966 28%, #E8AC1E 62%, #A9740F 100%)",
  boxShadow:
    "inset 0 0.08em 0.12em rgba(255,255,255,0.6), inset 0 -0.12em 0.14em rgba(120,75,0,0.5), 0 0.05em 0.12em rgba(0,0,0,0.35)",
  border: "0.04em solid rgba(140,95,10,0.6)",
};

/** A small, reusable 3D gold coin — true two-sided rotateY flip (not a fake scaleX squash). */
export function GoldCoin({ size = "3rem", spinDuration = 2.2, label = "P", className }: GoldCoinProps) {
  return (
    <div className={className} style={{ width: size, height: size, perspective: "10em" }}>
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={spinDuration ? { rotateY: [0, 360] } : undefined}
        transition={spinDuration ? { duration: spinDuration, repeat: Infinity, ease: "linear" } : undefined}
      >
        <div className="absolute inset-0 rounded-full" style={faceStyle}>
          <span
            className="absolute inset-0 flex items-center justify-center font-bold leading-none"
            style={{ color: "#7A4E08", fontSize: "0.42em", textShadow: "0 0.01em 0 rgba(255,255,255,0.4)" }}
          >
            {label}
          </span>
        </div>
        <div className="absolute inset-0 rounded-full" style={{ ...faceStyle, transform: "rotateY(180deg)" }} />
      </motion.div>
    </div>
  );
}
