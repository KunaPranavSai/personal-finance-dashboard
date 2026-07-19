"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const NAVY = "#1F2A44";
const GREEN = "#1FAE6B";
const STEEL_LIGHT = "#EEF1F6";
const STEEL_MID = "#A7AFC0";
const STEEL_DARK = "#6B7280";

// Monoline "P" outline traced to match the PennyPilot mark.
const P_PATH = "M28,138 L28,18 L74,18 A26,26 0 0 1 74,70 L28,70";
// Open "C" arc sitting inside the P's bowl, gap facing up-right.
const C_PATH = "M64,37 A15,15 0 1 1 46,30";

const TOTAL_MS = 3200;
// Deceleration curve for the coin spin — fast start, long settle, like a real coin losing momentum.
const SPIN_EASE = [0.1, 0.85, 0.15, 1] as const;

function CoinFace({ side }: { side: "front" | "back" }) {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
      <defs>
        <radialGradient id={`coin-sheen-${side}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={STEEL_LIGHT} />
          <stop offset="55%" stopColor={STEEL_MID} />
          <stop offset="100%" stopColor={STEEL_DARK} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#coin-sheen-${side})`} stroke={STEEL_DARK} strokeWidth="1.5" />
      {/* reeded edge */}
      <circle cx="50" cy="50" r="47" fill="none" stroke={STEEL_DARK} strokeOpacity="0.5" strokeWidth="0.6" strokeDasharray="1.4 2" />
      <circle cx="50" cy="50" r="40" fill="none" stroke={STEEL_DARK} strokeOpacity="0.4" strokeWidth="0.8" />

      {side === "front" ? (
        <g>
          <text x="50" y="60" textAnchor="middle" fontSize="34" fontWeight="700" fill="#2B3242" fontFamily="Georgia, serif">
            ₹1
          </text>
          <circle cx="32" cy="28" r="1.6" fill={STEEL_DARK} opacity={0.6} />
          <circle cx="68" cy="28" r="1.6" fill={STEEL_DARK} opacity={0.6} />
        </g>
      ) : (
        <g>
          {/* abstracted pillar/capital silhouette — stylized, not a literal emblem reproduction */}
          <rect x="41" y="32" width="4" height="24" rx="1.5" fill="#2B3242" />
          <rect x="48" y="26" width="4" height="30" rx="1.5" fill="#2B3242" />
          <rect x="55" y="32" width="4" height="24" rx="1.5" fill="#2B3242" />
          <ellipse cx="50" cy="24" rx="8" ry="3" fill="#2B3242" />
          <circle cx="50" cy="18" r="2.4" fill="#2B3242" />
          <text x="50" y="70" textAnchor="middle" fontSize="7" fontWeight="600" fill="#2B3242" fontFamily="system-ui">
            भारत
          </text>
          <text x="50" y="78" textAnchor="middle" fontSize="6" fontWeight="600" fill="#2B3242" letterSpacing="1.5">
            INDIA
          </text>
        </g>
      )}
    </svg>
  );
}

export function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const [visible, setVisible] = useState(true);
  const [coinDone, setCoinDone] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("pp-splash-shown")) {
      setVisible(false);
      onFinish?.();
      return;
    }
    const coinTimer = setTimeout(() => setCoinDone(true), 950);
    const endTimer = setTimeout(() => {
      setVisible(false);
      if (typeof window !== "undefined") sessionStorage.setItem("pp-splash-shown", "1");
    }, TOTAL_MS);
    return () => {
      clearTimeout(coinTimer);
      clearTimeout(endTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence onExitComplete={onFinish}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{ background: "radial-gradient(circle at 50% 45%, #ffffff 0%, #f7f8fa 100%)" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeOut", delay: 0.1 } }}
        >
          <motion.div
            className="flex flex-col items-center"
            initial={{ scale: 1, y: 0 }}
            animate={{ scale: [1, 1, 0.96], y: [0, 0, -15] }}
            transition={{ duration: TOTAL_MS / 1000, times: [0, 0.86, 1], ease: "easeOut" }}
          >
            <div className="relative flex h-40 w-40 items-center justify-center">
              {/* Ambient glow */}
              <motion.div
                className="absolute h-32 w-32 rounded-full"
                style={{ background: `radial-gradient(circle, ${NAVY}33 0%, transparent 70%)`, filter: "blur(16px)" }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: [0, 0, 0.7, 0], scale: [0.6, 0.6, 1.15, 1.3] }}
                transition={{ duration: 3.2, times: [0, 0.46, 0.58, 0.7], ease: "easeOut" }}
              />

              {/* Settle ripple */}
              <motion.div
                className="absolute h-16 w-16 rounded-full border-2"
                style={{ borderColor: STEEL_DARK }}
                initial={{ opacity: 0, scale: 1 }}
                animate={{ opacity: [0, 0.5, 0], scale: [1, 1.9, 2.4] }}
                transition={{ duration: 0.6, delay: 0.92, ease: "easeOut" }}
              />

              {/* Coin — real 3D flip via perspective + backface-visibility, decaying spin */}
              <motion.div
                className="absolute h-16 w-16"
                style={{ perspective: 700 }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: coinDone ? 0 : [0, 1, 1], scale: coinDone ? 1.15 : [0.5, 1, 1] }}
                transition={
                  coinDone
                    ? { duration: 0.35, ease: "easeOut" }
                    : { duration: 0.25, times: [0, 0.6, 1], ease: "easeOut" }
                }
              >
                <motion.div
                  className="relative h-full w-full"
                  style={{ transformStyle: "preserve-3d" }}
                  initial={{ rotateY: 0 }}
                  animate={{ rotateY: 1800 }}
                  transition={{ duration: 0.85, delay: 0.1, ease: SPIN_EASE }}
                >
                  {/* moving specular shine */}
                  <motion.div
                    className="pointer-events-none absolute inset-0 z-10 rounded-full"
                    style={{
                      background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.75) 48%, transparent 65%)",
                      mixBlendMode: "overlay",
                    }}
                    initial={{ backgroundPosition: "-120% 0" }}
                    animate={{ backgroundPosition: "220% 0" }}
                    transition={{ duration: 0.9, delay: 0.15, ease: "linear", repeat: 2 }}
                  />
                  <div className="absolute inset-0 rounded-full" style={{ backfaceVisibility: "hidden" }}>
                    <CoinFace side="front" />
                  </div>
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    <CoinFace side="back" />
                  </div>
                </motion.div>
              </motion.div>

              {/* Brand mark: C + P, cross-fades in as the coin settles */}
              <motion.svg
                viewBox="0 0 100 156"
                className="relative h-32 w-24"
                initial={{ opacity: 0, scale: 1 }}
                animate={{ opacity: 1, scale: [1, 1, 1.08, 1] }}
                transition={{
                  opacity: { duration: 0.35, delay: 0.95, ease: "easeOut" },
                  scale: { duration: 3.2, times: [0, 0.5, 0.58, 0.64], ease: "easeOut" },
                }}
              >
                <motion.path
                  d={C_PATH}
                  fill="none"
                  stroke={NAVY}
                  strokeWidth={7}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, delay: 1.0, ease: "easeOut" }}
                />
                <motion.path
                  d={P_PATH}
                  fill="none"
                  stroke={NAVY}
                  strokeWidth={13}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 1.15, ease: "easeInOut" }}
                />
              </motion.svg>
            </div>

            <motion.h1
              className="mt-4 text-3xl font-extrabold tracking-wide"
              style={{ color: NAVY }}
              initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.4, delay: 1.9, ease: "easeOut" }}
            >
              PENNYPILOT
            </motion.h1>

            <motion.p
              className="mt-1 text-xs font-semibold tracking-[0.2em]"
              style={{ color: GREEN }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 2.15, ease: "easeOut" }}
            >
              SMART MONEY MANAGEMENT
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
